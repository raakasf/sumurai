/// Case-insensitive glob pattern matching.
/// Supports `*` (any sequence of chars) and `?` (any single char).
pub fn glob_match(pattern: &str, text: &str) -> bool {
    let p: Vec<char> = pattern.to_lowercase().chars().collect();
    let t: Vec<char> = text.to_lowercase().chars().collect();
    matches_glob(&p, &t)
}

fn matches_glob(pattern: &[char], text: &[char]) -> bool {
    match (pattern.first(), text.first()) {
        (None, None) => true,
        (None, Some(_)) => false,
        (Some('*'), _) => {
            // * matches zero chars or advances one char in text
            matches_glob(&pattern[1..], text)
                || (!text.is_empty() && matches_glob(pattern, &text[1..]))
        }
        (Some('?'), Some(_)) => matches_glob(&pattern[1..], &text[1..]),
        (Some(p), Some(t)) if p == t => matches_glob(&pattern[1..], &text[1..]),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_match() {
        assert!(glob_match("hello", "hello"));
        assert!(!glob_match("hello", "world"));
    }

    #[test]
    fn star_prefix() {
        assert!(glob_match("MD DIR ACH CONTRIB*", "MD DIR ACH CONTRIB 042726 000029851959044 171 A6068227701"));
        assert!(!glob_match("MD DIR ACH CONTRIB*", "AMAZON PRIME"));
    }

    #[test]
    fn star_anywhere() {
        assert!(glob_match("*AMAZON*", "AMAZON PRIME"));
        assert!(glob_match("*AMAZON*", "MY AMAZON PURCHASE"));
        assert!(!glob_match("*AMAZON*", "WHOLE FOODS"));
    }

    #[test]
    fn case_insensitive() {
        assert!(glob_match("whole foods*", "WHOLE FOODS MARKET"));
    }

    #[test]
    fn question_mark() {
        assert!(glob_match("A?C", "ABC"));
        assert!(!glob_match("A?C", "AC"));
    }
}
