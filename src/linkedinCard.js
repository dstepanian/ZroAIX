import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import config from './config.js';
import { yerevanDate } from './format.js';

const WIDTH = 1080;
const HEIGHT = 1350;
const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1080;

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
  mono: {
    bg: '#fbfbf8',
    grid: '#d7d8d5',
    frame: '#172026',
    frameOpacity: 0.13,
    text: '#172026',
    muted: '#6d747a',
    logoText: '#172026',
    iconBg: '#ffffff',
    pillBg: '#ffffff',
    cardBg: '#ffffff',
    title: '#172026',
    blobBlue: '#ececea',
    blobGreen: '#f3f3f0',
    blobOpacity: 0.82,
    shadow: 0.1,
  },
};

const ACCENTS = ['#2f6df6', '#12a84f', '#ef6f8d'];
const MONO_ACCENTS = ['#172026', '#172026', '#172026'];

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const normalizeTheme = (theme) => (theme === 'light' || theme === 'mono' ? theme : 'dark');
const themeAccents = (themeName) => (themeName === 'mono' ? MONO_ACCENTS : ACCENTS);

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
  const accents = themeAccents(themeName);
  const titleLines = wrapText(headline, 21, 3);
  const insightRows = bullets.slice(0, 3).map((bullet, idx) => ({
    label: ['Signal', 'Impact', 'Action'][idx],
    lines: wrapText(bullet, 34, 2),
    accent: accents[idx],
  }));
  while (insightRows.length < 3) {
    const idx = insightRows.length;
    insightRows.push({
      label: ['Signal', 'Impact', 'Action'][idx],
      lines: [['AI-ի կարեւոր միտում', 'Հայ tech համայնքի համար'][idx] || 'Կարճ գործնական takeaway'],
      accent: accents[idx],
    });
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <pattern id="grid" width="135" height="135" patternUnits="userSpaceOnUse">
      <path d="M 135 0 L 0 0 0 135" fill="none" stroke="${t.grid}" stroke-width="1.4" opacity="0.55"/>
    </pattern>
    <linearGradient id="accentLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accents[0]}"/>
      <stop offset="100%" stop-color="${accents[1]}"/>
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
    .terminal { fill: ${themeName === 'mono' ? accents[0] : '#8ee6a8'}; font-size: 58px; font-weight: 900; }
    .terminalBlue { fill: ${accents[0]}; font-size: 58px; font-weight: 900; }
    .pill { fill: ${t.text}; font-size: 20px; font-weight: 800; }
    .tag { fill: ${accents[1]}; font-size: 18px; font-weight: 900; }
    .date { fill: ${t.muted}; font-size: 21px; font-weight: 800; }
    .headline { fill: ${t.title}; font-family: Georgia, "DejaVu Serif", serif; font-size: 56px; font-weight: 900; }
    .formula { fill: ${t.text}; font-size: 31px; font-weight: 900; letter-spacing: 0.5px; }
    .rowLabel { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
    .rowText { fill: ${t.text}; font-size: 25px; font-weight: 850; }
    .footerMain { fill: ${t.muted}; font-size: 30px; font-weight: 900; letter-spacing: 1px; }
    .footerSub { fill: ${accents[1]}; font-size: 27px; font-weight: 900; }
  </style>

  <rect x="390" y="116" width="124" height="124" rx="25" fill="${t.iconBg}" stroke="${accents[0]}" stroke-width="4" filter="url(#softShadow)"/>
  <text x="424" y="194" class="${themeName === 'dark' ? 'terminal' : 'terminalBlue'}">&gt;_</text>
  <text x="546" y="195" class="logo">zroaix</text>
  <rect x="548" y="220" width="330" height="7" rx="4" fill="url(#accentLine)"/>

  <rect x="172" y="286" width="254" height="48" rx="14" fill="${t.pillBg}" stroke="${accents[0]}" stroke-opacity="0.7"/>
  <circle cx="200" cy="310" r="6" fill="${accents[0]}"/>
  <text x="220" y="317" class="pill">AI digest</text>
  <text x="540" y="320" text-anchor="middle" class="date">${esc(date)}</text>
  <rect x="746" y="286" width="162" height="48" rx="14" fill="${t.pillBg}" stroke="${accents[1]}" stroke-opacity="0.65"/>
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

export const buildLinkedInAnimatedPosterSvg = ({ headline = '', bullets = [], date = yerevanDate() } = {}, options = {}) => {
  const themeName = normalizeTheme(options.theme || config.linkedinCardTheme);
  const t = THEMES[themeName];
  const isDark = themeName === 'dark';
  const isMono = themeName === 'mono';
  const accents = themeAccents(themeName);
  const titleLines = wrapText(headline, 22, 2);
  const insightRows = bullets.slice(0, 3).map((bullet, idx) => ({
    label: ['Signal', 'Impact', 'Action'][idx],
    lines: wrapText(bullet, 16, 2),
    accent: accents[idx],
  }));
  while (insightRows.length < 3) {
    const idx = insightRows.length;
    insightRows.push({
      label: ['Signal', 'Impact', 'Action'][idx],
      lines: wrapText(['AI-ի կարեւոր միտում', 'Գործնական ազդեցություն', 'Հայ tech համայնքի հնարավորություն'][idx], 16, 2),
      accent: accents[idx],
    });
  }

  const bgStops = isMono
    ? `
      <stop offset="0" stop-color="#fbfbf8"/>
      <stop offset=".56" stop-color="#f4f4f1"/>
      <stop offset="1" stop-color="#ffffff"/>`
    : isDark
    ? `
      <stop offset="0" stop-color="#171c24"/>
      <stop offset=".56" stop-color="#11161c"/>
      <stop offset="1" stop-color="#19232c"/>`
    : `
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".52" stop-color="#eef8f5"/>
      <stop offset="1" stop-color="#f4f9ff"/>`;
  const gridStroke = isDark ? '#ffffff' : '#10232c';
  const tileFill = isDark ? '#11161c' : '#ffffff';
  const tileFillOpacity = isDark ? '.86' : '.9';
  const promptFill = isDark ? '#8ee6a8' : accents[0];
  const topBandStart = isMono ? '#ececea' : '#2f6df6';
  const topBandEnd = isMono ? '#f3f3f0' : '#12a84f';
  const bottomBandStart = isMono ? '#f0f0ed' : '#ef6f8d';
  const bottomBandEnd = isMono ? '#ececea' : '#2f6df6';

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}">
  <defs>
    <linearGradient id="poster-bg" x1="0" y1="0" x2="1" y2="1">${bgStops}
    </linearGradient>
    <linearGradient id="poster-accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accents[0]}"/>
      <stop offset="1" stop-color="${accents[1]}"/>
    </linearGradient>
    <linearGradient id="poster-band-top" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${topBandStart}" stop-opacity="${isDark ? '.24' : isMono ? '.92' : '.18'}"/>
      <stop offset="1" stop-color="${topBandEnd}" stop-opacity="${isDark ? '.18' : isMono ? '.92' : '.14'}"/>
    </linearGradient>
    <linearGradient id="poster-band-bottom" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${bottomBandStart}" stop-opacity="${isDark ? '.18' : isMono ? '.84' : '.13'}"/>
      <stop offset="1" stop-color="${bottomBandEnd}" stop-opacity="${isDark ? '.18' : isMono ? '.84' : '.13'}"/>
    </linearGradient>
    <filter id="poster-shadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="${isDark ? '.26' : '.12'}"/>
    </filter>
    <style>
      .mono{font-family:"JetBrains Mono","Consolas","Courier New",monospace}
      .sans{font-family:"Noto Sans Armenian","Segoe UI",Arial,sans-serif}
      .terminal-mark,.headline,.subline,.step-1,.step-2,.step-3{transform-box:fill-box;transform-origin:center}
      .grid{animation:gridDrift 8s linear infinite}
      .soft-band-top{animation:bandTop 5.8s ease-in-out infinite}
      .soft-band-bottom{animation:bandBottom 6.4s ease-in-out infinite}
      .frame{animation:framePulse 3.4s ease-in-out infinite}
      .terminal-mark{animation:markPop 4.2s ease-in-out infinite}
      .prompt{animation:promptBlink 1.1s steps(2,start) infinite}
      .brand-line{transform-origin:548px 231.5px;animation:lineDraw 4.8s ease-in-out infinite}
      .headline{animation:fadeRise 4.8s ease-in-out infinite}
      .subline{animation:fadeRise 4.8s ease-in-out .18s infinite}
      .step-1,.step-2,.step-3{animation:cardBreathe 6.4s ease-in-out infinite}
      .step-1{animation-delay:.2s}
      .step-2{animation-delay:1s}
      .step-3{animation-delay:1.8s}
      .footer-text{animation:footerPulse 4.8s ease-in-out infinite}
      .date{fill:${t.muted};font-size:21px;font-weight:800}
      .pill{fill:${t.text};font-size:20px;font-weight:800}
      .tag{fill:${accents[1]};font-size:20px;font-weight:900}
      .headlineText{fill:${t.title};font-size:54px;font-weight:900}
      .sublineText{fill:${t.muted};font-size:38px;font-weight:850}
      .tileLabel{font-size:18px;font-weight:900;letter-spacing:1px}
      .tileText{fill:${t.text};font-size:19px;font-weight:800}
      @keyframes gridDrift{to{transform:translate(135px,135px)}}
      @keyframes bandTop{50%{transform:translate(-22px,20px) rotate(-9deg);opacity:.78}}
      @keyframes bandBottom{50%{transform:translate(24px,-26px) rotate(-11deg);opacity:.72}}
      @keyframes framePulse{50%{stroke-opacity:${isDark ? '.28' : '.24'}}}
      @keyframes markPop{0%,100%{transform:translate(406px,118px) scale(1)}50%{transform:translate(406px,118px) scale(1.035)}}
      @keyframes promptBlink{50%{opacity:.45}}
      @keyframes lineDraw{0%,10%,100%{transform:scaleX(.08);opacity:.35}30%,88%{transform:scaleX(1);opacity:1}}
      @keyframes fadeRise{0%,12%,100%{opacity:0;transform:translateY(18px)}30%,88%{opacity:1;transform:translateY(0)}}
      @keyframes cardBreathe{0%,100%{opacity:.88}22%,68%{opacity:1}}
      @keyframes footerPulse{50%{opacity:.72}}
      @media (prefers-reduced-motion:reduce){
        .grid,.soft-band-top,.soft-band-bottom,.frame,.terminal-mark,.prompt,.brand-line,.headline,.subline,.step-1,.step-2,.step-3,.footer-text{animation:none}
      }
    </style>
  </defs>

  <rect width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" fill="url(#poster-bg)"/>
  <path class="grid" d="M-135 0H1080M-135 135H1080M-135 270H1080M-135 405H1080M-135 540H1080M-135 675H1080M-135 810H1080M-135 945H1080M-135 1080H1080M0 -135V1080M135 -135V1080M270 -135V1080M405 -135V1080M540 -135V1080M675 -135V1080M810 -135V1080M945 -135V1080M1080 -135V1080"
        stroke="${gridStroke}" stroke-opacity="${isDark ? '.055' : '.06'}" stroke-width="2"/>
  <rect class="soft-band-top" x="468" y="8" width="760" height="190" rx="56" fill="url(#poster-band-top)" transform="rotate(-9 848 103)"/>
  <rect class="soft-band-bottom" x="-230" y="828" width="820" height="210" rx="60" fill="url(#poster-band-bottom)" transform="rotate(-11 180 933)"/>
  <rect class="frame" x="92" y="92" width="896" height="896" rx="46" fill="none" stroke="${t.frame}" stroke-opacity="${isDark ? '.18' : '.14'}" stroke-width="2"/>

  <g class="terminal-mark" transform="translate(406 118)" filter="url(#poster-shadow)">
    <rect width="116" height="116" rx="24" fill="${t.iconBg}" stroke="${accents[0]}" stroke-opacity=".5" stroke-width="4"/>
    <text x="27" y="75" class="mono prompt" font-size="50" fill="${promptFill}" font-weight="800">&gt;_</text>
  </g>
  <text class="mono" x="548" y="200" font-size="58" fill="${t.logoText}" font-weight="800">zroaix</text>
  <rect class="brand-line" x="548" y="228" width="330" height="7" rx="4" fill="url(#poster-accent)"/>

  <g transform="translate(172 286)" filter="url(#poster-shadow)">
    <rect width="254" height="46" rx="14" fill="${t.pillBg}" fill-opacity="${isDark ? '.9' : '.84'}" stroke="${accents[0]}" stroke-opacity=".46"/>
    <circle cx="28" cy="23" r="6" fill="${accents[0]}"/>
    <text class="sans pill" x="48" y="30">AI digest</text>
  </g>
  <text x="540" y="318" text-anchor="middle" class="sans date">${esc(date)}</text>
  <g transform="translate(746 286)" filter="url(#poster-shadow)">
    <rect width="162" height="46" rx="14" fill="${t.pillBg}" fill-opacity="${isDark ? '.9' : '.76'}" stroke="${accents[1]}" stroke-opacity=".44"/>
    <text class="mono tag" x="81" y="30" text-anchor="middle">#ZROAIX</text>
  </g>

  <text class="sans headline headlineText" x="540" y="424" text-anchor="middle">${tspans(titleLines, 540, 424, 64, 'headlineText', 'middle')}</text>
  <text class="sans subline sublineText" x="540" y="${titleLines.length > 1 ? 574 : 540}" text-anchor="middle">What changed + why it matters</text>

  ${insightRows
    .map((row, idx) => {
      const x = 172 + idx * 256;
      return `
  <g class="step-${idx + 1}" transform="translate(${x} 672)" filter="url(#poster-shadow)">
    <rect width="224" height="112" rx="20" fill="${tileFill}" fill-opacity="${tileFillOpacity}" stroke="${row.accent}" stroke-width="2"/>
    <text class="sans tileLabel" x="112" y="32" text-anchor="middle" fill="${row.accent}">${esc(row.label.toUpperCase())}</text>
    <text class="sans">${tspans(row.lines, 112, 66, 24, 'tileText', 'middle')}</text>
  </g>`;
    })
    .join('')}

  <text class="mono footer-text" x="540" y="904" text-anchor="middle" font-size="30" fill="${t.muted}" font-weight="700">${esc(config.siteUrl)}</text>
  <text class="sans footer-text" x="540" y="948" text-anchor="middle" font-size="27" fill="${accents[1]}" font-weight="800">AI News | Armenian</text>
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

export const writeLinkedInAnimatedPosterSvg = async (card, filePath, options = {}) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buildLinkedInAnimatedPosterSvg(card, options));
  return filePath;
};
