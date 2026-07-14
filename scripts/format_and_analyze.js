#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function maxDepth(obj) {
  if (obj === null || typeof obj !== 'object') return 0;
  if (Array.isArray(obj)) {
    let m = 0;
    for (const v of obj) m = Math.max(m, maxDepth(v));
    return 1 + m;
  }
  let m = 0;
  for (const k of Object.keys(obj)) m = Math.max(m, maxDepth(obj[k]));
  return 1 + m;
}

function countViewNodes(node) {
  if (!node || typeof node !== 'object') return 0;
  let count = 0;
  if (node.type) count = 1;
  const children = node.children || [];
  for (const c of children) count += countViewNodes(c);
  return count;
}

function safeGet(o, pathArr) {
  try {
    let cur = o;
    for (const p of pathArr) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  } catch (e) {
    return undefined;
  }
}

if (process.argv.length < 3) {
  console.error('Usage: node scripts/format_and_analyze.js <input.json>');
  process.exit(2);
}

const infile = process.argv[2];
if (!fs.existsSync(infile)) {
  console.error('File not found:', infile);
  process.exit(2);
}
const raw = fs.readFileSync(infile, 'utf8');
let obj;
try {
  obj = JSON.parse(raw);
} catch (e) {
  console.error('JSON parse error:', e.message);
  process.exit(2);
}

const pretty = JSON.stringify(obj, null, 2);
const outPretty = infile.replace(/\.json$/i, '_pretty.json');
fs.writeFileSync(outPretty, pretty, 'utf8');

// Analysis
const stats = fs.statSync(infile);
const analysis = [];
analysis.push('File: ' + infile);
analysis.push('Size: ' + stats.size + ' bytes');
analysis.push('Pretty JSON: ' + outPretty);

const topKeys = Object.keys(obj);
analysis.push('Top-level keys: ' + topKeys.join(', '));
analysis.push('Top-level key count: ' + topKeys.length);
analysis.push('Max object depth: ' + maxDepth(obj));

// Try to detect viewTree nodes
let totalViewNodes = 0;
const fromViewRoot = safeGet(obj, ['from','viewTree','root']);
const toViewRoot = safeGet(obj, ['to','viewTree','root']);
if (fromViewRoot) totalViewNodes += countViewNodes(fromViewRoot);
if (toViewRoot) totalViewNodes += countViewNodes(toViewRoot);
if (totalViewNodes > 0) analysis.push('Estimated total view nodes (from+to): ' + totalViewNodes);

const eventType = safeGet(obj, ['event','type']) || safeGet(obj, ['type']);
if (eventType) analysis.push('Event type: ' + eventType);

const fromAbility = safeGet(obj, ['from','abilityName']) || safeGet(obj, ['from','ability']);
const toAbility = safeGet(obj, ['to','abilityName']) || safeGet(obj, ['to','ability']);
if (fromAbility) analysis.push('From ability: ' + fromAbility);
if (toAbility) analysis.push('To ability: ' + toAbility);

const fromPage = safeGet(obj, ['from','pagePath']);
const toPage = safeGet(obj, ['to','pagePath']);
if (fromPage) analysis.push('From pagePath: ' + fromPage);
if (toPage) analysis.push('To pagePath: ' + toPage);

const fromCap = safeGet(obj, ['from','snapshot','screenCapPath']);
const toCap = safeGet(obj, ['to','snapshot','screenCapPath']);
if (fromCap) analysis.push('From screenCap: ' + fromCap);
if (toCap) analysis.push('To screenCap: ' + toCap);

// Summarize first-level differences between from and to (common keys)
const diffs = [];
for (const k of topKeys) {
  if (k === 'from' || k === 'to') continue;
}

// Provide a short sample of 'to' top-level structure (first 200 chars)
try {
  const sample = JSON.stringify(obj.to || obj, null, 2).slice(0, 2000);
  analysis.push('Sample of `to` (truncated):');
  analysis.push(sample);
} catch (e) {}

const outAnalysis = infile.replace(/\.json$/i, '.analysis.txt');
fs.writeFileSync(outAnalysis, analysis.join('\n'), 'utf8');

console.log('Wrote pretty JSON to:', outPretty);
console.log('Wrote analysis to:', outAnalysis);
console.log('Summary:');
console.log(analysis.join('\n'));
