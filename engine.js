/* HTMLQuirks engine: parse HTML with the browser's real HTML parser (DOMParser),
   walk the resulting tree into comparable tuples, and explain the quirks that
   fired. Pure tree functions work in node on DOM-shaped fixtures. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HTMLQuirks = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NS = { html: 'http://www.w3.org/1999/xhtml', svg: 'http://www.w3.org/2000/svg',
             math: 'http://www.w3.org/1998/Math/MathML' };
  function nsOf(node) {
    var u = node.namespaceURI;
    if (u === NS.svg) return 'svg';
    if (u === NS.math) return 'math';
    return 'html';
  }

  // DOMParser parse (browser only). Returns a Document.
  function parseDocument(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // Pure tree walk -> tuple list. Node kinds: document(9), element(1), text(3), comment(8).
  function walk(node, depth, out) {
    out = out || []; depth = depth || 0;
    var t = node.nodeType;
    if (t === 9) {
      if (node.doctype && node.doctype.name) out.push({ d: depth, dt: String(node.doctype.name).toLowerCase() });
      walkChildren(node, depth, out);
    } else if (t === 1) {
      var attrs = [], at = node.attributes || [];
      for (var i = 0; i < at.length; i++) attrs.push([at[i].name, at[i].value]);
      attrs.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
      out.push({ d: depth, ns: nsOf(node), tag: String(node.localName || node.tagName), attrs: attrs });
      walkChildren(node, depth + 1, out);
    } else if (t === 3) {
      out.push({ d: depth, t: node.data });
    } else if (t === 8) {
      out.push({ d: depth, c: node.data });
    }
    return out;
  }
  function walkChildren(node, depth, out) {
    var kids = node.childNodes || [];
    for (var i = 0; i < kids.length; i++) walk(kids[i], depth, out);
  }

  function countNodes(tuples) {
    var el = 0, tx = 0, cm = 0;
    for (var i = 0; i < tuples.length; i++) {
      if (tuples[i].tag) el++; else if (tuples[i].t !== undefined) tx++; else if (tuples[i].c !== undefined) cm++;
    }
    return { elements: el, text: tx, comments: cm };
  }

  function hasRe(re, src) { return re.test(src); }

  // Quirk detectors. doc may be a Document or any DOM-shaped node; source is the raw HTML.
  function detect(doc, source) {
    var notes = [];
    var src = source;
    function push(sev, text) { notes.push({ sev: sev, text: text }); }

    if (doc.compatMode === 'BackCompat') {
      push('warn', 'Quirks mode (document.compatMode is BackCompat): no doctype or a legacy one - the browser falls back to 1990s layout rules: IE5 box model, table cell font inheritance off, class/id matching becomes case-insensitive.');
    } else if (hasRe(/<!doctype/i, src)) {
      push('ok', 'Standards mode: the doctype switched the parser and layout engine onto modern rules.');
    }

    if (!hasRe(/<html[\s>]/i, src)) push('info', 'No <html> tag in your source - the parser implied <html>, <head> and <body> around your content. Browsers always build a full document.');
    if (hasRe(/<table[\s>]/i, src) && !hasRe(/<tbody/i, src)) {
      var tb = doc.getElementsByTagName ? doc.getElementsByTagName('tbody') : [];
      if (tb.length > 0) push('info', 'You never wrote <tbody>, but the parser inserted one: rows always live inside a tbody (or thead/tfoot) in the tree. A selector like "table > tr" matches nothing.');
    }

    var foster = /<table[^>]*>([\s\S]*?)(<t[rhd]|<thead|<tbody|<caption|<colgroup|$)/i.exec(src);
    if (foster && /[^\s]/.test(foster[1].replace(/<!--[\s\S]*?-->/g, ''))) {
      push('warn', 'Foster parenting: text before the first row cannot live inside a table, so the parser moved it OUT - it appears before the table in the tree, ahead of the markup that surrounded it.');
    }

    var pm = /<p[^>]*>[\s\S]{0,400}<(div|table|h[1-6]|ul|ol|section|article|blockquote|pre|p)[\s>]/i.exec(src);
    if (pm) {
      push('warn', '<p> auto-closed: a <p> cannot contain <' + pm[1].toLowerCase() + '>. The parser closed the paragraph early, so the ' + pm[1].toLowerCase() + ' is its sibling, not its child - a common source of "mystery" margins and broken selectors.');
    }

    var liOpen = (src.match(/<li[\s>]/gi) || []).length, liClose = (src.match(/<\/li\s*>/gi) || []).length;
    if (liOpen > liClose) push('info', 'Optional end tags: you wrote ' + liOpen + ' <li> but ' + liClose + ' </li>. The parser closed each item when the next one opened - the tree is still a flat list, exactly as if you had closed them.');

    var voidEnd = /<\/(br|img|hr|input|meta|link|wbr|area|base|col|embed|source|track)\s*>/i.exec(src);
    if (voidEnd && voidEnd[1].toLowerCase() === 'br') {
      push('warn', '</br> does NOT close anything: per spec, an end tag named "br" is treated as a <br> start tag - it INSERTS another line break. "</br>" in your source means one extra <br> in the tree (see the doubled br below).');
    } else if (voidEnd) {
      push('info', '</' + voidEnd[1].toLowerCase() + '> ignored: ' + voidEnd[1].toLowerCase() + ' is a void element - it can have no content and no end tag. The stray end tag was dropped.');
    }

    var pOpen = (src.match(/<p[\s>]/gi) || []).length, pClose = (src.match(/<\/p\s*>/gi) || []).length;
    if (pClose > pOpen) {
      push('warn', 'Stray </p> with no open paragraph: the parser did not drop it - it created an EMPTY <p> element ("insert an HTML element for a p end tag with no p in scope"). Your document gained a phantom paragraph.');
    }

    var docScripts = doc.getElementsByTagName ? doc.getElementsByTagName('script') : [];
    for (var i = 0; i < docScripts.length; i++) {
      if (docScripts[i].textContent.indexOf('<') !== -1) {
        push('info', '<script> is rawtext: markup-looking text inside ("' + docScripts[i].textContent.trim().slice(0, 40).replace(/\n/g, ' ') + '...") is just text - the parser does not build elements until </script>. That is why a literal "</script>" inside a string breaks pages.');
        break;
      }
    }
    var styles = doc.getElementsByTagName ? doc.getElementsByTagName('style') : [];
    for (var j = 0; j < styles.length; j++) {
      if (styles[j].textContent.indexOf('<') !== -1 || styles[j].textContent.indexOf('>') !== -1) {
        push('info', '<style> is rawtext too: ">" and "<" in selectors are text. Entities like &amp; are NOT decoded here - CSS is read literally.');
        break;
      }
    }
    var rc = doc.querySelectorAll ? doc.querySelectorAll('title,textarea') : [];
    for (var k = 0; k < rc.length; k++) {
      var tn = rc[k].localName;
      if (hasRe(new RegExp('<' + tn + '[\\s>][\\s\\S]*(&\\w+;|&lt;|<\\w)', 'i'), src)) {
        push('info', '<' + tn + '> is RCDATA: entities are decoded (&lt; becomes <) but tags are NOT parsed - "<div>" inside a ' + tn + ' is text, not an element. Entities in turn are not decoded in rawtext script/style.');
      }
    }

    var tagRe = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=\/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)+)\s*\/?>/g, tm;
    var dupFound = null;
    while ((tm = tagRe.exec(src)) !== null) {
      var attrRe = /([^\s=\/>]+)/g, am, seen = {}, attrs2 = tm[2];
      while ((am = attrRe.exec(attrs2)) !== null) {
        var n = am[1].toLowerCase();
        if (seen[n]) { dupFound = { tag: tm[1].toLowerCase(), attr: n }; break; }
        seen[n] = true;
      }
      if (dupFound) break;
    }
    if (dupFound) push('warn', 'Duplicate attribute "' + dupFound.attr + '" on <' + dupFound.tag + '>: the FIRST occurrence wins - later ones are silently dropped. Check which value actually landed in the tree.');

    if (hasRe(/<[A-Z][A-Z0-9]*[\s>\/]/, src)) push('info', 'Case folding: HTML tag and attribute names are ASCII-lowercased during parsing (<DIV> becomes div). In the DOM, only SVG/MathML elements keep their camelCase (like foreignObject).');

    var svgBlock = /<svg[\s>][\s\S]*?(<\/(svg|p|div|h[1-6]|table|ul|ol|li|br|b|i|em|strong|span|pre|blockquote|body|head|img|hr|dd|dt)\s*>|<\/svg\s*>)/i.exec(src);
    if (hasRe(/<svg[\s>]/i, src)) {
      push('info', 'Foreign content: inside <svg> the parser switches namespaces - self-closing syntax (<circle/>) genuinely closes the element there, unlike HTML where the slash is ignored.');
    }
    var breakout = /<svg[^>]*>[\s\S]{0,500}<(p|div|h[1-6]|table|ul|ol|li|br|b|i|em|strong|span|pre|blockquote|img|hr|dd|dt)[\s>\/]/i.exec(src);
    if (breakout) {
      push('warn', 'Breakout: <' + breakout[1].toLowerCase() + '> is on the foreign-content breakout list. Inside <svg>, it forcibly CLOSES the svg - the element after it is HTML again, and your "inside the svg" markup lands outside it.');
    }

    if (hasRe(/<(b|i|em|strong|a|span)[^>]*>\s*<(b|i|em|strong)[^>]*>[\s\S]*<\/\1\s*>/i, src)) {
      push('warn', 'Misnested formatting elements: the adoption agency algorithm re-parents them - </b> closes the <i> first, then re-opens formatting for the trailing text. The tree differs from the nesting you wrote.');
    }

    return notes;
  }

  // Render tuples as an indented, human-readable tree.
  function render(tuples) {
    return tuples.map(function (t) {
      var pad = new Array(t.d + 1).join('  ');
      if (t.dt !== undefined) return pad + '<!doctype ' + t.dt + '>';
      if (t.tag) {
        var a = t.attrs.map(function (kv) { return kv[0] + '="' + kv[1] + '"'; }).join(' ');
        return pad + '<' + (t.ns && t.ns !== 'html' ? t.ns + ':' : '') + t.tag + (a ? ' ' + a : '') + '>';
      }
      if (t.t !== undefined) return pad + '"' + t.t.replace(/\n/g, '\\n') + '"';
      return pad + '<!--' + t.c + '-->';
    }).join('\n');
  }

  return { parseDocument: parseDocument, walk: walk, countNodes: countNodes, detect: detect, render: render, NS: NS };
});
