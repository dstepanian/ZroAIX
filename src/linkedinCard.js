import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import config from './config.js';
import { yerevanDate } from './format.js';

const WIDTH = 1080;
const HEIGHT = 1350;

const THEMES = {
  dark: {
    bg: '#171c24',
    grid: '#303843',
    frame: '#ffffff',
    frameOpacity: 0.18,
    text: '#f8fafc',
    muted: '#c5ced8',
    logoText: '#ffffff',
    iconBg: '#20242b',
    pillBg: '#151a20',
    cardBg: '#11161c',
    title: '#ffffff',
    blobBlue: '#2d4f9a',
    blobGreen: '#16362c',
    blobOpacity: 0.34,
    shadow: 0.3,
  },
  light: {
    bg: '#f6fbfa',
    grid: '#d8e2e1',
    frame: '#13212a',
    frameOpacity: 0.14,
    text: '#10202a',
    muted: '#63727f',
    logoText: '#10202a',
    iconBg: '#ffffff',
    pillBg: '#ffffff',
    cardBg: '#ffffff',
    title: '#10202a',
    blobBlue: '#c9ddff',
    blobGreen: '#c8f2df',
    blobOpacity: 0.68,
    shadow: 0.12,
  },
};

const ACCENTS = ['#2f6df6', '#12a84f', '#ef6f8d'];

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const normalizeTheme = (theme) => (theme === 'light' ? 'light' : 'dark');

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

const tspans = (lines, x, y, lineHeight, className, anchor = 'start') =>
  lines
    .map((line, idx) => `<tspan x="${x}" y="${y + idx * lineHeight}" text-anchor="${anchor}" class="${className}">${esc(line)}</tspan>`)
    .join('');

