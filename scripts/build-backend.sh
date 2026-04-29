#!/bin/bash
# The backend now builds natively inside Docker via a multi-stage Dockerfile.
# cross-compilation is no longer used (it caused SIGBUS on Apple Silicon due
# to macOS APFS 16 KB page size vs Linux 4 KB page size when the cross
# container mounted ~/.rustup from the host filesystem).
#
# To rebuild the backend image:
#   docker compose build backend
#
# To rebuild everything and restart:
#   docker compose up --build

echo "The backend builds as part of 'docker compose up --build'."
echo "Run: docker compose build backend"
