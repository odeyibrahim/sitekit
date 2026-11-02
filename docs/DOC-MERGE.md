# Stage 2 design note: one real document instead of stacked iframes
Status: PROPOSAL, awaiting review. Nothing below is built yet.

## What happens today (read from `composePage`)
- Parts from ONE site, unedited: already a plain single page (`emitGroup`), no iframes.
- Edited parts, or parts from MORE THAN ONE site: one `<iframe srcdoc>` per group, sized by a measuring script, stacked inside a wrapper page. This is the "stacked iframes" the report calls out.
- Each extracted copy is self-contained: CSS is scoped under `#sk-<id>`, keyframes are renamed `<id>_<name>`, `@font-face`, `--sk-*` tokens and `pageBg` are carried per part (`copyDoc`).

## Why a merge is feasible
Scoping and keyframe renaming already exist, so most collisions are already prevented. What is missing is only what a frame used to hide.

## Collisions to solve (found by reading the code, not guessed)
1. **Part ids repeat across sites.** `id = 'sk-' + m.id` and `m.id` counts per site, so two sites both have `sk-3`. Fix: namespace as `sk-<siteId>-<id>` at merge time (rename in markup + CSS + keyframes together). Existing tests assert `sk-<id>`, so the rename happens in the merge step, not in the extractor.
2. **Duplicate `@font-face` and `:root` variables.** Dedupe faces by (family, weight, style, src). Site `:root{--x}` rules are not scoped, so they are hoisted into `#sk-<site>-<id>{}` per part (the extractor already carries the used vars per part; to verify on the 16 sites).
3. **Page-level classes.** Rules that targeted `html`/`body` classes were re-scoped by the extractor (REPORT.md bug 2). Keep one `<body>` and put each site's body attrs on the part wrapper, not on `<body>`.
4. **Fixed/sticky layers and `100vh` parts.** In a frame these were pinned to the frame; in one document a fixed menu pins to the page, which is correct, but two fixed menus would overlap. Rule: at most one `nav`-kind fixed layer; extras become `position:static` and are reported.
5. **Ids and anchors inside parts** (`#contact` targets) can duplicate across sites. Reuse the Stage 1 link resolver: de-duplicate ids on merge and rewrite same-document anchors with it.
6. **Scripts.** Site scripts stay out (as now). Stage 3 behaviours attach by `data-sk-behaviour`.

## Proposed build (behind a flag, default off)
`export.mode = "document"` (default stays `"iframes"`, flag-off snapshot test must stay byte-identical, as in Stage 1).
Output: `index.html` + `site.css` (all part CSS, font faces deduped) + `assets/`. One `<body>`, parts in order as `<section id="sk-<site>-<id>">`.

## Acceptance (measured, not claimed)
Render merged document vs. the same parts rendered the old way; compare with the existing blurred-tolerant pixel method on all 16 sites. Report median, mean, count at >=95%, and list every site <85% with the cause. Target is parity with today's iframe output, not parity with the live site (live-site parity is limited by the 114 "approximate" parts from Part check, mostly fixed layers and script-built pages).

## Questions for you before I build
1. Is parity-with-the-iframe-output the right bar for Stage 2, or do you want live-site parity (much harder, depends on Stage 3)?
2. Several fixed menus: keep only the first and flatten the rest (proposed), or keep all?
3. Output as one inline-CSS HTML file (simplest to download) or a folder with `site.css` + assets (cleaner, needed for project export)? Proposed: folder in project mode, single file otherwise.
