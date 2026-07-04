import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { buildLinkedInAnimatedPosterSvg } from './linkedinCard.js';

const DEFAULT_FPS = 24;
const DEFAULT_DURATION_SECONDS = 4.8;

const resolveFfmpeg = () => {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  const localBinary = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(localBinary)) return localBinary;

  return 'ffmpeg';
};

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ease = (value) => 0.5 - Math.cos(clamp(value) * Math.PI) / 2;
const loop = (seconds, duration) => (seconds % duration) / duration;
const pulse = (seconds, duration, delay = 0) => {
  const p = loop(seconds + delay, duration);
  return p < 0.5 ? ease(p * 2) : ease((1 - p) * 2);
};
// Gentle blink that never fully disappears. The period divides the 4.8s loop so
// the pulse wraps seamlessly; opacity oscillates between `min` and 1.
const steadyBlink = (seconds, min = 0.6, period = 1.6) => min + (1 - min) * pulse(seconds, period);

// Staggered entrance: each row slides up and fades in after the previous one,
// then holds fully visible for the rest of the loop.
const stepReveal = (seconds, index) => {
  const start = 0.35 + index * 0.5;
  const k = ease(clamp((seconds - start) / 0.6));
  return { opacity: k, y: 22 * (1 - k) };
};
const lineDraw = (seconds) => {
  const p = loop(seconds, DEFAULT_DURATION_SECONDS);
  if (p < 0.1 || p > 0.98) return { scale: 0.08, opacity: 0.35 };
  if (p < 0.3) {
    const k = ease((p - 0.1) / 0.2);
    return { scale: 0.08 + 0.92 * k, opacity: 0.35 + 0.65 * k };
  }
  if (p < 0.88) return { scale: 1, opacity: 1 };
  const k = ease((p - 0.88) / 0.1);
  return { scale: 1 - 0.92 * k, opacity: 1 - 0.65 * k };
};

const buildPosterFrameSvg = (card, options, seconds) => {
  const grid = (loop(seconds, 8) * 135).toFixed(2);
  const topBand = pulse(seconds, 5.8);
  const bottomBand = pulse(seconds, 6.4);
  const mark = 1 + pulse(seconds, 4.2) * 0.035;
  const line = lineDraw(seconds);
  const headlineBlink = steadyBlink(seconds, 0.6, 1.6);
  const sublineBlink = steadyBlink(seconds, 0.82, 1.6);
  const promptOpacity = loop(seconds, 1.1) < 0.5 ? 1 : 0.45;
  const steps = [0, 1, 2].map((index) => stepReveal(seconds, index));
  const footerOpacity = 1 - pulse(seconds, 4.8) * 0.28;
  const topX = (-22 * topBand).toFixed(2);
  const topY = (20 * topBand).toFixed(2);
  const bottomX = (24 * bottomBand).toFixed(2);
  const bottomY = (-26 * bottomBand).toFixed(2);

  const overrides = `
      .grid{animation:none!important;transform:translate(${grid}px,${grid}px)!important}
      .soft-band-top{animation:none!important;transform:translate(${topX}px,${topY}px) rotate(-9deg)!important;opacity:${(1 - 0.22 * topBand).toFixed(3)}!important}
      .soft-band-bottom{animation:none!important;transform:translate(${bottomX}px,${bottomY}px) rotate(-11deg)!important;opacity:${(1 - 0.28 * bottomBand).toFixed(3)}!important}
      .frame{animation:none!important;stroke-opacity:${(0.18 + 0.1 * pulse(seconds, 3.4)).toFixed(3)}!important}
      .terminal-mark{animation:none!important;transform:translate(406px,118px) scale(${mark.toFixed(4)})!important}
      .prompt{animation:none!important;opacity:${promptOpacity}!important}
      .brand-line{animation:none!important;transform:scaleX(${line.scale.toFixed(4)})!important;opacity:${line.opacity.toFixed(3)}!important}
      .headline{animation:none!important;opacity:${headlineBlink.toFixed(3)}!important;transform:translateY(0)!important}
      .subline{animation:none!important;opacity:${sublineBlink.toFixed(3)}!important;transform:translateY(0)!important}
      .step-1{animation:none!important;opacity:${steps[0].opacity.toFixed(3)}!important;transform:translateY(${steps[0].y.toFixed(2)}px)!important}
      .step-2{animation:none!important;opacity:${steps[1].opacity.toFixed(3)}!important;transform:translateY(${steps[1].y.toFixed(2)}px)!important}
      .step-3{animation:none!important;opacity:${steps[2].opacity.toFixed(3)}!important;transform:translateY(${steps[2].y.toFixed(2)}px)!important}
      .footer-text{animation:none!important;opacity:${footerOpacity.toFixed(3)}!important}
`;

  return buildLinkedInAnimatedPosterSvg(card, options).replace('</style>', `${overrides}    </style>`);
};

const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(resolveFfmpeg(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(
          new Error(
            'ffmpeg is required to export MP4. Install ffmpeg, set FFMPEG_PATH, or add the ffmpeg-static package to this project.'
          )
        );
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
    });
  });

export const writeLinkedInAnimatedPosterMp4 = async (card, filePath, options = {}) => {
  const fps = Number(options.fps || DEFAULT_FPS);
  const durationSeconds = Number(options.durationSeconds || DEFAULT_DURATION_SECONDS);
  const frameCount = Math.max(1, Math.round(fps * durationSeconds));
  const framesDir = path.join(path.dirname(filePath), '.zroaix-poster-frames');

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await runFfmpeg(['-version']);
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });

  try {
    for (let frame = 0; frame < frameCount; frame += 1) {
      const seconds = frame / fps;
      const svg = buildPosterFrameSvg(card, options, seconds);
      const framePath = path.join(framesDir, `frame-${String(frame).padStart(4, '0')}.png`);
      await sharp(Buffer.from(svg)).png().resize(1080, 1080).toFile(framePath);
    }

    await runFfmpeg([
      '-y',
      '-framerate',
      String(fps),
      '-i',
      path.join(framesDir, 'frame-%04d.png'),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-r',
      String(fps),
      filePath,
    ]);
  } finally {
    fs.rmSync(framesDir, { recursive: true, force: true });
  }

  return filePath;
};
