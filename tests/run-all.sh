#!/bin/sh
# Lance toutes les suites. Usage : PLAYWRIGHT=/chemin/playwright sh tests/run-all.sh
cd "$(dirname "$0")/.." || exit 1
fail=0
for f in tests/*.js; do
  case "$f" in tests/demo-hook.js) continue;; esac
  if [ "$f" = "tests/production.js" ]; then r=$(node "$f" 2>&1)
  else r=$(NODE_OPTIONS="--require ./tests/demo-hook.js" node "$f" 2>&1); fi
  echo "$f :: $(echo "$r" | grep -E 'RÉSULTAT' | tail -1)"
  echo "$r" | grep -qE "RÉSULTAT.* 0 échecs" || fail=1
done
exit $fail
