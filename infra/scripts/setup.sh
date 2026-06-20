#!/usr/bin/env bash
# Local dev bootstrap.
#
# The repo is NOT yet npm-workspace-linked across frontend/admin/cf-pipeline
# (each has its own package-lock.json — see docs/MIGRATION_STATUS.md), so
# this just installs each independently rather than assuming `npm install`
# at root covers everything.
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root_dir"

echo "==> root (packages/* workspace + convex)"
npm install

echo "==> frontend"
(cd frontend && npm ci)
[ -f frontend/.env.local ] || { cp frontend/.env.example frontend/.env.local 2>/dev/null && echo "    created frontend/.env.local from .env.example — fill in real values"; }

echo "==> admin"
(cd admin && npm ci)

echo "==> cf-pipeline"
(cd cf-pipeline && npm ci)

echo "==> signal-worker (Python)"
if command -v python3 >/dev/null; then
  (cd signal-worker && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt)
  [ -f signal-worker/.env ] || { cp signal-worker/.env.example signal-worker/.env 2>/dev/null && echo "    created signal-worker/.env from .env.example — fill in real values"; }
else
  echo "    skipped — python3 not found"
fi

echo "==> done. See docs/deployment/README.md (once written) or .env.example files for required env vars."
