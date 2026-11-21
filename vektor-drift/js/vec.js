// Kleine Mathe-Helfer

export const TAU = Math.PI * 2;

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function circlesHit(a, b, ra = a.r, rb = b.r) {
  const r = ra + rb;
  return dist2(a, b) < r * r;
}

/** Bildschirm-Wrap: Objekte verlassen das Feld komplett, bevor sie gegenüber auftauchen. */
export function wrap(o, W, H, margin = o.r || 0) {
  if (o.x < -margin) o.x += W + 2 * margin;
  else if (o.x > W + margin) o.x -= W + 2 * margin;
  if (o.y < -margin) o.y += H + 2 * margin;
  else if (o.y > H + margin) o.y -= H + 2 * margin;
}

/** Transformiert lokale Polygonpunkte in Weltkoordinaten. */
export function transformPoints(pts, x, y, ang, scale = 1) {
  const c = Math.cos(ang) * scale;
  const s = Math.sin(ang) * scale;
  return pts.map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]);
}
