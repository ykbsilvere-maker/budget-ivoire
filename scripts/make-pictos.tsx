// Génère les pictogrammes par défaut (fond couleur du groupe, icône blanche) : public/img/<id>.png
import React from "react";
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { ICONS } from '../src/icons';
import { DEFAULT_CATEGORIES, DEFAULT_GROUPS } from '../src/data';

const color = (g?: string) => DEFAULT_GROUPS.find((x) => x.id === g)?.color ?? '#6B7280';
const photos = new Set(['c_rent', 'c_food', 'c_transport', 'c_health', 'c_leisure', 'c_phone']);
const items: { id: string; icon: string; bg: string }[] = [
  ...DEFAULT_CATEGORIES.filter((c) => !photos.has(c.id)).map((c) => ({ id: c.id, icon: c.icon, bg: color(c.group) })),
  { id: 'w_moov', icon: 'phone', bg: '#0057B8' },
  { id: 'w_savings', icon: 'piggy', bg: '#2E9E5B' },
];
for (const it of items) {
  const Ico = ICONS[it.icon];
  const svgIcon = renderToStaticMarkup(<Ico size={132} color="#ffffff" />).replace('<svg', '<svg x="62" y="62"');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${it.bg}"/><circle cx="210" cy="40" r="70" fill="#ffffff" fill-opacity="0.08"/>${svgIcon}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/img/${it.id}.png`);
  console.log(it.id);
}
