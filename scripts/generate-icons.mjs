// Genero el ícono de Mi Vida (amanecer sobre los Andes) en todos los tamaños que pide Expo.
// Uso: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../assets/images/', import.meta.url));
await mkdir(OUT, { recursive: true });

const BRAND = { dark: '#0B3B36', mid: '#0F766E', light: '#14B8A6', sun1: '#FDE68A', sun2: '#F59E0B' };

// La marca: sol saliendo detrás de dos montañas (los Andes), en capas sólidas.
function mark({ mono = false } = {}) {
  const white = '#FFFFFF';
  return `
    <circle cx="512" cy="440" r="165" fill="${mono ? white : 'url(#sun)'}"/>
    <path d="M190 730 L440 430 L560 575 L660 470 L834 730 Z" fill="${mono ? white : '#99F6E4'}"/>
    <path d="M190 730 L360 545 L470 665 L620 470 L834 730 Z" fill="${mono ? white : '#E6FFFA'}"/>
    <path d="M620 470 L668 532 L640 522 L620 548 L598 520 L572 532 Z" fill="${white}"/>`;
}

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND.light}"/>
      <stop offset="0.55" stop-color="${BRAND.mid}"/>
      <stop offset="1" stop-color="${BRAND.dark}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.5">
      <stop offset="0" stop-color="#FDE68A" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#FDE68A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BRAND.sun1}"/>
      <stop offset="1" stop-color="${BRAND.sun2}"/>
    </linearGradient>
  </defs>`;

const svg = (body, { bg = true } = {}) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}
    ${bg ? '<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#glow)"/>' : ''}
    ${body}</svg>`);

// El ícono adaptativo de Android recorta un círculo: uso la marca al 90% para la zona segura.
const scaled = (body, s) => `<g transform="translate(${512 - 512 * s} ${512 - 512 * s}) scale(${s})">${body}</g>`;

const files = [
  ['icon.png', svg(mark()), 1024],
  ['android-icon-foreground.png', svg(scaled(mark(), 0.9), { bg: false }), 1024],
  ['android-icon-background.png', svg(''), 1024],
  ['android-icon-monochrome.png', svg(scaled(mark({ mono: true }), 0.9), { bg: false }), 1024],
  ['splash-icon.png', svg(mark(), { bg: false }), 512],
  ['favicon.png', svg(mark()), 48],
];

for (const [name, buffer, size] of files) {
  await sharp(buffer).resize(size, size).png().toFile(OUT + name);
  console.log(`✓ ${name} (${size}px)`);
}
