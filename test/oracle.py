"""html5lib (WHATWG HTML parsing algorithm, Python) -> same tuple format as engine.js walk()."""
import json, sys, re, os
import html5lib

SVG = '{http://www.w3.org/2000/svg}'
MATH = '{http://www.w3.org/1998/Math/MathML}'

def walk_doc(src):
    doc = html5lib.parse(src, treebuilder='etree', namespaceHTMLElements=False)
    out = []
    m = re.search(r'<!doctype\s+([^\s>]+)', src, re.I)
    if m:
        out.append({"d": 0, "dt": m.group(1).lower()})
    walk_el(doc, 0, out)
    return out

def walk_el(el, d, out):
    if not isinstance(el.tag, str):  # comment node
        out.append({"d": d, "c": el.text or ""})
        return
    tag = el.tag
    ns = 'html'
    if tag.startswith(SVG): ns, tag = 'svg', tag[len(SVG):]
    elif tag.startswith(MATH): ns, tag = 'math', tag[len(MATH):]
    attrs = sorted(el.attrib.items())
    out.append({"d": d, "ns": ns, "tag": tag, "attrs": [list(a) for a in attrs]})
    if el.text:
        out.append({"d": d + 1, "t": el.text})
    for c in el:
        walk_el(c, d + 1, out)
        if c.tail:
            out.append({"d": d + 1, "t": c.tail})

corpus = sys.argv[1]
result = {}
for fn in sorted(os.listdir(corpus)):
    if fn.endswith('.html'):
        result[fn] = walk_doc(open(os.path.join(corpus, fn)).read())
print(json.dumps(result))
