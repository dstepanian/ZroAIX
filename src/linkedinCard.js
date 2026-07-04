import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { yerevanDate } from './format.js';

const WIDTH = 1080;
const HEIGHT = 1350;

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const wrapText = (text, maxChars, maxLines) => {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.։,;:!?]+$/, '')}...`;
  }
  return lines;
};

const tspans = (lines, x, y, lineHeight, className) =>
  lines
    .map((line, idx) => `<tspan x="${x}" y="${y + idx * lineHeight}" class="${className}">${esc(line)}</tspan>`)
    .join('');

export const buildLinkedInCardSvg = ({ headline = '', bullets = [], date = yerevanDate() } = {}) => {
  const titleLines = wrapText(headline, 24, 3);
  const safeBullets = bullets.slice(0, 3).map((bullet) => wrapText(bullet, 30, 2));
  const bulletYs = [720, 850, 980];

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07111f"/>
      <stop offset="52%" stop-color="#0f2a4a"/>
      <stop offset="100%" stop-color="#1677ff"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.07"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="26" stdDeviation="26" flood-color="#000000" flood-opacity="0.28"/>
    </filter>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="910" cy="130" r="210" fill="#56d6ff" opacity="0.16"/>
  <circle cx="120" cy="1120" r="260" fill="#49f2b2" opacity="0.12"/>
  <rect x="58" y="58" width="964" height="1234" rx="38" fill="url(#panel)" stroke="#ffffff" stroke-opacity="0.2" filter="url(#shadow)"/>

  <style>
    text { font-family: "DejaVu Sans", "Noto Sans Armenian", "Noto Sans", Arial, sans-serif; fill: #f8fbff; }
    .brand { font-size: 58px; font-weight: 800; letter-spacing: 0; }
    .date { font-size: 30px; font-weight: 600; fill: #b9d8ff; }
    .label { font-size: 28px; font-weight: 700; fill: #7ce7c8; letter-spacing: 1px; }
    .headline { font-size: 76px; font-weight: 800; }
    .bullet { font-size: 34px; font-weight: 600; fill: #edf6ff; }
    .num { font-size: 30px; font-weight: 800; fill: #05111f; }
    .footer { font-size: 30px; font-weight: 700; fill: #c9ddf4; }
  </style>

  <text x="92" y="148" class="brand">ZroAIX Daily</text>
  <text x="92" y="205" class="date">${esc(date)}</text>
  <text x="92" y="324" class="label">AI NEWS IN ARMENIAN</text>
  <text>${tspans(titleLines, 92, 420, 88, 'headline')}</text>

  ${safeBullets
    .map((lines, idx) => {
      const y = bulletYs[idx];
      return `
  <circle cx="112" cy="${y - 13}" r="28" fill="#7ce7c8"/>
  <text x="102" y="${y - 3}" class="num">${idx + 1}</text>
  <text>${tspans(lines, 170, y, 48, 'bullet')}</text>`;
    })
    .join('')}

  <line x1="92" y1="1160" x2="988" y2="1160" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2"/>
  <text x="92" y="1234" class="footer">AI news in Armenian · @zroaix</text>
</svg>`.trim();
};

export const renderLinkedInCardPng = async (card) =>
  sharp(Buffer.from(buildLinkedInCardSvg(card))).png().resize(WIDTH, HEIGHT).toBuffer();

export const writeLinkedInCardPng = async (card, filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const buffer = await renderLinkedInCardPng(card);
  fs.writeFileSync(filePath, buffer);
  return filePath;
};
