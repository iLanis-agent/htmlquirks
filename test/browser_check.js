// Live cross-check: run in the deployed app's page (execute-js or console).
// Parses every corpus file with the BROWSER's real HTML parser (DOMParser)
// and compares the tree tuples against the independent html5lib oracle
// (test/expected.json), plus expected quirk notes. Both implement the
// WHATWG HTML parsing algorithm; this proves they agree on the corpus.
(async function () {
  const base = document.querySelector('base') ? document.querySelector('base').href : location.href.replace(/[^/]*$/, '');
  const expected = await (await fetch(base + 'test/expected.json')).json();
  let checked = 0, fails = [];
  for (const fn of Object.keys(expected)) {
    const src = await (await fetch(base + 'test/corpus/' + fn)).text();
    const doc = HTMLQuirks.parseDocument(src);
    const tuples = HTMLQuirks.walk(doc);
    checked++;
    if (JSON.stringify(tuples) !== JSON.stringify(expected[fn].tuples)) {
      fails.push('TUPLES ' + fn);
    }
    const notes = HTMLQuirks.detect(doc, src).map(n => n.text).join('\n');
    for (const want of expected[fn].notes) {
      checked++;
      if (!notes.includes(want)) fails.push('NOTE "' + want + '" in ' + fn);
    }
  }
  return 'browser-vs-oracle: checked=' + checked + ' fails=' + JSON.stringify(fails);
})()
