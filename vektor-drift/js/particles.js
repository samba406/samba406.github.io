// Partikeleffekte: Funken, auseinanderfliegende Vektor-Trümmer, Schockwellen, Punktanzeigen.

import { TAU, rand } from './vec.js';

export class Particles {
  constructor() {
    this.list = [];
  }

  clear() {
    this.list.length = 0;
  }

  spark(x, y, { count = 12, speed = 160, life = 0.7, color = '#fff', vx = 0, vy = 0, angle = 0, spread = TAU, size = 1.8 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * rand(0.25, 1);
      const l = life * rand(0.5, 1.2);
      this.list.push({ kind: 'spark', x, y, vx: vx + Math.cos(a) * s, vy: vy + Math.sin(a) * s, life: l, max: l, color, size });
    }
  }

  /** Lässt die Kanten eines Polygons (Weltkoordinaten) einzeln davonfliegen. */
  debris(points, color, vx = 0, vy = 0, { speed = 70, life = 1.4 } = {}) {
    const n = points.length;
    let cx = 0, cy = 0;
    for (const [px, py] of points) { cx += px; cy += py; }
    cx /= n; cy /= n;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % n];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const out = Math.atan2(my - cy, mx - cx);
      const s = speed * rand(0.4, 1.2);
      const l = life * rand(0.6, 1.1);
      this.list.push({
        kind: 'line', x: mx, y: my,
        hx: (x2 - x1) / 2, hy: (y2 - y1) / 2,
        rot: 0, spin: rand(-4, 4),
        vx: vx * 0.5 + Math.cos(out) * s, vy: vy * 0.5 + Math.sin(out) * s,
        life: l, max: l, color,
      });
    }
  }

  ring(x, y, color, maxR = 60, life = 0.45) {
    this.list.push({ kind: 'ring', x, y, vx: 0, vy: 0, r: 0, maxR, life, max: life, color });
  }

  text(x, y, text, color = '#fff', size = 16) {
    this.list.push({ kind: 'text', x, y, vx: 0, vy: -38, life: 0.9, max: 0.9, text, color, size });
  }

  update(dt) {
    const drag = Math.exp(-1.6 * dt);
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list[i] = list[list.length - 1];
        list.pop();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'spark' || p.kind === 'line') {
        p.vx *= drag;
        p.vy *= drag;
      }
      if (p.kind === 'line') p.rot += p.spin * dt;
      if (p.kind === 'ring') p.r = p.maxR * (1 - p.life / p.max);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of this.list) {
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, t * 1.4);
      switch (p.kind) {
        case 'spark':
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case 'line': {
          const c = Math.cos(p.rot), s = Math.sin(p.rot);
          const hx = p.hx * c - p.hy * s;
          const hy = p.hx * s + p.hy * c;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x - hx, p.y - hy);
          ctx.lineTo(p.x + hx, p.y + hy);
          ctx.stroke();
          break;
        }
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2.5 * t + 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, TAU);
          ctx.stroke();
          break;
        case 'text':
          ctx.fillStyle = p.color;
          ctx.font = `700 ${p.size}px ui-monospace, Menlo, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.text, p.x, p.y);
          break;
      }
    }
    ctx.restore();
  }
}
