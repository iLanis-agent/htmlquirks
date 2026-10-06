"""Generate test/expected.json: html5lib oracle tuples + hand-authored expected quirk notes (WHATWG spec semantics)."""
import json, subprocess, os

NOTES = {
  'minimal.html':    ['No <html> tag', 'Standards mode'],
  'no-doctype.html': ['Quirks mode'],
  'p-div.html':      ['<p> auto-closed', 'Standards mode'],
  'li-auto.html':    ['Optional end tags'],
  'foster.html':     ['Foster parenting', 'never wrote <tbody>'],
  'void-stray.html': ['does NOT close anything', 'Stray </p>'],
  'rawtext.html':    ['<script> is rawtext', '<style> is rawtext'],
  'rcdata.html':     ['RCDATA'],
  'dupattr.html':    ['Duplicate attribute', 'Case folding'],
  'tbody.html':      ['never wrote <tbody>'],
  'svg.html':        ['Foreign content', 'Breakout'],
  'misnest.html':    ['adoption agency'],
}
tuples = json.loads(subprocess.check_output(['python3', 'test/oracle.py', 'test/corpus']))
out = {}
for fn, tp in tuples.items():
    assert fn in NOTES, 'missing expected notes for ' + fn
    out[fn] = {'tuples': tp, 'notes': NOTES[fn]}
json.dump(out, open('test/expected.json', 'w'))
print('expected.json:', len(out), 'files,', sum(len(v['tuples']) for v in out.values()), 'tuples')
