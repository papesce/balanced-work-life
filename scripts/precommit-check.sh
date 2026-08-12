#!/bin/sh
set -e

staged_files=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(css|js|jsx|json|md|mjs|ts|tsx|yaml|yml)$' || true)

if [ -n "$staged_files" ]; then
  echo "$staged_files" | xargs pnpm exec prettier --check
fi

pnpm lint
pnpm exec tsc --noEmit
