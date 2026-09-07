#!/usr/bin/env node
/* ============================================================
 * build.js - inline css/style.css and every js/ file listed in
 * index.html into one self-contained HTML file.
 *
 *   node build.js               -> egon.html
 *   node build.js out.html      -> out.html
 *   node build.js out.html --body
 *       emits body-only markup (no doctype/html/head/body) for hosts that
 *       supply their own page skeleton.
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const bodyOnly = process.argv.includes('--body');
const out = args[0] || 'egon.html';

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// inline the stylesheet
const cssHref = (html.match(/<link rel="stylesheet" href="([^"]+)">/) || [])[1];
if (cssHref) {
  const css = fs.readFileSync(path.join(root, cssHref), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="[^"]+">/, '<style>\n' + css + '\n</style>');
}

// inline every local script, in the order index.html declares them
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)];
let bytes = 0;
for (const m of scripts) {
  const src = m[1];
  if (/^https?:/.test(src)) continue;
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  bytes += code.length;
  // </script> inside a string literal would end the block early
  const safe = code.replace(/<\/script>/gi, '<\\/script>');
  html = html.replace(m[0], '<script>\n/* ---- ' + src + ' ---- */\n' + safe + '\n</script>');
}

// the web font is a progressive enhancement; drop it so the file works offline
html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, '');
html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com[^"]*" rel="stylesheet">\s*/g, '');

if (bodyOnly) {
  // keep <title> and <style> from the head, drop the page skeleton
  const title = (html.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
  const styles = (html.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
  const body = (html.match(/<body>([\s\S]*)<\/body>/) || ['', html])[1];
  html = title + '\n' + styles + '\n' + body;
}

fs.writeFileSync(path.resolve(root, out), html);
console.log('wrote ' + out + '  (' + scripts.length + ' scripts, ' +
  (bytes / 1024).toFixed(0) + ' KB of JS, ' +
  (fs.statSync(path.resolve(root, out)).size / 1024).toFixed(0) + ' KB total)');
