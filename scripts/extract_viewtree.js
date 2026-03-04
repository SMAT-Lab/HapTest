#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fmtBounds(bounds) {
  if (!bounds || !Array.isArray(bounds) || bounds.length < 2) return '';
  const a = bounds[0];
  const b = bounds[1];
  return `bounds=${a.x},${a.y}-${b.x},${b.y}`;
}

function nodeSummary(node) {
  if (!node || typeof node !== 'object') return '';
  const parts = [];
  if (node.type) parts.push(node.type);
  const b = fmtBounds(node.bounds || node.origBounds);
  if (b) parts.push(b);
  if (node.id) parts.push(`id=${node.id}`);
  if (node.key) parts.push(`key=${node.key}`);
  if (node.text) parts.push(`text=${String(node.text).replace(/\s+/g, ' ').slice(0,80)}`);
  return parts.join(' | ');
}

function walk(node, indent, lines) {
  if (!node || typeof node !== 'object') return;
  const summary = nodeSummary(node) || '(no-type)';
  lines.push(`${'  '.repeat(indent)}- ${summary}`);
  const children = node.children;
  if (Array.isArray(children) && children.length > 0) {
    for (const c of children) walk(c, indent + 1, lines);
  }
}

if (process.argv.length < 3) {
  console.error('Usage: node scripts/extract_viewtree.js <input.json>');
  process.exit(2);
}

const infile = process.argv[2];
if (!fs.existsSync(infile)) {
  console.error('File not found:', infile);
  process.exit(2);
}

let obj;
try {
  obj = JSON.parse(fs.readFileSync(infile, 'utf8'));
} catch (e) {
  console.error('JSON parse error:', e.message);
  process.exit(2);
}

const outPath = infile.replace(/\.json$/i, '_viewtree.txt');
const lines = [];

function extractSide(sideName) {
  const root = obj[sideName] && obj[sideName].viewTree && obj[sideName].viewTree.root;
  lines.push(`${sideName.toUpperCase()} VIEWTREE:`);
  if (!root) {
    lines.push('  (no viewTree.root)');
    lines.push('');
    return;
  }
  walk(root, 0, lines);
  lines.push('');
}

extractSide('from');
extractSide('to');

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('Wrote:', outPath);
