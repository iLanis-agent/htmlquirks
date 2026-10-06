# HTMLQuirks

Your HTML is not what you wrote - it is what the parser built. Paste markup and see
the tree the browser's real HTML5 parser constructs, plus every spec rule that
silently rewrote your source: foster parenting, auto-closed paragraphs, the phantom
tbody, rawtext vs RCDATA, void-element end tags, the stray-`</p>` phantom paragraph,
duplicate attributes, case folding, SVG foreign content and breakout tags, quirks
mode, and the adoption agency for misnested formatting elements.

## Files

- `index.html` - landing page
- `app.html` - the parser playground (paste HTML or load one of 12 tricky presets)
- `engine.js` - UMD: browser DOMParser wrapper + pure tree walk / quirk detectors
- `test/corpus/*.html` - 12 tricky inputs covering each quirk
- `test/oracle.py` - html5lib (the independent Python implementation of the WHATWG
  HTML parsing algorithm) emitting the same tree-tuple format as `engine.js` walk()
- `test/gen_expected.py` - regenerates `test/expected.json` (oracle tuples +
  hand-authored expected quirk notes per input)
- `test/run_tests.js` - node CI: expected.json matches the live oracle (drift
  guard), walk/count/render fixtures, and every expected quirk note fires on the
  real corpus source (35 checks)
- `test/browser_check.js` - live cross-check, run in the deployed page: the
  BROWSER's parser vs the html5lib oracle on all 12 inputs, tuple-for-tuple,
  plus expected quirk notes (31 checks, all passing on the live site)

Run the node tests:

    node test/run_tests.js

## Scope

The engine IS the browser's parser (DOMParser); the quirk notes are heuristic
detectors over source + tree, tuned to the constructs above and cross-checked
on the corpus. `document.compatMode` is browser-reported (the oracle has no
equivalent); it is verified through the doctype corpus cases. Scripted DOM APIs
(innerHTML) can differ from DOMParser in edge cases; only DOMParser is checked.
