#!/usr/bin/env bash
# setup.sh — install the RepoVeriX frontend design stack.
# Safe to re-run. Installs the audit deps (Playwright + Chromium).
# The ui-ux-pro-max skill is already bundled at .claude/skills/ui-ux-pro-max/ — no CLI install needed.
#
# On Windows (PowerShell), run the equivalent commands manually:
#   npm install
#   npx playwright install chromium
set -euo pipefail

cyan() { printf '\033[36m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }

cyan "==> Installing audit dependencies (Playwright)…"
npm install

cyan "==> Installing the Chromium browser for Playwright…"
# Skipped automatically in images that preinstall browsers; harmless to run.
npx playwright install chromium || echo "  (Chromium already present or managed by the environment — continuing.)"

# Verify the ui-ux-pro-max skill is present
if [ -f ".claude/skills/ui-ux-pro-max/scripts/search.py" ]; then
  green "==> ui-ux-pro-max skill found at .claude/skills/ui-ux-pro-max/"
  yellow "    Search script: python .claude/skills/ui-ux-pro-max/scripts/search.py \"<query>\" --domain <domain>"
else
  yellow "==> ui-ux-pro-max skill not found. Install it with:"
  echo "    npx ui-ux-pro-max-cli init --ai claude"
fi

green "==> CLI setup done."
echo
cyan "Steps to finish inside Claude Code (plugins install from the app):"
echo "  1. Enable plugins, then run:"
echo "       /plugin install frontend-design@anthropics/claude-code"
echo "  2. Start Claude Code in this folder — .mcp.json (Playwright + Chrome DevTools + shadcn)"
echo "     and CLAUDE.md load automatically. Approve the MCP servers when prompted."
echo "  3. Verify MCP servers: /mcp"
echo
echo "Optional add-ons: see docs/SETUP.md (Figma Dev Mode MCP, 21st.dev Magic MCP)."
