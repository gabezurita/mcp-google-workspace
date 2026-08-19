#!/usr/bin/env bash
# Launcher for the mcp-google-workspace stdio MCP server.
#
# Exists for one reason: the server resolves .gauth.json and .accounts.json
# with path.resolve(process.cwd(), ...) (dist/services/gauth.js), so it only
# finds its credentials when started from this directory. MCP clients launch
# servers from an arbitrary cwd -- the workspace root, or /.
#
# slowbuffer-compat.cjs is preloaded to keep googleapis loadable on Node >= 25;
# see that file for why. Any Node version works with it in place.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

exec /opt/homebrew/bin/node --require ./slowbuffer-compat.cjs ./dist/server.js
