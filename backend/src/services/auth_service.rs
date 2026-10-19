use crate::{
    middleware::telemetry_middleware::{attach_encrypted_token_to_current_span, hash_token},
    models::auth::{AuthError, AuthToken, Claims},
};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use uuid::Uuid;

const MIN_SECRET_LENGTH: usize = 32;
const TOKEN_EXPIRATION_HOURS: i64 = 24;
const NEVER_EXPIRE_DURATION_DAYS: i64 = 365 * 100;

#[derive(Debug)]
pub struct AuthService {
    secret_key: String,
    never_expire_default: bool,
}

impl AuthService {
    pub fn new(secret_key: String) -> Result<Self, AuthError> {
        if secret_key.len() < MIN_SECRET_LENGTH {
            return Err(AuthError::InvalidSecret);
        }
        let never_expire_default = std::env::var("AUTH_SESSION_NEVER_EXPIRES")
            .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
            .unwrap_or(false);
        Ok(Self {
            secret_key,
            never_expire_default,
        })
    }

    #[tracing::instrument(skip(self, password))]
    pub fn hash_password(&self, password: &str) -> Result<String, AuthError> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();

        match argon2.hash_password(password.as_bytes(), &salt) {
            Ok(hash) => Ok(hash.to_string()),
            Err(_) => Err(AuthError::HashingError),
        }
    }

    #[tracing::instrument(skip(self, password, hash))]
    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool, AuthError> {
        let parsed_hash = PasswordHash::new(hash).map_err(|_| AuthError::HashingError)?;

        let argon2 = Argon2::default();
        match argon2.verify_password(password.as_bytes(), &parsed_hash) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    #[tracing::instrument(skip(self))]
    pub fn generate_token(&self, user_id: Uuid) -> Result<AuthToken, AuthError> {
        self.generate_token_with_remember_me(user_id, self.never_expire_default)
    }

    #[tracing::instrument(skip(self))]
    pub fn generate_token_with_remember_me(
        &self,
        user_id: Uuid,
        remember_me: bool,
    ) -> Result<AuthToken, AuthError> {
        let is_never_expire = remember_me || self.never_expire_default;
        let now = Utc::now();
        let expiration = if is_never_expire {
            now + Duration::days(NEVER_EXPIRE_DURATION_DAYS)
        } else {
            now + Duration::hours(TOKEN_EXPIRATION_HOURS)
        };
        let jwt_id = Uuid::new_v4().to_string();

        let claims = Claims {
            sub: user_id.to_string(),
            exp: expiration.timestamp() as usize,
            iat: now.timestamp() as usize,
            jti: jwt_id.clone(),
            remember_me: if is_never_expire { Some(true) } else { None },
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.secret_key.as_ref()),
        )
        .map_err(|_| AuthError::InvalidToken)?;

        let auth_token = AuthToken {
            token,
            jwt_id,
            expires_at: expiration,
            remember_me: is_never_expire,
        };

        attach_encrypted_token_to_current_span(&hash_token(&auth_token.token));

        Ok(auth_token)
    }

    #[allow(dead_code)]
    pub fn generate_token_with_expiry(
        &self,
        user_id: Uuid,
        expiry_duration: std::time::Duration,
    ) -> Result<AuthToken, AuthError> {
        let now = Utc::now();
        let expiration =
            now + Duration::from_std(expiry_duration).map_err(|_| AuthError::InvalidToken)?;
        let jwt_id = Uuid::new_v4().to_string();

        let claims = Claims {
            sub: user_id.to_string(),
            exp: expiration.timestamp() as usize,
            iat: now.timestamp() as usize,
            jti: jwt_id.clone(),
            remember_me: None,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.secret_key.as_ref()),
        )
        .map_err(|_| AuthError::InvalidToken)?;

        let auth_token = AuthToken {
            token,
            jwt_id,
            expires_at: expiration,
            remember_me: false,
        };

        attach_encrypted_token_to_current_span(&hash_token(&auth_token.token));

        Ok(auth_token)
    }

    #[tracing::instrument(skip(self, token))]
    pub fn validate_token(&self, token: &str) -> Result<Claims, AuthError> {
        if self.is_malicious_token(token) {
            return Err(AuthError::InvalidToken);
        }

        let validation = Self::create_validation();

        match decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.secret_key.as_ref()),
            &validation,
        ) {
            Ok(token_data) => {
                let encrypted_token = hash_token(token);
                attach_encrypted_token_to_current_span(&encrypted_token);

                if token_data.claims.remember_me != Some(true) {
                    let now = Utc::now().timestamp() as usize;
                    if token_data.claims.exp < now {
                        return Err(AuthError::TokenExpired);
                    }
                }

                Ok(token_data.claims)
            }
            Err(_) => Err(AuthError::InvalidToken),
        }
    }

    fn is_malicious_token(&self, token: &str) -> bool {
        let has_path_traversal = token.contains("../") || token.contains("..\\");
        let has_script_injection = token.contains("<script>") || token.contains("javascript:");
        let has_sql_injection = token.contains("' OR 1=1") || token.contains("UNION SELECT");
        let has_null_bytes = token.contains('\x00');
        let is_extremely_long = token.len() > 10_000;

        let has_suspicious_algorithm = token.contains("\"alg\":\"none\"");
        let has_base64_padding_attack = token.chars().filter(|&c| c == '=').count() > 4;

        has_path_traversal
            || has_script_injection
            || has_sql_injection
            || has_null_bytes
            || is_extremely_long
            || has_suspicious_algorithm
            || has_base64_padding_attack
    }

    pub fn validate_token_for_refresh(&self, token: &str) -> Result<Claims, AuthError> {
        let mut validation = Self::create_validation();
        validation.leeway = 300;

        match decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.secret_key.as_ref()),
            &validation,
        ) {
            Ok(token_data) => {
                let encrypted_token = hash_token(token);
                attach_encrypted_token_to_current_span(&encrypted_token);

                if token_data.claims.remember_me != Some(true) {
                    let now = Utc::now().timestamp() as usize;
                    let grace_period = 300;
                    if token_data.claims.exp + grace_period < now {
                        return Err(AuthError::TokenExpired);
                    }
                }

                Ok(token_data.claims)
            }
            Err(_) => Err(AuthError::InvalidToken),
        }
    }

    fn create_validation() -> Validation {
        Validation::new(Algorithm::HS256)
    }
}
