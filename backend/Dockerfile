# syntax=docker/dockerfile:1.4
# Multi-stage build — Rust compiles natively inside Docker.
# Replaces the cross-compilation workflow that SIGBUSes on Apple Silicon
# because cross mounts macOS APFS (16 KB pages) and the Linux linker mmap-s
# .so files from it (expects 4 KB pages).

# ── Stage 1: build the app ───────────────────────────────────────────────────
FROM --platform=linux/amd64 rust:slim AS builder

RUN --mount=type=cache,target=/var/lib/apt,sharing=locked \
    --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        pkg-config \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Dependency-cache layer: copy manifests only and build a stub binary so that
# all crate downloads + compilation are cached in a Docker layer that only
# busts when Cargo.toml / Cargo.lock change.
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs \
    && cargo build --release \
    && rm -rf src

# Real source build — only the project crate recompiles.
COPY backend/src ./src
RUN touch src/main.rs && cargo build --release

# ── Stage 2: build sqlx-cli (cached separately so it doesn't bust with app) ─
FROM --platform=linux/amd64 rust:slim AS sqlx-builder

RUN --mount=type=cache,target=/var/lib/apt,sharing=locked \
    --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        pkg-config \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install sqlx-cli --version 0.7.4 --no-default-features --features native-tls,postgres

# ── Stage 3: runtime image ───────────────────────────────────────────────────
FROM --platform=linux/amd64 ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

RUN --mount=type=cache,target=/var/lib/apt,sharing=locked \
    --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        libssl3 \
        postgresql-client \
        curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash appuser

COPY --from=sqlx-builder /usr/local/cargo/bin/sqlx /usr/local/bin/sqlx

WORKDIR /app
COPY --chown=appuser:appuser backend/migrations ./migrations
COPY --from=builder --chown=appuser:appuser --chmod=755 \
    /build/target/release/sumurai-backend ./sumurai-backend

USER appuser
EXPOSE 3000
CMD ["./sumurai-backend"]
