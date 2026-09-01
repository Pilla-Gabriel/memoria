#!/bin/sh
# Wrapper so the bundled Node.js runtime (this machine has no system-wide
# Node install) is on PATH for the dev server AND any child processes it
# spawns (Turbopack's PostCSS worker pool spawns its own "node" via PATH).
export PATH="/Users/onclick/.local/node-runtime/node-v24.20.0-darwin-arm64/bin:$PATH"
cd "$(dirname "$0")/.."
exec node node_modules/tsx/dist/cli.mjs watch server.ts
