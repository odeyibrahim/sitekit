# Baseline (before any Stage 1+ change)
Run: `python3 tests/make_fixtures.py && node build.js && node tests/{ui,look,edit,edit2}.test.js`
| suite | passed | failed |
|---|---|---|
| ui | 41 | 0 |
| look | 29 | 0 |
| edit | 27 | 0 |
| edit2 | 37 | 0 |
| **total** | **134** | **0** |

Not restored in this workspace (files are not in the project): tests/blind/score.js, labels json, dial_audit.js, font_reach.js, so the blind-test and dial/font numbers in REPORT.md were NOT re-measured.
The "10 original sample sites" are not in the project (only the 6 invented fixtures alpha, beta, gamma, delta, risky, pics), so Stage 0.1 cannot be run.
