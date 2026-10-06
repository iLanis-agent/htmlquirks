// Node CI: (1) expected.json matches the html5lib oracle exactly (guards drift),
// (2) engine walk/count/render behave on DOM-shaped fixtures,
// (3) every expected quirk note is produced by detect() on a minimal fake DOM.
const { execFileSync } = require('child_process');
const fs = require('fs');
const H = require('../engine.js');

let checked = 0, fails = 0;
function ok(cond, label) { checked++; if (!cond) { fails++; if (fails <= 8) console.log('FAIL', label); } }

// (1) oracle drift guard
const expected = JSON.parse(fs.readFileSync('test/expected.json', 'utf8'));
const live = JSON.parse(execFileSync('python3', ['test/oracle.py', 'test/corpus']).toString());
for (const fn of Object.keys(expected)) {
  ok(JSON.stringify(expected[fn].tuples) === JSON.stringify(live[fn]), 'oracle tuples ' + fn);
}
ok(Object.keys(live).length === 12, 'corpus size 12');

// (2) fixture for walk/count/render
function el(tag, kids, attrs, ns) {
  kids = kids || [];
  return { nodeType: 1, localName: tag, namespaceURI: ns || H.NS.html, attributes: attrs || [], childNodes: kids,
    textContent: kids.map(function (k) { return k.data || ''; }).join('') };
}
function txt(t) { return { nodeType: 3, data: t }; }
const doc = { nodeType: 9, compatMode: 'CSS1Compat', doctype: { name: 'html' }, childNodes: [
  el('html', [el('body', [txt('hi'), el('br'), { nodeType: 8, data: ' c ' }], [{ name: 'id', value: 'b' }])])
]};
const w = H.walk(doc);
ok(w.length === 6 && w[0].dt === 'html' && w[1].tag === 'html' && w[2].tag === 'body' && w[4].tag === 'br' && w[5].c === ' c ', 'walk fixture');
const c = H.countNodes(w);
ok(c.elements === 3 && c.text === 1 && c.comments === 1, 'countNodes fixture');
const r = H.render(w);
ok(r.includes('<!doctype html>') && r.includes('<body id="b">') && r.includes('<!-- c -->'), 'render fixture');

// (3) detector coverage: every expected note must fire on the real corpus source,
// using fake DOMs for the tree-dependent checks.
const SRC = {};
for (const fn of Object.keys(expected)) SRC[fn] = fs.readFileSync('test/corpus/' + fn, 'utf8');

function fakeDoc(opts) {
  opts = opts || {};
  const d = { nodeType: 9, compatMode: opts.compatMode || 'CSS1Compat', doctype: opts.doctype || null, childNodes: [],
    getElementsByTagName: function (n) { return opts.tags && opts.tags[n] || []; },
    querySelectorAll: function (s) { return (opts.qsa && opts.qsa[s]) || []; } };
  return d;
}
const FAKES = {
  'minimal.html': fakeDoc({}),
  'no-doctype.html': fakeDoc({ compatMode: 'BackCompat' }),
  'p-div.html': fakeDoc({ doctype: { name: 'html' } }),
  'li-auto.html': fakeDoc({ doctype: { name: 'html' } }),
  'foster.html': fakeDoc({ doctype: { name: 'html' }, tags: { tbody: [el('tbody')] } }),
  'void-stray.html': fakeDoc({ doctype: { name: 'html' } }),
  'rawtext.html': fakeDoc({ doctype: { name: 'html' }, tags: { script: [el('script', [txt('if (a < b) { x = "<p>"; }')])], style: [el('style', [txt('p > b {}')])] } }),
  'rcdata.html': fakeDoc({ doctype: { name: 'html' }, qsa: { 'title,textarea': [el('title'), el('textarea')] } }),
  'dupattr.html': fakeDoc({ doctype: { name: 'html' } }),
  'tbody.html': fakeDoc({ doctype: { name: 'html' }, tags: { tbody: [el('tbody')] } }),
  'svg.html': fakeDoc({ doctype: { name: 'html' } }),
  'misnest.html': fakeDoc({ doctype: { name: 'html' } }),
};
for (const fn of Object.keys(expected)) {
  const notes = H.detect(FAKES[fn], SRC[fn]).map(n => n.text).join('\n');
  for (const want of expected[fn].notes) {
    ok(notes.includes(want), 'note "' + want + '" in ' + fn);
  }
}
console.log(`checked=${checked} fails=${fails}`);
process.exit(fails ? 1 : 0);
