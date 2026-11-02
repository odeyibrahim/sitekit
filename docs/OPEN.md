# Open items after Stage 0
- 0.1 not runnable: the 10 original sample sites are not in the project (only 6 invented fixtures). Re-run `node eval/partcheck.js <dir> <out.csv>` when they are supplied.
- Blind-test / dial-audit / font-reach tests (tests/blind, dial_audit.js, font_reach.js) are not in the project, so the 78-82% classifier numbers and the 97%/100% font numbers were not re-measured here.
- Lazy images: standard patterns (data-src, data-srcset, data-lazy-src, picture/source, data-bg, loading=lazy) are now promoted. Script-keyed images are NOT: dria-ventures (246 `data-img="I0"` placeholders filled by its own JS) and outfit-hellohello (6 `data-imgkey` images with no src). That is Stage 3 (behaviours) territory.
- On the saved real sites lazy attributes are rare (browser "save page" output already has real src): only charlesalexandertv (28 promotions) hit the new code path.
- Part-check run (eval/partcheck-16.csv) predates the lazy pass and the 16-site link audit; re-run both after Stage 1.

# Stage 2/3 findings (live-site bar, 16 saved sites; eval/merge-scores.csv, eval/merge-summary.txt)
Blurred pixel match vs the saved page rendered WITH its scripts, offline, same scroll pass for every variant, fresh browser per site.
| variant | median | mean | >=95 | <85 |
|---|---|---|---|---|
| plain (single-site export, original markup) | 99.9 | 94.7 | 11 | 4 |
| doc, before segmentation/reveal work | 74.0 | 69.5 | 3 | 10 |
| doc, after (behaviours off) | 75.2 | 76.4 | 3 | 10 |
| doc, after (behaviours on) | 75.2 | 76.4 | 3 | 10 |
Part check (eval/partcheck-16-final.csv): 187 parts, 48 exact, 139 approximate, 7 scripted sites (before: 158 / 43 / 115 / 5).
Measurement fix: the merge harness reused one browser page for all sites, which made script-built sites segment differently depending on run order (nshine 1 part vs 4). It now uses a fresh browser per site. The earlier "coverage" finding for nshine and charlesalexandertv was this artefact; only dria-ventures was a real coverage failure.
Changes this round:
- Client-side routers (dria-ventures): the route the script would show is switched on (src/spa.js, 9 tests). dria 3.9 -> 64.7. Pages that only exist after scripts run keep the scripted path (nshine, charlesalexandertv); a route group whose saved markup already marks an active page is left alone.
- Text hidden only until a script fades it in (src/reveal.js, 8 tests): bunkrdesign 27.1 -> 76.3, nova-dental 66.2 -> 68.0. Popups, menus, tooltips, aria-hidden, tab panels and non-current slides stay hidden. Costs: sukumarswain 59.3 -> 57.1 (66 elements revealed on a Wix page; some probably hidden on purpose).
- Reveal CSS applies in document mode only; the Look dialog's extracted copy and flag-off exports are unchanged (plain export strips the marker).
Still open: lesintranquilles layout (66), wearestructure line-wrap drift (74), layered-slider caught mid-animation (29.6), mrc-residences (59.5), sukumarswain (57), hover/hotspot details on nova. Behaviours are measured by tests/behaviours.test.js, not by this table.
Process note: two workers edited src/template.html and tests at the same time (a coverage probe + scripted re-read, and my route activation). Both are kept and both pass; tests/fixtures/spa.html was overwritten once and recreated from tests/seg.test.js's expectations; my fixtures are now router*.html.
