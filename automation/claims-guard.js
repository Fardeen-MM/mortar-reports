#!/usr/bin/env node
/**
 * claims-guard.js — blocks claims Mortar can't substantiate from ever shipping in a report.
 *
 * Banned (all verified false or unsupported, 2 Oct 2026 audit):
 *   - "30 qualified leads in 30 days or we work for free"  (a guarantee we never offered)
 *   - "Our clients typically see $5–$10 back for every $1"  (no data behind it)
 *   - the "We've done this before" Mandall case study      (Mandall is immigration; the $92K/mo result is invented)
 *   - story blocks with invented scenes ("Tuesday, 7:48 PM … He's their client now")
 *
 * Usage:
 *   node claims-guard.js                 scan every report index.html in the repo
 *   node claims-guard.js file1.html ...  scan specific files
 *   node claims-guard.js --generator     scan the generator source as well
 * Exit code 1 if anything banned is found.
 */
const fs = require('fs');
const path = require('path');

const BANNED = [
  { name: 'work-for-free guarantee', re: /work(?:ing)? (?:for )?free|at no cost until we hit it/i },
  { name: 'unsupported ROI claim', re: /back for every\s*(?:\$|&#36;|\\u0024|\$\{currency\})?\s*1\b/i },
  { name: 'invented case study', re: /We(?:'|&#39;|’)ve done this before|class="case-study/i },
  { name: 'invented scene block', re: /class="story-(?:mini|section)\b/i },
  { name: 'invented proof stats', re: /class="proof-grid\b|built this \d+ times/i },
  { name: 'unsupported results claim', re: /We(?:'|&#39;|’)ve helped (?:firms|partners|practitioners|professional)|Across our portfolio/i },
  { name: 'contradicts 3-month commitment', re: /No long-term contracts|catch with month-to-month|Month-to-month, cancel anytime|<strong>Month to month<\/strong>/i },
  { name: 'invented scene timestamp', re: /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+\d{1,2}:\d{2}\s*(?:AM|PM)\b/i },
];

function scanText(text) {
  const hits = [];
  for (const b of BANNED) {
    const m = text.match(b.re);
    if (m) hits.push(`${b.name}: "${m[0]}"`);
  }
  return hits;
}

function findReports(root) {
  const out = [];
  const skip = new Set(['.git', 'node_modules', 'automation', 'cloudflare-worker', '.github']);
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!skip.has(e.name)) walk(path.join(dir, e.name)); }
      else if (e.name === 'index.html' && dir !== root) out.push(path.join(dir, e.name));
    }
  })(root);
  return out;
}

module.exports = { scanText, BANNED };

if (require.main === module) {
  const args = process.argv.slice(2);
  const root = path.resolve(__dirname, '..');
  const files = args.filter(a => !a.startsWith('--'));
  const targets = files.length ? files : findReports(root);
  if (args.includes('--generator')) targets.push(path.join(__dirname, 'report-generator-v3.js'));
  let bad = 0;
  for (const f of targets) {
    const hits = scanText(fs.readFileSync(f, 'utf8'));
    if (hits.length) { bad++; console.log(`FAIL ${path.relative(root, f)}\n  - ${hits.join('\n  - ')}`); }
  }
  console.log(`\nclaims-guard: ${targets.length} file(s) scanned, ${bad} with banned claims`);
  process.exit(bad ? 1 : 0);
}
