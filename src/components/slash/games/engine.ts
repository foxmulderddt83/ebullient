/**
 * Shared rendering engine for the price-slash mini-games.
 *
 * The detailed artwork (aircraft, jets, clouds) is drawn ONCE into an
 * offscreen canvas and then blitted each frame. Redrawing forty bezier
 * paths per aircraft per frame looks identical and murders a mid-range
 * phone; a cached sprite costs one drawImage. Everything expensive here
 * is therefore a factory that returns a canvas, not a per-frame painter.
 */

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

// =====================================================================
// Particles
// =====================================================================

type Kind = 'spark' | 'smoke' | 'debris' | 'fire' | 'confetti' | 'ring';

interface P {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  size: number; rot: number; vr: number;
  kind: Kind; color: string; grav: number; drag: number;
}

export class ParticleField {
  private list: P[] = [];
  /** Hard cap - a phone that drops frames looks worse than fewer sparks. */
  constructor(private cap = 320) {}

  private push(p: P) {
    if (this.list.length >= this.cap) this.list.shift();
    this.list.push(p);
  }

  /** A full fireball: flash ring, fire core, sparks, smoke and debris. */
  explosion(x: number, y: number, scale = 1) {
    this.push({ x, y, vx: 0, vy: 0, life: 1, max: 0.3, size: 4 * scale, rot: 0, vr: 0,
      kind: 'ring', color: '#fff7ed', grav: 0, drag: 1 });

    for (let i = 0; i < Math.round(14 * scale); i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(1, 5) * scale;
      this.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1, max: rnd(0.5, 0.9), size: rnd(5, 13) * scale, rot: 0, vr: 0,
        kind: 'fire', color: Math.random() < 0.5 ? '#fbbf24' : '#f97316', grav: -0.02, drag: 0.92 });
    }
    for (let i = 0; i < Math.round(16 * scale); i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(2, 9) * scale;
      this.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1, max: rnd(0.4, 1), size: rnd(1.5, 3.4), rot: 0, vr: 0,
        kind: 'spark', color: Math.random() < 0.35 ? '#fff' : '#fde68a', grav: 0.16, drag: 0.97 });
    }
    for (let i = 0; i < Math.round(7 * scale); i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.4, 1.8);
      this.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.3,
        life: 1, max: rnd(1.2, 2.2), size: rnd(14, 30) * scale, rot: rnd(0, 6.28), vr: rnd(-0.03, 0.03),
        kind: 'smoke', color: '#94a3b8', grav: -0.03, drag: 0.985 });
    }
    for (let i = 0; i < Math.round(6 * scale); i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(1.5, 6);
      this.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1, max: rnd(0.8, 1.5), size: rnd(3, 8), rot: rnd(0, 6.28), vr: rnd(-0.4, 0.4),
        kind: 'debris', color: '#334155', grav: 0.34, drag: 0.99 });
    }
  }

  /** Engine smoke / contrail puff. */
  smoke(x: number, y: number, size = 10, color = '#e2e8f0') {
    this.push({ x, y, vx: rnd(-0.3, 0.3), vy: rnd(-0.25, 0.05),
      life: 1, max: rnd(0.7, 1.4), size, rot: rnd(0, 6.28), vr: rnd(-0.02, 0.02),
      kind: 'smoke', color, grav: -0.01, drag: 0.99 });
  }

  confetti(x: number, y: number, n = 60) {
    const cols = ['#CD5C5C', '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1), s = rnd(3, 11);
      this.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1, max: rnd(1.4, 2.6), size: rnd(4, 9), rot: rnd(0, 6.28), vr: rnd(-0.3, 0.3),
        kind: 'confetti', color: cols[(Math.random() * cols.length) | 0], grav: 0.22, drag: 0.995 });
    }
  }

  update(dt: number) {
    for (const p of this.list) {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.grav;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= dt / (p.max * 60);
    }
    this.list = this.list.filter(p => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const a = clamp(p.life, 0, 1);
      ctx.save();
      switch (p.kind) {
        case 'ring': {
          // Expanding shockwave - reads as the blast front.
          // Short and sharp: a ring that lingers reads as a grey scribble.
          const t = 1 - a, r = p.size + t * 46;
          ctx.globalAlpha = a * a * 0.55;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4 * a + 0.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'fire': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a * 0.9;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (0.6 + a));
          g.addColorStop(0, '#fffbeb');
          g.addColorStop(0.4, p.color);
          g.addColorStop(1, 'rgba(249,115,22,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + a), 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'spark': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * 0.7;
          ctx.lineCap = 'round';
          // Streak along the direction of travel - a dot reads as dust.
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
          ctx.stroke();
          break;
        }
        case 'smoke': {
          const t = 1 - a;
          ctx.globalAlpha = a * 0.42;
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          const r = p.size * (0.7 + t * 1.5);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          g.addColorStop(0, p.color);
          g.addColorStop(1, 'rgba(148,163,184,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'debris': {
          ctx.globalAlpha = a;
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        }
        case 'confetti': {
          ctx.globalAlpha = a;
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          // Squashed by rotation so it flutters rather than spins flat.
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * Math.abs(Math.cos(p.rot)) * 0.8 + 1);
          break;
        }
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

// =====================================================================
// Camera shake + hit-stop
// =====================================================================

export class Shaker {
  private mag = 0;
  add(m: number) { this.mag = Math.min(26, this.mag + m); }
  update() { this.mag *= 0.88; if (this.mag < 0.15) this.mag = 0; }
  begin(ctx: CanvasRenderingContext2D) {
    if (!this.mag) return;
    ctx.save();
    ctx.translate(rnd(-this.mag, this.mag), rnd(-this.mag, this.mag));
  }
  end(ctx: CanvasRenderingContext2D) { if (this.mag) ctx.restore(); }
}

/** Floating "+RM 0.50" style callouts. */
export class Callouts {
  private list: { x: number; y: number; t: number; text: string; color: string }[] = [];
  add(x: number, y: number, text: string, color = '#fde68a') {
    this.list.push({ x, y, t: 0, text, color });
  }
  update(dt: number) {
    for (const c of this.list) { c.t += dt / 60; c.y -= dt * 0.85; }
    this.list = this.list.filter(c => c.t < 1);
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const c of this.list) {
      const a = 1 - c.t;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(c.x, c.y);
      ctx.scale(easeOutBack(Math.min(1, c.t * 4)), easeOutBack(Math.min(1, c.t * 4)));
      ctx.font = '900 18px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(15,23,42,0.75)';
      ctx.strokeText(c.text, 0, 0);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

// =====================================================================
// Sprites
// =====================================================================

/**
 * A high-wing light aircraft in side view, facing right - the shape the
 * club actually flies. Drawn at a canonical 256x150 and scaled at blit
 * time so one sprite serves every size on screen.
 */
export const createAircraftSprite = (accent = '#CD5C5C'): HTMLCanvasElement => {
  const W = 256, H = 150;
  const c = mk(W, H);
  const g = c.getContext('2d')!;
  const cy = 92;

  // ---- tail fin ----
  g.fillStyle = '#e2e8f0';
  g.beginPath();
  g.moveTo(52, cy - 4);
  g.quadraticCurveTo(46, cy - 44, 60, cy - 52);
  g.lineTo(84, cy - 6);
  g.closePath();
  g.fill();
  g.fillStyle = accent;
  g.beginPath();
  g.moveTo(54, cy - 22); g.quadraticCurveTo(50, cy - 44, 60, cy - 52);
  g.lineTo(74, cy - 26); g.closePath();
  g.fill();

  // ---- horizontal stabiliser ----
  g.fillStyle = '#cbd5e1';
  g.beginPath();
  g.moveTo(44, cy - 2); g.lineTo(96, cy - 6); g.lineTo(96, cy + 2); g.lineTo(44, cy + 5);
  g.closePath(); g.fill();

  // ---- fuselage ----
  const body = g.createLinearGradient(0, cy - 26, 0, cy + 24);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.45, '#e8eef5');
  body.addColorStop(1, '#8fa3b8');       // underside in shadow
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(226, cy - 2);                                  // nose
  g.quadraticCurveTo(214, cy - 24, 168, cy - 26);         // windscreen line
  g.lineTo(104, cy - 22);
  g.quadraticCurveTo(70, cy - 18, 50, cy - 4);            // tail cone top
  g.lineTo(50, cy + 4);
  g.quadraticCurveTo(84, cy + 14, 130, cy + 20);          // belly
  g.lineTo(196, cy + 18);
  g.quadraticCurveTo(220, cy + 14, 226, cy - 2);
  g.closePath();
  g.fill();

  // rim light along the top
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(168, cy - 25); g.quadraticCurveTo(214, cy - 23, 225, cy - 3);
  g.stroke();

  // ---- accent stripe ----
  g.fillStyle = accent;
  g.beginPath();
  g.moveTo(58, cy + 2); g.lineTo(214, cy + 4);
  g.lineTo(214, cy + 10); g.lineTo(58, cy + 7);
  g.closePath(); g.fill();

  // ---- cabin glass ----
  const glass = g.createLinearGradient(0, cy - 24, 0, cy - 4);
  glass.addColorStop(0, '#bae6fd');
  glass.addColorStop(1, '#0c4a6e');
  g.fillStyle = glass;
  g.beginPath();
  g.moveTo(206, cy - 8); g.quadraticCurveTo(202, cy - 21, 178, cy - 22);
  g.lineTo(140, cy - 20); g.lineTo(140, cy - 6); g.lineTo(206, cy - 8);
  g.closePath(); g.fill();
  // window frame + reflection
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.moveTo(150, cy - 19); g.lineTo(168, cy - 19); g.lineTo(156, cy - 8); g.lineTo(144, cy - 8);
  g.closePath(); g.fill();

  // ---- high wing ----
  const wing = g.createLinearGradient(0, cy - 46, 0, cy - 32);
  wing.addColorStop(0, '#ffffff');
  wing.addColorStop(1, '#c3d0de');
  g.fillStyle = wing;
  g.beginPath();
  g.moveTo(92, cy - 34);
  g.quadraticCurveTo(150, cy - 46, 214, cy - 42);
  g.quadraticCurveTo(220, cy - 36, 210, cy - 32);
  g.lineTo(96, cy - 28);
  g.closePath();
  g.fill();
  g.fillStyle = accent;
  g.fillRect(196, cy - 42, 12, 9);          // wingtip flash

  // wing struts
  g.strokeStyle = '#94a3b8'; g.lineWidth = 3;
  g.beginPath();
  g.moveTo(112, cy - 28); g.lineTo(132, cy - 14);
  g.moveTo(150, cy - 30); g.lineTo(136, cy - 14);
  g.stroke();

  // ---- landing gear ----
  g.strokeStyle = '#64748b'; g.lineWidth = 4;
  g.beginPath();
  g.moveTo(150, cy + 18); g.lineTo(142, cy + 34);
  g.moveTo(200, cy + 16); g.lineTo(206, cy + 30);
  g.stroke();
  g.fillStyle = '#1e293b';
  g.beginPath(); g.arc(141, cy + 37, 7, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(207, cy + 33, 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#475569';
  g.beginPath(); g.arc(141, cy + 37, 2.6, 0, Math.PI * 2); g.fill();

  // ---- spinner ----
  g.fillStyle = accent;
  g.beginPath();
  g.moveTo(226, cy - 8); g.quadraticCurveTo(238, cy - 2, 226, cy + 6);
  g.closePath(); g.fill();

  return c;
};

/**
 * A delta-wing jet seen from above, nose-down - the shooter's targets are
 * diving at the player, so top-down is the honest projection.
 */
export const createJetSprite = (accent = '#CD5C5C'): HTMLCanvasElement => {
  const W = 150, H = 200;
  const c = mk(W, H);
  const g = c.getContext('2d')!;
  const cx = W / 2;

  // ---- shadowed underside offset, for a little depth ----
  g.fillStyle = 'rgba(2,6,23,0.35)';
  g.beginPath();
  g.moveTo(cx + 4, 186); g.lineTo(cx + 62, 128); g.lineTo(cx + 62, 150);
  g.lineTo(cx + 4, 176); g.closePath(); g.fill();

  // ---- wings ----
  const wg = g.createLinearGradient(0, 60, 0, 170);
  wg.addColorStop(0, '#64748b');
  wg.addColorStop(0.5, '#475569');
  wg.addColorStop(1, '#1e293b');
  g.fillStyle = wg;
  g.beginPath();
  g.moveTo(cx, 40);
  g.lineTo(cx + 58, 140);
  g.lineTo(cx + 22, 150);
  g.lineTo(cx + 14, 176);
  g.lineTo(cx - 14, 176);
  g.lineTo(cx - 22, 150);
  g.lineTo(cx - 58, 140);
  g.closePath();
  g.fill();

  // panel lines
  g.strokeStyle = 'rgba(15,23,42,0.5)'; g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx - 30, 128); g.lineTo(cx - 12, 96);
  g.moveTo(cx + 30, 128); g.lineTo(cx + 12, 96);
  g.stroke();

  // ---- fuselage spine ----
  const fg = g.createLinearGradient(cx - 16, 0, cx + 16, 0);
  fg.addColorStop(0, '#94a3b8');
  fg.addColorStop(0.45, '#e2e8f0');
  fg.addColorStop(1, '#475569');
  g.fillStyle = fg;
  g.beginPath();
  g.moveTo(cx, 16);
  g.quadraticCurveTo(cx + 15, 70, cx + 15, 150);
  g.lineTo(cx + 10, 178);
  g.lineTo(cx - 10, 178);
  g.lineTo(cx - 15, 150);
  g.quadraticCurveTo(cx - 15, 70, cx, 16);
  g.closePath();
  g.fill();

  // ---- canopy ----
  const cg = g.createLinearGradient(cx - 10, 46, cx + 10, 92);
  cg.addColorStop(0, '#7dd3fc');
  cg.addColorStop(0.6, '#0369a1');
  cg.addColorStop(1, '#082f49');
  g.fillStyle = cg;
  g.beginPath();
  g.ellipse(cx, 70, 11, 26, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.beginPath(); g.ellipse(cx - 4, 60, 3.4, 10, -0.2, 0, Math.PI * 2); g.fill();

  // ---- accent flashes ----
  g.fillStyle = accent;
  g.beginPath(); g.moveTo(cx - 40, 132); g.lineTo(cx - 26, 132); g.lineTo(cx - 20, 144); g.lineTo(cx - 34, 144); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx + 40, 132); g.lineTo(cx + 26, 132); g.lineTo(cx + 20, 144); g.lineTo(cx + 34, 144); g.closePath(); g.fill();

  // ---- tail fins ----
  g.fillStyle = '#334155';
  g.beginPath(); g.moveTo(cx - 8, 150); g.lineTo(cx - 24, 184); g.lineTo(cx - 6, 176); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx + 8, 150); g.lineTo(cx + 24, 184); g.lineTo(cx + 6, 176); g.closePath(); g.fill();

  return c;
};

/** A soft, layered cumulus puff. */
export const createCloudSprite = (w = 200, h = 96): HTMLCanvasElement => {
  const c = mk(w, h);
  const g = c.getContext('2d')!;
  const blobs = 7 + ((Math.random() * 4) | 0);
  for (let i = 0; i < blobs; i++) {
    const bx = rnd(w * 0.2, w * 0.8);
    const by = rnd(h * 0.45, h * 0.72);
    const r = rnd(h * 0.22, h * 0.4);
    // Lit from above: the gradient origin sits high in each blob.
    const grad = g.createRadialGradient(bx, by - r * 0.45, r * 0.15, bx, by, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.98)');
    grad.addColorStop(0.55, 'rgba(241,245,249,0.85)');
    grad.addColorStop(1, 'rgba(203,213,225,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill();
  }
  return c;
};

// =====================================================================
// Backdrops
// =====================================================================

export interface Cloud { x: number; y: number; s: number; v: number; sprite: HTMLCanvasElement; a: number }

export const makeClouds = (w: number, h: number, n = 7): Cloud[] => {
  const out: Cloud[] = [];
  for (let i = 0; i < n; i++) {
    const depth = Math.random();          // 0 = far, 1 = near
    out.push({
      x: rnd(-200, w + 200),
      y: rnd(h * 0.04, h * 0.75),
      s: lerp(0.3, 0.85, depth),
      v: lerp(0.1, 0.5, depth),
      a: lerp(0.22, 0.6, depth),
      sprite: createCloudSprite(),
    });
  }
  return out.sort((a, b) => a.s - b.s);   // far ones painted first
};

export const drawClouds = (
  ctx: CanvasRenderingContext2D, clouds: Cloud[], w: number, dt: number, dir = -1,
) => {
  for (const c of clouds) {
    c.x += c.v * dt * dir;
    const cw = c.sprite.width * c.s;
    if (dir < 0 && c.x < -cw) c.x = w + rnd(20, 260);
    if (dir > 0 && c.x > w) c.x = -cw - rnd(20, 260);
    ctx.globalAlpha = c.a;
    ctx.drawImage(c.sprite, c.x, c.y, cw, c.sprite.height * c.s);
  }
  ctx.globalAlpha = 1;
};

/** Daylight sky with a sun, bloom and haze band. */
export const drawDaySky = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0b3a63');
  sky.addColorStop(0.32, '#1b7fc4');
  sky.addColorStop(0.68, '#63b8e8');
  sky.addColorStop(1, '#cfeaf8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // sun + bloom, drifting very slightly so the scene is never static
  const sx = w * 0.82 + Math.sin(t / 4200) * 8;
  const sy = h * 0.16;
  const bloom = ctx.createRadialGradient(sx, sy, 0, sx, sy, h * 0.62);
  bloom.addColorStop(0, 'rgba(255,247,214,0.95)');
  bloom.addColorStop(0.14, 'rgba(255,236,170,0.42)');
  bloom.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.arc(sx, sy, h * 0.045, 0, Math.PI * 2); ctx.fill();
};

/** Distant terrain: two ridges plus a haze wash for aerial perspective. */
export const drawRidges = (ctx: CanvasRenderingContext2D, w: number, h: number, offset: number) => {
  const ridge = (yBase: number, amp: number, col: string, step: number, phase: number) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) {
      const y = yBase
        + Math.sin((x + offset * step + phase) / 120) * amp
        + Math.sin((x + offset * step * 1.7 + phase) / 47) * (amp * 0.35);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  };
  ridge(h * 0.86, 12, 'rgba(148,183,204,0.55)', 0.18, 0);
  ridge(h * 0.93, 9, 'rgba(100,140,166,0.75)', 0.34, 90);
};

/** Night sky for the shooter: stars, moon, and a city glow on the deck. */
export const drawNightSky = (
  ctx: CanvasRenderingContext2D, w: number, h: number,
  stars: { x: number; y: number; r: number; p: number }[], t: number,
) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#05070f');
  sky.addColorStop(0.45, '#0f1f3d');
  sky.addColorStop(0.8, '#1e3a63');
  sky.addColorStop(1, '#2f5c86');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  for (const s of stars) {
    ctx.globalAlpha = 0.35 + Math.abs(Math.sin(t / 900 + s.p)) * 0.65;
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // moon
  const mx = w * 0.16, my = h * 0.15;
  const mg = ctx.createRadialGradient(mx, my, 0, mx, my, h * 0.3);
  mg.addColorStop(0, 'rgba(226,232,240,0.5)');
  mg.addColorStop(1, 'rgba(226,232,240,0)');
  ctx.fillStyle = mg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e8edf5';
  ctx.beginPath(); ctx.arc(mx, my, h * 0.038, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(148,163,184,0.35)';
  ctx.beginPath(); ctx.arc(mx - h * 0.012, my - h * 0.01, h * 0.011, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + h * 0.014, my + h * 0.012, h * 0.008, 0, Math.PI * 2); ctx.fill();

  // city glow along the horizon
  const glow = ctx.createLinearGradient(0, h * 0.78, 0, h);
  glow.addColorStop(0, 'rgba(251,191,36,0)');
  glow.addColorStop(1, 'rgba(251,146,60,0.32)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
};

/** Skyline silhouette with lit windows - gives the shooter a ground. */
export const drawSkyline = (
  ctx: CanvasRenderingContext2D, w: number, h: number,
  towers: { x: number; w: number; h: number; lit: number[] }[],
) => {
  ctx.fillStyle = '#060b18';
  for (const t of towers) {
    const x = t.x * w, tw = t.w * w, th = t.h * h;
    ctx.fillRect(x, h - th, tw, th);
    ctx.fillStyle = 'rgba(251,191,36,0.55)';
    for (let i = 0; i < t.lit.length; i += 2) {
      ctx.fillRect(x + t.lit[i] * tw, h - th + t.lit[i + 1] * th, tw * 0.13, th * 0.03);
    }
    ctx.fillStyle = '#060b18';
  }
};

/** Corner darkening - cheap, and makes everything look photographed. */
export const drawVignette = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

/** One-frame white flash, used on impacts. */
export const drawFlash = (ctx: CanvasRenderingContext2D, w: number, h: number, a: number) => {
  if (a <= 0) return;
  ctx.fillStyle = `rgba(255,255,255,${clamp(a, 0, 1) * 0.5})`;
  ctx.fillRect(0, 0, w, h);
};
