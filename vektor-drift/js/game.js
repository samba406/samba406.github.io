// Spiellogik: Zustände, Wellen, Kollisionen, Punkte, Rendering

import { Ship, Bullet, Rock, Ufo, COLORS, ROCK_POINTS } from './entities.js';
import { Particles } from './particles.js';
import { TAU, rand, clamp, lerp, circlesHit, dist2 } from './vec.js';
import { loadHighscores, qualifies, insertHighscore } from './storage.js';

const BASE = 720;               // kürzere Bildschirmseite = 720 Spieleinheiten
const SHIP_BULLET_SPEED = 580;
const SHIP_BULLET_LIFE = 0.95;
const MAX_SHIP_BULLETS = 5;
const FIRE_COOLDOWN = 0.17;
const EXTRA_LIFE_EVERY = 10000;
const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export class Game {
  constructor(canvas, input, sound, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.sound = sound;
    this.ui = ui; // { showNameEntry(score), hideNameEntry() }
    this.particles = new Particles();
    this.highscores = loadHighscores();
    this.highlight = -1;
    this.state = 'title';
    this.stateTime = 0;
    this.time = 0;
    this.shake = 0;
    this.rocks = [];
    this.bullets = [];
    this.ship = null;
    this.ufo = null;
    this.score = 0;
    this.lives = 0;
    this.level = 0;
    this.banner = null;
    this.resize();
    this.spawnAttractRocks();
  }

  // ------------------------------------------------------------ Setup

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.k = (dpr * Math.min(w, h)) / BASE;
    this.W = (w * dpr) / this.k;
    this.H = (h * dpr) / this.k;
    this.stars = [];
    const n = Math.round((this.W * this.H) / 3500);
    for (let i = 0; i < n; i++) {
      this.stars.push({ x: rand(0, this.W), y: rand(0, this.H), s: rand(0.6, 1.8), p: rand(0, TAU), f: rand(0.5, 2) });
    }
  }

  spawnAttractRocks() {
    this.rocks = [];
    for (let i = 0; i < 6; i++) this.rocks.push(Rock.spawnAtEdge(this.W, this.H, 1, null));
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  start() {
    this.sound.stopLoops();
    this.score = 0;
    this.lives = 3;
    this.level = 0;
    this.nextLife = EXTRA_LIFE_EVERY;
    this.bullets = [];
    this.rocks = [];
    this.ufo = null;
    this.particles.clear();
    this.highlight = -1;
    this.ship = new Ship(this.W / 2, this.H / 2);
    this.respawnTimer = 0;
    this.beatTimer = 1;
    this.beatHigh = false;
    this.setState('playing');
    this.nextLevel();
  }

  nextLevel() {
    this.level++;
    const count = Math.min(3 + this.level, 11);
    const speedMul = 1 + (this.level - 1) * 0.07;
    for (let i = 0; i < count; i++) {
      this.rocks.push(Rock.spawnAtEdge(this.W, this.H, speedMul, this.ship || { x: this.W / 2, y: this.H / 2 }));
    }
    this.waveMass = count * 7;
    this.levelTimer = 0;
    this.ufoTimer = this.randomUfoDelay();
    this.banner = { text: `WELLE ${this.level}`, t: 2.2 };
    this.sound.waveStart();
  }

  randomUfoDelay() {
    return rand(13, 22) - Math.min(this.level, 8) * 0.9;
  }

  // ------------------------------------------------------------ Update

  update(dt) {
    this.time += dt;
    this.stateTime += dt;
    const input = this.input;

    if (input.consume('mute')) this.ui.setMuted(this.sound.toggleMute());

    this.particles.update(dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;

    switch (this.state) {
      case 'title':
        this.updateWorld(dt);
        if (this.stateTime > 0.6 && (input.consume('tap') || input.consume('start') || input.consume('fire'))) {
          this.start();
        }
        input.consume('pause');
        return;

      case 'paused':
        if (input.consume('pause') || input.consume('start') || input.consume('tap')) {
          this.setState('playing');
        }
        return;

      case 'entering':
        this.updateWorld(dt);
        return;

      case 'gameover':
        this.updateWorld(dt);
        this.collide();
        if (this.stateTime > 3.2 || (this.stateTime > 1.2 && (input.consume('tap') || input.consume('start')))) {
          this.sound.ufo(false);
          if (qualifies(this.highscores, this.score)) {
            this.setState('entering');
            this.ui.showNameEntry(this.score);
          } else {
            this.setState('title');
          }
        }
        return;

      case 'playing':
        if (input.consume('pause')) {
          this.sound.stopLoops();
          this.setState('paused');
          return;
        }
        this.updatePlaying(dt);
    }
  }

  submitName(name) {
    this.highlight = insertHighscore(this.highscores, name, this.score, this.level);
    this.ui.hideNameEntry();
    this.setState('title');
  }

  updatePlaying(dt) {
    const input = this.input;
    const ship = this.ship;

    if (ship) {
      ship.update(dt, {
        left: input.down('left'),
        right: input.down('right'),
        thrust: input.down('thrust'),
      }, this.W, this.H);
      this.sound.thrust(ship.thrusting);
      if (ship.thrusting && Math.random() < 0.6) {
        const back = ship.a + Math.PI;
        this.particles.spark(ship.x + Math.cos(back) * 10, ship.y + Math.sin(back) * 10, {
          count: 1, speed: 140, life: 0.35, color: Math.random() < 0.5 ? '#ffb347' : '#ff6a3d',
          vx: ship.vx, vy: ship.vy, angle: back, spread: 0.6,
        });
      }

      const wantsFire = input.consume('fire') || input.down('fire');
      if (wantsFire && ship.fireCd <= 0) this.fireShip();

      if (input.consume('hyper') && ship.hyperCd <= 0) this.hyperspace();
    } else {
      this.sound.thrust(false);
      input.consume('hyper');
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0 && this.lives > 0) {
        const c = { x: this.W / 2, y: this.H / 2 };
        const clear = this.rocks.every((r) => dist2(r, c) > (r.r + 110) ** 2) && !this.ufo;
        if (clear || this.respawnTimer < -2.5) {
          this.ship = new Ship(c.x, c.y);
          this.particles.ring(c.x, c.y, COLORS.ship, 50, 0.5);
        }
      }
    }

    this.updateWorld(dt);
    this.collide();

    // Welle geschafft?
    if (this.rocks.length === 0) {
      this.levelTimer += dt;
      if (this.levelTimer > 2) this.nextLevel();
    }

    // UFO-Spawn
    if (!this.ufo && this.ship) {
      this.ufoTimer -= dt;
      if (this.ufoTimer <= 0) {
        const pSmall = this.score >= 40000 ? 0.85 : this.score >= 10000 ? 0.5 : 0.18;
        this.ufo = new Ufo(Math.random() < pSmall, this.W, this.H, this.level);
        this.sound.ufo(true, this.ufo.small);
      }
    }

    // Herzschlag – wird schneller, je weniger Gestein übrig ist
    if (this.rocks.length) {
      const mass = this.rocks.reduce((m, r) => m + (r.size === 3 ? 7 : r.size === 2 ? 3 : 1), 0);
      const ratio = clamp(mass / this.waveMass, 0, 1);
      this.beatTimer -= dt;
      if (this.beatTimer <= 0) {
        this.beatHigh = !this.beatHigh;
        this.sound.beat(this.beatHigh);
        this.beatTimer = lerp(0.26, 0.95, ratio);
      }
    }

    // Extraleben
    if (this.score >= this.nextLife) {
      this.nextLife += EXTRA_LIFE_EVERY;
      this.lives++;
      this.sound.extraLife();
      this.banner = { text: 'EXTRALEBEN!', t: 1.6 };
    }
  }

  updateWorld(dt) {
    const { W, H } = this;
    for (const r of this.rocks) r.update(dt, W, H);
    for (const b of this.bullets) b.update(dt, W, H);

    const ufo = this.ufo;
    if (ufo) {
      ufo.update(dt, W, H);
      if (ufo.gone) {
        this.ufo = null;
        this.sound.ufo(false);
        this.ufoTimer = this.randomUfoDelay();
      } else if (this.state === 'playing') {
        ufo.fireT -= dt;
        if (ufo.fireT <= 0) {
          ufo.fireT = ufo.small ? rand(0.7, 1.0) : rand(1.0, 1.6);
          this.fireUfo(ufo);
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  fireShip() {
    const ship = this.ship;
    if (this.bullets.filter((b) => b.owner === 'ship').length >= MAX_SHIP_BULLETS) return;
    ship.fireCd = FIRE_COOLDOWN;
    const c = Math.cos(ship.a), s = Math.sin(ship.a);
    this.bullets.push(new Bullet(ship.noseX, ship.noseY, ship.vx + c * SHIP_BULLET_SPEED, ship.vy + s * SHIP_BULLET_SPEED, 'ship', SHIP_BULLET_LIFE));
    this.particles.spark(ship.noseX, ship.noseY, { count: 3, speed: 80, life: 0.15, color: '#c8ffff', angle: ship.a, spread: 0.8, vx: ship.vx, vy: ship.vy });
    this.sound.fire();
  }

  fireUfo(ufo) {
    let a;
    const ship = this.ship;
    if (ufo.small && ship) {
      const err = Math.max(0.04, 0.4 - this.score / 50000);
      a = Math.atan2(ship.y - ufo.y, ship.x - ufo.x) + rand(-err, err);
    } else if (ship && Math.random() < 0.25) {
      a = Math.atan2(ship.y - ufo.y, ship.x - ufo.x) + rand(-0.5, 0.5);
    } else {
      a = rand(0, TAU);
    }
    const sp = 330;
    this.bullets.push(new Bullet(ufo.x + Math.cos(a) * ufo.r, ufo.y + Math.sin(a) * ufo.r, Math.cos(a) * sp, Math.sin(a) * sp, 'ufo', 1.25));
    this.sound.ufoFire();
  }

  hyperspace() {
    const ship = this.ship;
    this.particles.spark(ship.x, ship.y, { count: 24, speed: 220, life: 0.5, color: '#c9a0ff' });
    this.particles.ring(ship.x, ship.y, '#c9a0ff', 40, 0.35);
    ship.x = rand(this.W * 0.1, this.W * 0.9);
    ship.y = rand(this.H * 0.1, this.H * 0.9);
    ship.vx *= 0.2;
    ship.vy *= 0.2;
    ship.hyperCd = 1.0;
    ship.invuln = Math.max(ship.invuln, 0.35);
    this.particles.ring(ship.x, ship.y, '#c9a0ff', 50, 0.4);
    this.sound.hyperspace();
  }

  // ------------------------------------------------------------ Kollisionen

  collide() {
    const rocks = this.rocks;
    const newRocks = [];

    // Projektile
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const r of rocks) {
        if (!r.dead && circlesHit(b, r, b.r, r.r * 0.9)) {
          b.dead = true;
          this.breakRock(r, b.owner === 'ship', b, newRocks);
          break;
        }
      }
      if (b.dead) continue;
      if (b.owner === 'ship' && this.ufo && circlesHit(b, this.ufo)) {
        b.dead = true;
        this.destroyUfo(true);
      } else if (b.owner === 'ufo' && this.ship && !this.ship.invuln && circlesHit(b, this.ship, b.r, this.ship.r * 0.85)) {
        b.dead = true;
        this.killShip();
      }
    }

    // Schiff gegen Gestein / UFO
    const ship = this.ship;
    if (ship && !ship.invuln) {
      for (const r of rocks) {
        if (!r.dead && circlesHit(ship, r, ship.r * 0.85, r.r * 0.88)) {
          this.breakRock(r, true, ship, newRocks);
          this.killShip();
          break;
        }
      }
      if (this.ship && this.ufo && circlesHit(this.ship, this.ufo)) {
        this.destroyUfo(true);
        this.killShip();
      }
    }

    // UFO gegen Gestein
    if (this.ufo) {
      for (const r of rocks) {
        if (!r.dead && circlesHit(this.ufo, r, this.ufo.r, r.r * 0.88)) {
          this.breakRock(r, false, this.ufo, newRocks);
          this.destroyUfo(false);
          break;
        }
      }
    }

    this.rocks = rocks.filter((r) => !r.dead).concat(newRocks);
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  breakRock(r, byPlayer, hitter, out) {
    r.dead = true;
    const color = COLORS.rock[r.size];
    if (byPlayer && this.state === 'playing') {
      const pts = ROCK_POINTS[r.size];
      this.score += pts;
      this.particles.text(r.x, r.y, String(pts), color, 13 + r.size * 2);
    }
    this.particles.debris(r.points(), color, r.vx, r.vy, { speed: 40 + (4 - r.size) * 20, life: 0.5 + r.size * 0.25 });
    this.particles.spark(r.x, r.y, { count: 6 + r.size * 6, speed: 100 + r.size * 40, life: 0.6, color });
    if (r.size === 3) this.particles.ring(r.x, r.y, color, 70, 0.4);
    this.shake = Math.max(this.shake, r.size * 2);
    this.sound.explode(r.size);

    if (r.size > 1) {
      const baseSpeed = Math.hypot(r.vx, r.vy);
      for (let i = 0; i < 2; i++) {
        const a = rand(0, TAU);
        const s = clamp(baseSpeed * rand(1.1, 1.6) + rand(15, 45), 40, 230);
        const nvx = Math.cos(a) * s + (hitter.vx || 0) * 0.08;
        const nvy = Math.sin(a) * s + (hitter.vy || 0) * 0.08;
        out.push(new Rock(r.x, r.y, r.size - 1, nvx, nvy));
      }
    }
  }

  destroyUfo(byPlayer) {
    const u = this.ufo;
    if (!u) return;
    if (byPlayer && this.state === 'playing') {
      this.score += u.points;
      this.particles.text(u.x, u.y, String(u.points), COLORS.ufo, 18);
    }
    this.particles.debris(u.outline(), COLORS.ufo, u.vx, u.vy, { speed: 90, life: 1.1 });
    this.particles.spark(u.x, u.y, { count: 40, speed: 260, life: 0.9, color: COLORS.ufo });
    this.particles.spark(u.x, u.y, { count: 15, speed: 160, life: 0.6, color: '#ffffff' });
    this.particles.ring(u.x, u.y, COLORS.ufo, 80, 0.5);
    this.shake = Math.max(this.shake, 8);
    this.sound.ufo(false);
    this.sound.ufoExplode();
    this.ufo = null;
    this.ufoTimer = this.randomUfoDelay();
  }

  killShip() {
    const s = this.ship;
    if (!s) return;
    this.particles.debris(s.points(), COLORS.ship, s.vx, s.vy, { speed: 60, life: 2.0 });
    this.particles.spark(s.x, s.y, { count: 50, speed: 280, life: 1.1, color: COLORS.ship, vx: s.vx * 0.3, vy: s.vy * 0.3 });
    this.particles.spark(s.x, s.y, { count: 25, speed: 180, life: 0.8, color: '#ffb347' });
    this.particles.ring(s.x, s.y, COLORS.ship, 110, 0.6);
    this.shake = 14;
    this.sound.thrust(false);
    this.sound.shipExplode();
    this.ship = null;
    this.lives--;
    this.respawnTimer = 2.2;
    if (this.lives <= 0) {
      this.sound.gameOver();
      this.setState('gameover');
    }
  }

  // ------------------------------------------------------------ Rendering

  render() {
    const ctx = this.ctx;
    const k = this.k;
    const t = this.time;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04050d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const sx = this.shake ? rand(-this.shake, this.shake) * 0.5 : 0;
    const sy = this.shake ? rand(-this.shake, this.shake) * 0.5 : 0;
    ctx.setTransform(k, 0, 0, k, sx * k, sy * k);

    // Sterne
    ctx.fillStyle = '#9fb7ff';
    for (const st of this.stars) {
      ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * st.f + st.p));
      ctx.fillRect(st.x, st.y, st.s, st.s);
    }
    ctx.globalAlpha = 1;

    for (const r of this.rocks) r.draw(ctx);
    if (this.ufo) this.ufo.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);
    if (this.ship && this.state !== 'title') this.ship.draw(ctx, t);
    this.particles.draw(ctx);

    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (this.state !== 'title') this.drawHud(ctx);

    switch (this.state) {
      case 'title': this.drawTitle(ctx); break;
      case 'paused':
        this.dim(ctx, 0.45);
        this.text(ctx, 'PAUSE', this.W / 2, this.H / 2 - 20, 56, COLORS.ship, 20);
        this.text(ctx, this.input.isTouch ? 'Tippen zum Fortsetzen' : 'P drücken zum Fortsetzen', this.W / 2, this.H / 2 + 34, 18, '#e8f6ff', 0);
        break;
      case 'gameover':
      case 'entering':
        this.text(ctx, 'GAME OVER', this.W / 2, this.H * 0.22, 54, COLORS.ufo, 22);
        break;
    }

    if (this.banner && this.state === 'playing') {
      const a = clamp(this.banner.t / 0.5, 0, 1);
      ctx.globalAlpha = a;
      this.text(ctx, this.banner.text, this.W / 2, this.H * 0.3, 36, '#ffd166', 16);
      ctx.globalAlpha = 1;
    }
  }

  dim(ctx, a) {
    ctx.fillStyle = `rgba(4,5,13,${a})`;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  text(ctx, str, x, y, size, color, glow = 10, align = 'center', weight = 700) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
    }
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  drawHud(ctx) {
    const pad = 18;
    this.text(ctx, String(this.score).padStart(6, '0'), pad, pad + 14, 30, '#e8f6ff', 8, 'left');
    for (let i = 0; i < Math.min(this.lives, 10); i++) Ship.drawIcon(ctx, pad + 10 + i * 22, pad + 52, 0.75);
    const best = Math.max(this.score, this.highscores[0]?.score || 0);
    this.text(ctx, `HI ${String(best).padStart(6, '0')}`, this.W / 2, pad + 12, 18, 'rgba(232,246,255,0.75)', 0);
    this.text(ctx, `WELLE ${this.level}`, this.W / 2, pad + 36, 14, 'rgba(232,246,255,0.5)', 0);
  }

  drawTitle(ctx) {
    const { W, H } = this;
    const t = this.time;
    this.dim(ctx, 0.35);
    const pulse = 18 + Math.sin(t * 2) * 6;
    this.text(ctx, 'VEKTOR', W / 2, H * 0.14, 64, COLORS.ship, pulse);
    this.text(ctx, 'DRIFT', W / 2, H * 0.14 + 62, 64, COLORS.ufo, pulse);

    // Highscore-Tabelle
    const top = H * 0.14 + 125;
    this.text(ctx, 'HIGHSCORES', W / 2, top, 18, '#ffd166', 6);
    const list = this.highscores;
    if (!list.length) {
      this.text(ctx, 'Noch keine Einträge – sei die/der Erste!', W / 2, top + 34, 15, 'rgba(232,246,255,0.6)', 0, 'center', 400);
    }
    const colW = Math.min(W * 0.8, 420);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const y = top + 30 + i * 24;
      const hl = i === this.highlight && Math.floor(t * 4) % 2 === 0;
      const c = hl ? '#ffffff' : i === 0 ? '#ffd166' : 'rgba(232,246,255,0.8)';
      this.text(ctx, `${String(i + 1).padStart(2, ' ')}.`, W / 2 - colW / 2, y, 16, c, 0, 'left', 400);
      this.text(ctx, e.name, W / 2 - colW / 2 + 44, y, 16, c, hl ? 8 : 0, 'left');
      this.text(ctx, String(e.score), W / 2 + colW / 2, y, 16, c, 0, 'right');
    }

    // Steuerung
    const cy = Math.max(top + 30 + Math.max(list.length, 1) * 24 + 30, H * 0.72);
    const hint = this.input.isTouch
      ? ['◀ ▶ drehen   ▲ Schub   ● Feuer   ✦ Hyperraum']
      : ['← → drehen   ↑ Schub   Leertaste Feuer', '↓ / H Hyperraum   P Pause   M Ton'];
    hint.forEach((h, i) => this.text(ctx, h, W / 2, cy + i * 24, 15, 'rgba(232,246,255,0.65)', 0, 'center', 400));

    if (Math.floor(t * 1.6) % 2 === 0) {
      this.text(ctx, this.input.isTouch ? 'TIPPEN ZUM STARTEN' : 'ENTER / KLICK ZUM STARTEN', W / 2, cy + hint.length * 24 + 30, 22, '#e8f6ff', 12);
    }
  }
}
