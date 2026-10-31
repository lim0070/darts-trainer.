// Generates the app icon (a soft-tip style dartboard) as SVG and PNG sizes.
// Run with `npm run icons`; output goes to public/.
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const NIGHT = '#0F1C2B';
const SURROUND = '#162A3E';
const INK = '#0B1622';
const BONE = '#F1EBDD';
const RED = '#FF4A3D';
const BLUE = '#3FA2FF';

function pt(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

function wedge(cx, cy, r0, r1, a0, a1, fill) {
  const [x1, y1] = pt(cx, cy, r1, a0);
  const [x2, y2] = pt(cx, cy, r1, a1);
  const [x3, y3] = pt(cx, cy, r0, a1);
  const [x4, y4] = pt(cx, cy, r0, a0);
  const f = (n) => n.toFixed(2);
  return `<path d="M${f(x1)} ${f(y1)}A${r1} ${r1} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${r0} ${r0} 0 0 0 ${f(x4)} ${f(y4)}Z" fill="${fill}"/>`;
}

function board(scale) {
  const cx = 256;
  const cy = 256;
  const s = (r) => r * scale;
  const parts = [`<circle cx="${cx}" cy="${cy}" r="${s(214)}" fill="${SURROUND}"/>`];
  for (let i = 0; i < 20; i++) {
    const a0 = i * 18 - 9;
    const a1 = i * 18 + 9;
    const dark = i % 2 === 0;
    const single = dark ? INK : BONE;
    const ring = dark ? RED : BLUE;
    parts.push(wedge(cx, cy, s(172), s(200), a0, a1, ring));
    parts.push(wedge(cx, cy, s(125), s(172), a0, a1, single));
    parts.push(wedge(cx, cy, s(100), s(125), a0, a1, ring));
    parts.push(wedge(cx, cy, s(40), s(100), a0, a1, single));
  }
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${s(40)}" fill="${BLUE}"/>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${s(22)}" fill="${RED}"/>`);
  return parts.join('');
}

function svg(scale, rounded) {
  const bg = rounded
    ? `<rect width="512" height="512" rx="112" fill="${NIGHT}"/>`
    : `<rect width="512" height="512" fill="${NIGHT}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}${board(scale)}</svg>`;
}

writeFileSync('public/favicon.svg', svg(1.1, true));

const outputs = [
  { file: 'public/icon-192.png', size: 192, markup: svg(1.1, false) },
  { file: 'public/icon-512.png', size: 512, markup: svg(1.1, false) },
  { file: 'public/icon-maskable-512.png', size: 512, markup: svg(0.82, false) },
  { file: 'public/apple-touch-icon.png', size: 180, markup: svg(1.0, false) },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const o of outputs) {
  await page.setViewportSize({ width: o.size, height: o.size });
  await page.setContent(
    `<html><body style="margin:0;background:${NIGHT}">${o.markup.replace('<svg ', `<svg width="${o.size}" height="${o.size}" `)}</body></html>`,
  );
  await page.screenshot({ path: o.file, clip: { x: 0, y: 0, width: o.size, height: o.size } });
}
await browser.close();
console.log('icons written');
