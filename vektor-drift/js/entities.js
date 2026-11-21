// Spielobjekte: Schiff, Projektile, Felsbrocken, UFO-Drohnen

import { TAU, rand, randInt, wrap, transformPoints } from './vec.js';

export const COLORS = {
  ship: '#3ff6ff',
  flame: '#ffb347',
  shipBullet: '#c8ffff',
  ufo: '#ff3cac',
  ufoBullet: '#ff8ad8',
  rock: { 3: '#ffd166', 2: '#ffb347', 1: '#ff8c5a' },
};

export function strokePoly(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

// ------------------------------------------------------------------ Schiff

const SHIP_SHAPE = [[19, 0], [-9, -12], [-13, -12], [-6, 0], [-13, 12], [-9, 12]];
const ROT_SPEED = 4.4;    // rad/s
const THRUST = 400;       // Einheiten/s²
const DAMPING = 0.38;     // exponentielle Reibung
const MAX_SPEED = 500;

export class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.a = -Math.PI / 2;
    this.r = 12;
    this.invuln = 2.5;
    this.thrusting = false;
    this.fireCd = 0;
    this.hyperCd = 0;
  }

  update(dt, ctrl, W, H) {
    if (ctrl.left) this.a -= ROT_SPEED * dt;
    if (ctrl.right) this.a += ROT_SPEED * dt;
    this.thrusting = ctrl.thrust;
    if (this.thrusting) {
      this.vx += Math.cos(this.a) * THRUST * dt;
      this.vy += Math.sin(this.a) * THRUST * dt;
    }
    const d = Math.exp(-DAMPING * dt);
    this.vx *= d;
    this.vy *= d;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > MAX_SPEED) {
      this.vx *= MAX_SPEED / sp;
      this.vy *= MAX_SPEED / sp;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    wrap(this, W, H);
    this.invuln = Math.max(0, this.invuln - dt);
    this.fireCd -= dt;
    this.hyperCd -= dt;
  }

  get noseX() { return this.x + Math.cos(this.a) * 19; }
  get noseY() { return this.y + Math.sin(this.a) * 19; }

  points() {
    return transformPoints(SHIP_SHAPE, this.x, this.y, this.a);
  }

  draw(ctx, time) {
    if (this.invuln > 0 && Math.floor(time * 12) % 2 === 0) return;
    ctx.strokeStyle = COLORS.ship;
    ctx.shadowColor = COLORS.ship;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    strokePoly(ctx, this.points());
    ctx.fillStyle = 'rgba(63,246,255,0.08)';
    ctx.fill();
    ctx.stroke();

    // Cockpit-Linie
    const cp = transformPoints([[8, 0], [1, 0]], this.x, this.y, this.a);
    strokePoly(ctx, cp, false);
    ctx.stroke();

    if (this.thrusting && Math.random() > 0.15) {
      const len = 16 + Math.random() * 12;
      const flame = transformPoints([[-8, -6], [-8 - len, 0], [-8, 6]], this.x, this.y, this.a);
      ctx.strokeStyle = COLORS.flame;
      ctx.shadowColor = COLORS.flame;
      strokePoly(ctx, flame, false);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  /** Kleines Lebens-Symbol fürs HUD. */
  static drawIcon(ctx, x, y, scale = 0.8) {
    ctx.strokeStyle = COLORS.ship;
    ctx.lineWidth = 1.6;
    strokePoly(ctx, transformPoints(SHIP_SHAPE, x, y, -Math.PI / 2, scale));
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ Projektil

export class Bullet {
  constructor(x, y, vx, vy, owner, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.owner = owner; // 'ship' | 'ufo'
    this.life = life;
    this.r = 2.5;
    this.dead = false;
  }

  update(dt, W, H) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    wrap(this, W, H, 0);
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const color = this.owner === 'ship' ? COLORS.shipBullet : COLORS.ufoBullet;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x - this.vx * 0.018, this.y - this.vy * 0.018);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

// ------------------------------------------------------------------ Felsbrocken

export const ROCK_RADIUS = { 3: 46, 2: 25, 1: 13 };
export const ROCK_POINTS = { 3: 20, 2: 50, 1: 100 };

export class Rock {
  constructor(x, y, size, vx, vy) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.vx = vx;
    this.vy = vy;
    this.r = ROCK_RADIUS[size];
    this.a = rand(0, TAU);
    this.spin = rand(-1, 1) * (0.25 + (3 - size) * 0.45);
    this.dead = false;

    // Zerklüftete, zufällige Kontur
    const n = randInt(9, 13);
    this.shape = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + rand(-0.25, 0.25) * (TAU / n);
      const rr = this.r * rand(0.7, 1.08);
      this.shape.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
    }
    // Ein paar Krater-Linien für Tiefe (nur bei großen Brocken)
    this.detail = [];
    if (size >= 2) {
      const k = size === 3 ? 2 : 1;
      for (let i = 0; i < k; i++) {
        const ca = rand(0, TAU), cr = rand(0.15, 0.45) * this.r, cs = rand(0.12, 0.2) * this.r;
        const cx = Math.cos(ca) * cr, cy = Math.sin(ca) * cr;
        this.detail.push([[cx - cs, cy], [cx, cy - cs * 0.6], [cx + cs, cy]]);
      }
    }
  }

  static spawnAtEdge(W, H, speedMul, avoid) {
    let x, y;
    for (let tries = 0; tries < 20; tries++) {
      if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? rand(-40, W * 0.2) : rand(W * 0.8, W + 40);
        y = rand(0, H);
      } else {
        x = rand(0, W);
        y = Math.random() < 0.5 ? rand(-40, H * 0.2) : rand(H * 0.8, H + 40);
      }
      if (!avoid || Math.hypot(x - avoid.x, y - avoid.y) > 220) break;
    }
    const a = rand(0, TAU);
    const s = rand(30, 70) * speedMul;
    return new Rock(x, y, 3, Math.cos(a) * s, Math.sin(a) * s);
  }

  update(dt, W, H) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.a += this.spin * dt;
    wrap(this, W, H);
  }

  points() {
    return transformPoints(this.shape, this.x, this.y, this.a);
  }

  draw(ctx) {
    const color = COLORS.rock[this.size];
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    strokePoly(ctx, this.points());
    ctx.fillStyle = 'rgba(255,170,70,0.045)';
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (this.detail.length) {
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.5;
      for (const d of this.detail) {
        strokePoly(ctx, transformPoints(d, this.x, this.y, this.a), false);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}

// ------------------------------------------------------------------ UFO-Drohne

const UFO_HULL = [[-22, 2], [-12, -6], [12, -6], [22, 2], [12, 9], [-12, 9]];
const UFO_DOME = [[-8, -6], [-5, -13], [5, -13], [8, -6]];
const UFO_FINS = [[-12, 9], [-15, 14], [15, 14], [12, 9]];

export class Ufo {
  constructor(small, W, H, level) {
    this.small = small;
    this.scale = small ? 0.58 : 1;
    this.r = small ? 12 : 20;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.x = this.dir > 0 ? -this.r : W + this.r;
    this.y = rand(H * 0.15, H * 0.85);
    this.speed = (small ? 155 : 105) * (1 + Math.min(level, 10) * 0.03);
    this.vx = this.dir * this.speed;
    this.vy = 0;
    this.turnT = rand(0.8, 2);
    this.fireT = rand(0.5, 1.1);
    this.dead = false;
    this.gone = false;
    this.t = 0;
  }

  get points() { return this.small ? 1000 : 200; }

  update(dt, W, H) {
    this.t += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.turnT -= dt;
    if (this.turnT <= 0) {
      this.turnT = rand(0.7, 1.8);
      this.vy = [-1, 0, 0, 1][randInt(0, 3)] * this.speed * 0.7;
    }
    if (this.y < -this.r) this.y += H + 2 * this.r;
    else if (this.y > H + this.r) this.y -= H + 2 * this.r;
    if ((this.dir > 0 && this.x > W + this.r + 4) || (this.dir < 0 && this.x < -this.r - 4)) this.gone = true;
  }

  outline() {
    return transformPoints(UFO_HULL, this.x, this.y, 0, this.scale);
  }

  draw(ctx) {
    const s = this.scale;
    ctx.strokeStyle = COLORS.ufo;
    ctx.shadowColor = COLORS.ufo;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    strokePoly(ctx, this.outline());
    ctx.fillStyle = 'rgba(255,60,172,0.1)';
    ctx.fill();
    ctx.stroke();
    strokePoly(ctx, transformPoints(UFO_DOME, this.x, this.y, 0, s), false);
    ctx.stroke();
    strokePoly(ctx, transformPoints(UFO_FINS, this.x, this.y, 0, s), false);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Umlaufende Positionslichter
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      const p = ((this.t * 1.6 + i / 4) % 1) * 2 - 1; // -1..1
      ctx.globalAlpha = 1 - Math.abs(p) * 0.7;
      ctx.fillRect(this.x + p * 15 * s - 1.5, this.y + 1.5 * s - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
}
