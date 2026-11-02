#!/bin/sh
# Builds the tool and runs every suite. Non-zero exit if anything fails.   Usage: sh tests/run_all.sh
cd "$(dirname "$0")/.." || exit 1
python3 tests/make_fixtures.py >/dev/null && node build.js || exit 1
rc=0; total=0
for t in ui look edit edit2 lazy ids links snapshot project undo wrapper router reveal seg behaviours document; do
  printf '%-9s ' "$t"; out=$(node tests/$t.test.js 2>&1 | grep -E "[0-9]+ passed")
  [ -n "$out" ] && echo "$out" || { echo FAILED; rc=1; }
  case "$out" in *" 0 failed"*) ;; *) rc=1;; esac
done
exit $rc
