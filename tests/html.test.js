'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('desk shell wires engine, styles, and play surface', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  [
    'id="desk"',
    'id="chart"',
    'id="watch"',
    'id="ticket"',
    'id="tape"',
    'src="src/engine.js"',
    'src="src/ui.js"',
    'href="css/desk.css"',
    'SIMULATED'
  ].forEach((needle) => {
    assert.ok(html.includes(needle), 'missing ' + needle);
  });
  assert.ok(!/\bKing\b|\bLeonard\b|kingleonardjr/i.test(html));
});

test('public docs stay anonymous and link the research', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const research = fs.readFileSync(path.join(root, 'docs/RESEARCH.md'), 'utf8');
  const handoff = fs.readFileSync(path.join(root, 'docs/HANDOFF.md'), 'utf8');
  assert.match(readme, /github.com\/T0PK1DK\/terminal-trader/);
  assert.match(readme, /PLAY-LINK-PLACEHOLDER|play link/i);
  assert.match(readme, /docs\/RESEARCH.md/);
  assert.match(research, /https:\/\/www.roblox.com\/games\/81340984854227\/RBLX-Exchange/);
  assert.match(research, /What we are borrowing/);
  assert.match(handoff, /Claude/);
  [readme, research, handoff].forEach((text) => {
    assert.ok(!/King Leonard|kingleonardjr/i.test(text));
  });
});

test('engine ships as a dual browser/node module', () => {
  const src = fs.readFileSync(path.join(root, 'src/engine.js'), 'utf8');
  assert.match(src, /module\.exports/);
  assert.match(src, /root\.TerminalTrader/);
  assert.match(src, /createRing/);
});
