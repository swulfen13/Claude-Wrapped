'use strict';
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'report');
const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

/** Builds one self-contained HTML file. Only fonts are loaded from the web; everything else is inline. */
function renderHtml(stats, meta) {
  const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
  const js = ['charts.js', 'card.js', 'client.js'].map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  return `<!DOCTYPE html>
<html lang="${meta.lang === 'de' ? 'de' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude Code Wrapped</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<main id="app"></main>
<script>const DATA = ${safeJson(stats)}; const META = ${safeJson(meta)};</script>
<script>${js}</script>
</body>
</html>
`;
}

module.exports = { renderHtml };
