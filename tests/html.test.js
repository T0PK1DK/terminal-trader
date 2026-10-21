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
    'id="shortBtn"',
    'id="coverBtn"',
    'id="emaBtn"',
    'id="crtSlider"',
    'id="pnlBtn"',
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

test('desk polish: phone layout, reduced motion, and eased chart stay wired', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/desk.css'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8');
  assert.match(html, /name="viewport"[^>]*width=device-width/);
  assert.match(html, /id="lastDot"/);
  assert.match(html, /id="tradeBar"[\s\S]*id="buyBtn"[\s\S]*id="shortBtn"[\s\S]*id="coverBtn"/);
  assert.match(html, /id="chartLegend"/);
  assert.match(css, /\.trade-bar \{\s*position: fixed;/);
  assert.match(ui, /stock\.avg/);
  assert.match(ui, /state\.orders\.forEach/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(hover: hover\)/);
  assert.match(ui, /function noteTick\(/);
  assert.match(ui, /prefers-reduced-motion/);
  // .news styles must not leak onto .log-entry.news rows
  assert.ok(!/^\.news\b/m.test(css), 'scope news panel styles to .panel.news');
});
