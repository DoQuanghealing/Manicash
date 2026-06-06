/**
 * generate-capacitor-assets.mjs — tạo source images cho @capacitor/assets.
 *
 * @capacitor/assets cần các file độ phân giải cao trong assets/, rồi nó sinh
 * ra toàn bộ mipmap density + splash cho Android. Script này render từ logo SVG
 * (public/icons/icon.svg) ra:
 *   - assets/icon-only.png      (1024) full icon (nền tròn + vương miện)
 *   - assets/icon-foreground.png(1024) chỉ vương miện, trong suốt (adaptive FG)
 *   - assets/icon-background.png(1024) gradient tím→cam (adaptive BG)
 *   - assets/splash.png         (2732) nền #0A0A12 + logo giữa
 *   - assets/splash-dark.png    (2732) giống splash (app dark-first)
 *
 * Chạy: node scripts/generate-capacitor-assets.mjs
 * Sau đó: npx @capacitor/assets generate --android && npx cap sync android
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'assets');
mkdirSync(outDir, { recursive: true });

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  sharp = (await import(resolve(root, 'node_modules', 'sharp'))).default;
}

const fullSvg = readFileSync(resolve(root, 'public', 'icons', 'icon.svg'));

// Vương miện không có nền tròn — dùng làm adaptive foreground
const crownSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="crown" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#FBBF24"/><stop offset="100%" stop-color="#F59E0B"/>
  </linearGradient></defs>
  <path d="M 148 320 L 172 200 L 220 256 L 256 160 L 292 256 L 340 200 L 364 320 Z"
    fill="url(#crown)" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="256" cy="155" r="14" fill="#fff" opacity="0.9"/>
  <circle cx="168" cy="195" r="10" fill="#fff" opacity="0.7"/>
  <circle cx="344" cy="195" r="10" fill="#fff" opacity="0.7"/>
  <rect x="148" y="328" width="216" height="24" rx="12" fill="#fff" opacity="0.9"/>
</svg>`);

// Gradient nền cho adaptive background
const bgSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#7C3AED"/><stop offset="100%" stop-color="#F97316"/>
  </linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
</svg>`);

// icon-only: full icon 1024
await sharp(fullSvg).resize(1024, 1024).png().toFile(resolve(outDir, 'icon-only.png'));

// icon-foreground: vương miện trên nền trong suốt, scale ~78% + safe-zone padding
const fgInner = 800;
const fgPad = Math.round((1024 - fgInner) / 2);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(crownSvg).resize(fgInner, fgInner).png().toBuffer(), top: fgPad, left: fgPad }])
  .png()
  .toFile(resolve(outDir, 'icon-foreground.png'));

// icon-background: gradient 1024
await sharp(bgSvg).resize(1024, 1024).png().toFile(resolve(outDir, 'icon-background.png'));

// splash: nền #0A0A12 2732 + full icon ~820px giữa
const splashLogo = 820;
const splashPad = Math.round((2732 - splashLogo) / 2);

for (const name of ['splash.png', 'splash-dark.png']) {
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: { r: 10, g: 10, b: 18, alpha: 1 } } })
    .composite([{ input: await sharp(fullSvg).resize(splashLogo, splashLogo).png().toBuffer(), top: splashPad, left: splashPad }])
    .png()
    .toFile(resolve(outDir, name));
}

console.log('✓ assets/ source images generated (icon-only, icon-foreground, icon-background, splash, splash-dark)');