export const buildLinkedInCardSvg = ({ headline = '', bullets = [], date = yerevanDate() } = {}, options = {}) => {
  const themeName = normalizeTheme(options.theme || config.linkedinCardTheme);
  const t = THEMES[themeName];
  const titleLines = wrapText(headline, 21, 3);
  const insightRows = bullets.slice(0, 3).map((bullet, idx) => ({
    label: ['Signal', 'Impact', 'Action'][idx],
    lines: wrapText(bullet, 34, 2),
    accent: ACCENTS[idx],
  }));
  while (insightRows.length < 3) {
    const idx = insightRows.length;
    insightRows.push({
      label: ['Signal', 'Impact', 'Action'][idx],
      lines: [['AI-ի կարեւոր միտում', 'Հայ tech համայնքի համար'][idx] || 'Կարճ գործնական takeaway'],
      accent: ACCENTS[idx],
    });
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <pattern id="grid" width="135" height="135" patternUnits="userSpaceOnUse">
      <path d="M 135 0 L 0 0 0 135" fill="none" stroke="${t.grid}" stroke-width="1.4" opacity="0.55"/>
    </pattern>
    <linearGradient id="accentLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2f6df6"/>
      <stop offset="100%" stop-color="#61d29b"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000000" flood-opacity="${t.shadow}"/>
    </filter>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="${t.bg}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>
  <path d="M 0 1090 L 640 964 Q 710 950 724 1028 L 768 1350 L 0 1350 Z" fill="${t.blobBlue}" opacity="${t.blobOpacity}"/>
  <circle cx="876" cy="150" r="226" fill="${t.blobBlue}" opacity="${t.blobOpacity}"/>
  <circle cx="902" cy="1140" r="275" fill="${t.blobGreen}" opacity="${t.blobOpacity}"/>
  <rect x="92" y="92" width="896" height="1166" rx="44" fill="none" stroke="${t.frame}" stroke-opacity="${t.frameOpacity}" stroke-width="2.2"/>

  <style>
    text { font-family: "DejaVu Sans", "Noto Sans Armenian", "Noto Sans", Arial, sans-serif; }
    .logo { fill: ${t.logoText}; font-size: 56px; font-weight: 800; letter-spacing: 0; }
    .terminal { fill: #8ee6a8; font-size: 58px; font-weight: 900; }
    .terminalBlue { fill: #2f6df6; font-size: 58px; font-weight: 900; }
    .pill { fill: ${t.text}; font-size: 20px; font-weight: 800; }
    .tag { fill: #22ad58; font-size: 18px; font-weight: 900; }
    .date { fill: ${t.muted}; font-size: 21px; font-weight: 800; }
    .headline { fill: ${t.title}; font-family: Georgia, "DejaVu Serif", serif; font-size: 56px; font-weight: 900; }
    .formula { fill: ${t.text}; font-size: 31px; font-weight: 900; letter-spacing: 0.5px; }
    .rowLabel { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
    .rowText { fill: ${t.text}; font-size: 25px; font-weight: 850; }
    .footerMain { fill: ${t.muted}; font-size: 30px; font-weight: 900; letter-spacing: 1px; }
    .footerSub { fill: #22ad58; font-size: 27px; font-weight: 900; }
  </style>

  <rect x="390" y="116" width="124" height="124" rx="25" fill="${t.iconBg}" stroke="#5f86ff" stroke-width="4" filter="url(#softShadow)"/>
  <text x="424" y="194" class="${themeName === 'dark' ? 'terminal' : 'terminalBlue'}">&gt;_</text>
  <text x="546" y="195" class="logo">zroaix</text>
  <rect x="548" y="220" width="330" height="7" rx="4" fill="url(#accentLine)"/>

  <rect x="172" y="286" width="254" height="48" rx="14" fill="${t.pillBg}" stroke="#2f6df6" stroke-opacity="0.7"/>
  <circle cx="200" cy="310" r="6" fill="#4f83ff"/>
  <text x="220" y="317" class="pill">AI digest</text>
  <text x="540" y="320" text-anchor="middle" class="date">${esc(date)}</text>
  <rect x="746" y="286" width="162" height="48" rx="14" fill="${t.pillBg}" stroke="#61d29b" stroke-opacity="0.65"/>
  <text x="827" y="317" text-anchor="middle" class="tag">#ZROAIX</text>

  <text>${tspans(titleLines, 540, 415, 68, 'headline', 'middle')}</text>
  <text x="540" y="640" text-anchor="middle" class="formula">What changed + why it matters</text>

  ${insightRows
    .map((row, idx) => {
      const y = 704 + idx * 138;
      return `
  <rect x="166" y="${y}" width="748" height="118" rx="22" fill="${t.cardBg}" stroke="${row.accent}" stroke-width="2.2" filter="url(#softShadow)"/>
  <rect x="166" y="${y}" width="9" height="118" rx="5" fill="${row.accent}"/>
  <circle cx="218" cy="${y + 59}" r="24" fill="${row.accent}"/>
  <text x="218" y="${y + 68}" text-anchor="middle" style="fill: ${themeName === 'dark' ? '#081018' : '#ffffff'}; font-size: 24px; font-weight: 900;">${idx + 1}</text>
  <text x="270" y="${y + 36}" class="rowLabel" style="fill: ${row.accent};">${esc(row.label.toUpperCase())}</text>
  <text>${tspans(row.lines, 270, y + 73, 30, 'rowText')}</text>`;
    })
    .join('')}

  <text x="540" y="1160" text-anchor="middle" class="footerMain">zromek.de</text>
  <text x="540" y="1207" text-anchor="middle" class="footerSub">AI News | Armenian</text>
</svg>`.trim();
};

export const renderLinkedInCardPng = async (card, options = {}) =>
  sharp(Buffer.from(buildLinkedInCardSvg(card, options))).png().resize(WIDTH, HEIGHT).toBuffer();

export const writeLinkedInCardPng = async (card, filePath, options = {}) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const buffer = await renderLinkedInCardPng(card, options);
  fs.writeFileSync(filePath, buffer);
  return filePath;
};
