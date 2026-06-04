/**
 * Generate PWA icon PNGs from the SVG source.
 * Run: node scripts/generate-pwa-icons.mjs
 *
 * Requires: sharp (bundled with Next.js — no extra install needed)
 * Output: public/icons/icon-{192,512}.png + icon-maskable-{192,512}.png
 *         public/icons/apple-touch-icon.png (180x180)
 *
 * Maskable icons add safe-zone padding (10%) so the crown is visible
 * when the OS crops to a circle/squircle shape.
 */

import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const srcSvg = resolve(root, 'public', 'icons', 'icon.svg');
const outDir = resolve(root, 'public', 'icons');

mkdirSync(outDir, { recursive: true });

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  // Fallback: try loading from Next.js cache
  const nextSharp = resolve(root, 'node_modules', 'sharp');
  sharp = (await import(nextSharp)).default;
}

const svg = readFileSync(srcSvg);

const SIZES = [192, 512];
const SAFE_ZONE = 0.1; // 10% padding for maskable icons

async function generateIcon(size, suffix = '') {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(resolve(outDir, `icon${suffix}-${size}.png`));
  console.log(`✓ icon${suffix}-${size}.png`);
}

async function generateMaskable(size) {
  // Add 10% safe-zone padding on each side
  const inner = Math.round(size * (1 - SAFE_ZONE * 2));
  const pad = Math.round(size * SAFE_ZONE);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 124, g: 58, b: 237, alpha: 1 }, // brand purple
    },
  })
    .composite([{
      input: await sharp(svg).resize(inner, inner).png().toBuffer(),
      top: pad,
      left: pad,
    }])
    .png()
    .toFile(resolve(outDir, `icon-maskable-${size}.png`));
  console.log(`✓ icon-maskable-${size}.png`);
}

console.log('\nGenerating PWA icons...\n');

for (const size of SIZES) {
  await generateIcon(size);
  await generateMaskable(size);
}

// Apple touch icon — 180x180, no maskable padding needed
await sharp(svg)
  .resize(180, 180)
  .png()
  .toFile(resolve(outDir, 'apple-touch-icon.png'));
console.log('✓ apple-touch-icon.png');

console.log('\n✅ All icons generated in public/icons/\n');
