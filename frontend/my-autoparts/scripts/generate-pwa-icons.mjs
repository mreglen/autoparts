/**
 * Generates PWA icon PNGs from public/favicons/favicon.svg.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');
const faviconSvg = readFileSync(join(publicDir, 'favicons/favicon.svg'));

const BRAND_BG = { r: 254, g: 253, b: 251, alpha: 1 };

async function writeIcon(relativePath, size, { maskable = false } = {}) {
  const outPath = join(publicDir, relativePath);

  if (maskable) {
    const iconSize = Math.round(size * 0.72);
    const padding = Math.round((size - iconSize) / 2);
    const icon = await sharp(faviconSvg).resize(iconSize, iconSize).png().toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BRAND_BG,
      },
    })
      .composite([{ input: icon, left: padding, top: padding }])
      .png()
      .toFile(outPath);
    return;
  }

  await sharp(faviconSvg).resize(size, size).png().toFile(outPath);
}

async function main() {
  await writeIcon('favicons/favicon-16x16.png', 16);
  await writeIcon('favicons/favicon-32x32.png', 32);
  await writeIcon('favicons/apple-touch-icon.png', 180);
  await writeIcon('favicons/android-chrome-192x192.png', 192);
  await writeIcon('favicons/pwa-512.png', 512);
  await writeIcon('favicons/pwa-maskable-512.png', 512, { maskable: true });
  console.log('PWA icons generated in public/favicons/');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
