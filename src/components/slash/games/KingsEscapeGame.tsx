import { useEffect, useRef, useState } from 'react';
import type { GameProps } from './types';
import {
  Callouts, ParticleField, Shaker,
  clamp, drawVignette, drawFlash, easeOutCubic, lerp, rnd,
} from './engine';

/**
 * King's Escape — a match-three whose board is the floor of a shaft.
 *
 * Rubble keeps piling into the shaft and the king rides the top of it,
 * rising towards a dragon that is waiting at the ceiling. Matching three
 * of a kind collapses part of the pile, which drops the king back out of
 * reach. The round is won by landing hitsTarget clears before he is
 * carried all the way up.
 *
 * The pressure is therefore the pile, not a clock — a player who keeps
 * finding matches is never in danger, and one who stalls always is. That
 * reads on screen in a way a countdown never does.
 *
 * Everything expensive (the wall, the rubble texture, the tile faces, the
 * king, the dragon) is baked once into an offscreen canvas and blitted;
 * the per-frame cost is drawImage calls and the particle field.
 */

const COLS = 7;
const ROWS = 7;
const TYPES = 4;

/** Seconds of no clearing that take the pile from empty to the dragon. */
const RISE_SECONDS = 42;
/** How far down one clear pushes the pile, as a fraction of the shaft. */
const DROP_PER_HIT = 0.055;

const SWAP_MS = 130;
const POP_MS = 210;
const FALL_MS = 240;

type Phase = 'idle' | 'anim' | 'clear' | 'fall' | 'over';
type Outcome = 'escaped' | 'caught';

interface Tile {
  t: number;
  /** 0→1 while the tile is being cleared. */
  pop: number;
  /** Rows above its home cell, animated back to 0 as it falls. */
  dy: number;
  /** The height it began that fall from, so the ease can be replayed each frame. */
  dy0: number;
}

type Grid = (Tile | null)[][];

const key = (r: number, c: number) => `${r},${c}`;
const mkCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

// =====================================================================
// Board logic
// =====================================================================

const newTile = (t: number): Tile => ({ t, pop: 0, dy: 0, dy0: 0 });

/** Every cell that sits in a run of three or more, rows and columns both. */
const findMatches = (g: Grid): Set<string> => {
  const hit = new Set<string>();

  for (let r = 0; r < ROWS; r++) {
    let run = 1;
    for (let c = 1; c <= COLS; c++) {
      const a = c < COLS ? g[r][c] : null;
      const b = g[r][c - 1];
      const same = !!a && !!b && a.t === b.t;
      if (same) { run++; continue; }
      if (run >= 3) for (let k = c - run; k < c; k++) hit.add(key(r, k));
      run = 1;
    }
  }

  for (let c = 0; c < COLS; c++) {
    let run = 1;
    for (let r = 1; r <= ROWS; r++) {
      const a = r < ROWS ? g[r][c] : null;
      const b = g[r - 1][c];
      const same = !!a && !!b && a.t === b.t;
      if (same) { run++; continue; }
      if (run >= 3) for (let k = r - run; k < r; k++) hit.add(key(k, c));
      run = 1;
    }
  }

  return hit;
};

/** Is there any swap left that would match? Guards against a dead board. */
const hasMove = (g: Grid): boolean => {
  const trySwap = (r1: number, c1: number, r2: number, c2: number) => {
    const a = g[r1][c1], b = g[r2][c2];
    g[r1][c1] = b; g[r2][c2] = a;
    const ok = findMatches(g).size > 0;
    g[r1][c1] = a; g[r2][c2] = b;
    return ok;
  };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS && trySwap(r, c, r, c + 1)) return true;
      if (r + 1 < ROWS && trySwap(r, c, r + 1, c)) return true;
    }
  }
  return false;
};

/** A board with no free matches sitting on it and at least one move. */
const makeGrid = (): Grid => {
  for (let attempt = 0; attempt < 60; attempt++) {
    const g: Grid = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => newTile((Math.random() * TYPES) | 0)));

    // Re-roll anything that landed in a run, until the board is quiet.
    for (let pass = 0; pass < 40; pass++) {
      const m = findMatches(g);
      if (!m.size) break;
      for (const k of m) {
        const [r, c] = k.split(',').map(Number);
        g[r][c] = newTile((Math.random() * TYPES) | 0);
      }
    }

    if (!findMatches(g).size && hasMove(g)) return g;
  }
  // Vanishingly unlikely; a board with a stray match resolves on frame one.
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => newTile((Math.random() * TYPES) | 0)));
};

/**
 * Drops everything into the holes and tops the columns up, recording how
 * far each tile has to fall in `dy` so the frame loop can animate it.
 */
const applyGravity = (g: Grid) => {
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const t = g[r][c];
      if (!t) continue;
      if (write !== r) { t.dy = t.dy0 = write - r; g[write][c] = t; g[r][c] = null; }
      write--;
    }
    // New tiles enter from just above the top of the board.
    for (let r = write, n = 1; r >= 0; r--, n++) {
      const t = newTile((Math.random() * TYPES) | 0);
      t.dy = t.dy0 = r + n;
      g[r][c] = t;
    }
  }
};

// =====================================================================
// Sprites
// =====================================================================

const TILE_COLORS: [string, string, string][] = [
  ['#fde68a', '#fbbf24', '#b45309'],   // 0 crown
  ['#fca5a5', '#ef4444', '#991b1b'],   // 1 ruby block
  ['#86efac', '#22c55e', '#15803d'],   // 2 leaf
  ['#d8b4fe', '#a855f7', '#6b21a8'],   // 3 amethyst
];

/** One board tile: cream slab, then the symbol on top. */
const createTileSprite = (kind: number, size: number, dpr: number): HTMLCanvasElement => {
  const c = mkCanvas(size * dpr, size * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const [light, mid, dark] = TILE_COLORS[kind];
  const p = size * 0.06;
  const s = size - p * 2;

  // ---- slab ----
  const slab = g.createLinearGradient(0, p, 0, p + s);
  slab.addColorStop(0, '#fffaf0');
  slab.addColorStop(1, '#e4d9c6');
  g.fillStyle = slab;
  const rr = size * 0.17;
  g.beginPath();
  g.moveTo(p + rr, p);
  g.arcTo(p + s, p, p + s, p + s, rr);
  g.arcTo(p + s, p + s, p, p + s, rr);
  g.arcTo(p, p + s, p, p, rr);
  g.arcTo(p, p, p + s, p, rr);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(120,98,72,0.35)';
  g.lineWidth = Math.max(1, size * 0.02);
  g.stroke();

  const cx = size / 2, cy = size / 2;
  const u = size * 0.34;                       // symbol half-extent

  const body = g.createLinearGradient(cx, cy - u, cx, cy + u);
  body.addColorStop(0, light);
  body.addColorStop(0.5, mid);
  body.addColorStop(1, dark);
  g.fillStyle = body;
  g.strokeStyle = dark;
  g.lineWidth = Math.max(1, size * 0.025);

  switch (kind) {
    case 0: {
      // crown: three points on a band
      g.beginPath();
      g.moveTo(cx - u, cy + u * 0.55);
      g.lineTo(cx - u, cy - u * 0.5);
      g.lineTo(cx - u * 0.5, cy + u * 0.02);
      g.lineTo(cx, cy - u * 0.72);
      g.lineTo(cx + u * 0.5, cy + u * 0.02);
      g.lineTo(cx + u, cy - u * 0.5);
      g.lineTo(cx + u, cy + u * 0.55);
      g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(cx - u * 0.85, cy + u * 0.18, u * 1.7, u * 0.16);
      break;
    }
    case 1: {
      // ruby block: rounded square with a bevel
      const b = u * 0.92, br = u * 0.3;
      g.beginPath();
      g.moveTo(cx - b + br, cy - b);
      g.arcTo(cx + b, cy - b, cx + b, cy + b, br);
      g.arcTo(cx + b, cy + b, cx - b, cy + b, br);
      g.arcTo(cx - b, cy + b, cx - b, cy - b, br);
      g.arcTo(cx - b, cy - b, cx + b, cy - b, br);
      g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.beginPath();
      g.ellipse(cx - b * 0.3, cy - b * 0.42, b * 0.4, b * 0.22, -0.5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 2: {
      // leaf: two mirrored curves meeting at a tip
      g.beginPath();
      g.moveTo(cx, cy - u);
      g.bezierCurveTo(cx + u * 1.05, cy - u * 0.2, cx + u * 0.75, cy + u * 0.85, cx, cy + u * 0.9);
      g.bezierCurveTo(cx - u * 0.75, cy + u * 0.85, cx - u * 1.05, cy - u * 0.2, cx, cy - u);
      g.closePath();
      g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = Math.max(1, size * 0.03);
      g.beginPath(); g.moveTo(cx, cy - u * 0.7); g.lineTo(cx, cy + u * 0.7); g.stroke();
      break;
    }
    default: {
      // amethyst: cut diamond
      g.beginPath();
      g.moveTo(cx, cy - u);
      g.lineTo(cx + u * 0.92, cy);
      g.lineTo(cx, cy + u);
      g.lineTo(cx - u * 0.92, cy);
      g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.beginPath();
      g.moveTo(cx, cy - u * 0.8);
      g.lineTo(cx + u * 0.4, cy - u * 0.1);
      g.lineTo(cx, cy + u * 0.1);
      g.lineTo(cx - u * 0.4, cy - u * 0.1);
      g.closePath();
      g.fill();
      break;
    }
  }

  return c;
};

/** Castle masonry for the shaft walls. */
const createWallSprite = (w: number, h: number): HTMLCanvasElement => {
  const c = mkCanvas(w, h);
  const g = c.getContext('2d')!;
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#6b7280');
  base.addColorStop(1, '#4b5563');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);

  const bh = Math.max(12, h / 14);
  const bw = bh * 2.1;
  for (let y = 0, row = 0; y < h; y += bh, row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < w + bw; x += bw) {
      const shade = rnd(-14, 14);
      g.fillStyle = `rgb(${125 + shade},${131 + shade},${140 + shade})`;
      g.fillRect(x + off + 1.5, y + 1.5, bw - 3, bh - 3);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(x + off + 1.5, y + 1.5, bw - 3, Math.max(1, bh * 0.12));
    }
  }
  return c;
};

/**
 * The full-height rubble column. Only the bottom slice is ever drawn, so
 * the pile keeps a stable, hand-packed look as it grows and shrinks.
 */
const createRubbleSprite = (w: number, h: number): HTMLCanvasElement => {
  const c = mkCanvas(w, h);
  const g = c.getContext('2d')!;
  const cols = ['#3b5a8f', '#4c6ea8', '#7c6bb5', '#b47ec4', '#e39ac9', '#2f4470'];
  const n = Math.round((w * h) / 260);
  for (let i = 0; i < n; i++) {
    const x = rnd(0, w), y = rnd(0, h);
    const s = rnd(w * 0.028, w * 0.075);
    const a = rnd(0, Math.PI);
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = cols[(Math.random() * cols.length) | 0];
    // Chipped quadrilateral — a rectangle reads as tiling, not rubble.
    g.beginPath();
    g.moveTo(-s, -s * rnd(0.5, 0.9));
    g.lineTo(s * rnd(0.6, 1), -s * rnd(0.4, 0.8));
    g.lineTo(s * rnd(0.7, 1), s * rnd(0.5, 0.9));
    g.lineTo(-s * rnd(0.6, 1), s * rnd(0.4, 0.9));
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(-s, -s * 0.75, s * 1.6, s * 0.2);
    g.restore();
  }
  // Shadow gradient down the sides, so the column reads as being in a shaft.
  const sh = g.createLinearGradient(0, 0, w, 0);
  sh.addColorStop(0, 'rgba(2,6,23,0.5)');
  sh.addColorStop(0.25, 'rgba(2,6,23,0)');
  sh.addColorStop(0.75, 'rgba(2,6,23,0)');
  sh.addColorStop(1, 'rgba(2,6,23,0.5)');
  g.fillStyle = sh;
  g.fillRect(0, 0, w, h);
  return c;
};

/**
 * The king, baked as separate parts rather than one finished figure.
 *
 * A single sprite can only bob. Panic needs joints: the arms have to go
 * up over his head, the legs have to run, the crown has to lag a beat
 * behind the head it is sitting on. So each piece is baked once at its
 * final size and the frame loop composes them — a handful of drawImage
 * calls, in exchange for a character who can act.
 *
 * Each part is drawn around its own joint, noted against it, so the draw
 * code can rotate a limb without hunting for the offset.
 */
export interface KingParts {
  cape: HTMLCanvasElement;
  torso: HTMLCanvasElement;
  arm: HTMLCanvasElement;
  leg: HTMLCanvasElement;
  head: HTMLCanvasElement;
  crown: HTMLCanvasElement;
  /** Joint heights, all measured up from the soles. */
  hipY: number;
  shoulderY: number;
  neckY: number;
  crownY: number;
  totalH: number;
  u: number;
}

const createKingParts = (u: number): KingParts => {
  const LEG_H = u * 0.30, TORSO_H = u * 0.44, HEAD_H = u * 0.34, CROWN_H = u * 0.17;

  // ---------------- leg: hose, then a turned-up boot ----------------
  const legW = u * 0.26, legH = LEG_H * 1.12;
  const leg = mkCanvas(legW, legH);
  {
    const g = leg.getContext('2d')!;
    const hose = g.createLinearGradient(0, 0, legW, 0);
    hose.addColorStop(0, '#4c1d95');
    hose.addColorStop(0.45, '#7e22ce');
    hose.addColorStop(1, '#3b0764');
    g.fillStyle = hose;
    g.beginPath();
    g.moveTo(legW * 0.12, 0);
    g.lineTo(legW * 0.88, 0);
    g.lineTo(legW * 0.78, legH * 0.66);
    g.lineTo(legW * 0.22, legH * 0.66);
    g.closePath();
    g.fill();

    g.fillStyle = '#1c1436';
    g.beginPath();
    g.moveTo(legW * 0.16, legH * 0.6);
    g.lineTo(legW * 0.84, legH * 0.6);
    g.lineTo(legW * 0.9, legH * 0.93);
    g.quadraticCurveTo(legW * 1.02, legH, legW * 0.86, legH);
    g.lineTo(legW * 0.08, legH);
    g.closePath();
    g.fill();

    g.fillStyle = '#fbbf24';
    g.fillRect(legW * 0.16, legH * 0.6, legW * 0.68, legH * 0.07);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(legW * 0.2, legH * 0.72, legW * 0.14, legH * 0.16);
  }

  // ---------------- arm: sleeve, gold cuff, fist ----------------
  const armW = u * 0.24, armH = u * 0.38;
  const arm = mkCanvas(armW, armH);
  {
    const g = arm.getContext('2d')!;
    const sleeve = g.createLinearGradient(0, 0, armW, 0);
    sleeve.addColorStop(0, '#6d28d9');
    sleeve.addColorStop(0.4, '#a855f7');
    sleeve.addColorStop(1, '#4c1d95');
    g.fillStyle = sleeve;
    g.beginPath();
    g.moveTo(armW * 0.08, armW * 0.2);
    g.quadraticCurveTo(armW * 0.5, -armW * 0.15, armW * 0.92, armW * 0.2);
    g.lineTo(armW * 0.74, armH * 0.72);
    g.lineTo(armW * 0.26, armH * 0.72);
    g.closePath();
    g.fill();

    g.fillStyle = '#fbbf24';
    g.fillRect(armW * 0.24, armH * 0.68, armW * 0.52, armH * 0.09);
    g.fillStyle = '#b45309';
    g.fillRect(armW * 0.24, armH * 0.745, armW * 0.52, armH * 0.02);

    const skin = g.createRadialGradient(armW * 0.44, armH * 0.83, armW * 0.03, armW * 0.5, armH * 0.87, armW * 0.28);
    skin.addColorStop(0, '#ffe0c2');
    skin.addColorStop(1, '#d9a074');
    g.fillStyle = skin;
    g.beginPath();
    g.arc(armW * 0.5, armH * 0.87, armW * 0.25, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(120,72,40,0.5)';
    g.lineWidth = Math.max(1, armW * 0.05);
    g.beginPath();
    g.moveTo(armW * 0.32, armH * 0.88);
    g.lineTo(armW * 0.68, armH * 0.88);
    g.stroke();
  }

  // ---------------- torso: robe, ermine collar, belt ----------------
  const torW = u * 0.66, torH = TORSO_H;
  const torso = mkCanvas(torW, torH);
  {
    const g = torso.getContext('2d')!;
    const robe = g.createLinearGradient(0, 0, torW, 0);
    robe.addColorStop(0, '#5b21b6');
    robe.addColorStop(0.4, '#a855f7');
    robe.addColorStop(0.62, '#8b5cf6');
    robe.addColorStop(1, '#4c1d95');
    g.fillStyle = robe;
    g.beginPath();
    g.moveTo(torW * 0.22, torH * 0.08);
    g.quadraticCurveTo(torW * 0.5, 0, torW * 0.78, torH * 0.08);
    g.lineTo(torW * 0.96, torH);
    g.lineTo(torW * 0.04, torH);
    g.closePath();
    g.fill();

    g.fillStyle = '#d97706';
    g.fillRect(torW * 0.44, torH * 0.1, torW * 0.12, torH * 0.9);
    g.fillStyle = '#fcd34d';
    g.fillRect(torW * 0.465, torH * 0.1, torW * 0.07, torH * 0.9);

    g.fillStyle = '#78350f';
    g.fillRect(torW * 0.02, torH * 0.66, torW * 0.96, torH * 0.14);
    g.fillStyle = '#fbbf24';
    g.fillRect(torW * 0.02, torH * 0.66, torW * 0.96, torH * 0.03);
    g.fillStyle = '#facc15';
    g.fillRect(torW * 0.4, torH * 0.63, torW * 0.2, torH * 0.2);
    g.fillStyle = '#92400e';
    g.fillRect(torW * 0.455, torH * 0.68, torW * 0.09, torH * 0.1);

    // ermine collar — white with the traditional black flecks
    g.fillStyle = '#f8fafc';
    g.beginPath();
    g.moveTo(torW * 0.14, torH * 0.16);
    g.quadraticCurveTo(torW * 0.5, torH * 0.3, torW * 0.86, torH * 0.16);
    g.quadraticCurveTo(torW * 0.78, torH * -0.02, torW * 0.5, torH * 0.04);
    g.quadraticCurveTo(torW * 0.22, torH * -0.02, torW * 0.14, torH * 0.16);
    g.closePath();
    g.fill();
    g.fillStyle = '#334155';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.ellipse(torW * (0.24 + i * 0.17), torH * (0.1 + (i % 2) * 0.05), torW * 0.02, torH * 0.03, 0, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = '#ef4444';
    g.beginPath();
    g.ellipse(torW * 0.5, torH * 0.26, torW * 0.055, torH * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.ellipse(torW * 0.48, torH * 0.24, torW * 0.02, torH * 0.017, -0.5, 0, Math.PI * 2);
    g.fill();
  }

  // ---------------- cape ----------------
  const capW = u * 0.94, capH = u * 0.78;
  const cape = mkCanvas(capW, capH);
  {
    const g = cape.getContext('2d')!;
    const cg = g.createLinearGradient(0, 0, capW, 0);
    cg.addColorStop(0, '#7f1d1d');
    cg.addColorStop(0.45, '#dc2626');
    cg.addColorStop(1, '#7f1d1d');
    g.fillStyle = cg;
    g.beginPath();
    g.moveTo(capW * 0.3, 0);
    g.lineTo(capW * 0.7, 0);
    g.quadraticCurveTo(capW * 1.02, capH * 0.55, capW * 0.9, capH * 0.9);
    // scalloped hem
    for (let i = 5; i >= 0; i--) {
      const x0 = capW * (0.1 + i * 0.16);
      const x1 = capW * (0.1 + (i - 1) * 0.16) + capW * 0.08;
      g.quadraticCurveTo((x0 + x1) / 2, capH * (i % 2 ? 1.0 : 0.94), x1, capH * 0.9);
    }
    g.quadraticCurveTo(capW * -0.02, capH * 0.55, capW * 0.3, 0);
    g.closePath();
    g.fill();

    g.fillStyle = 'rgba(69,10,10,0.35)';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(capW * (0.34 + i * 0.16), capH * 0.05);
      g.lineTo(capW * (0.28 + i * 0.2), capH * 0.9);
      g.lineTo(capW * (0.36 + i * 0.2), capH * 0.9);
      g.closePath();
      g.fill();
    }

    g.fillStyle = '#f1f5f9';
    g.beginPath();
    g.moveTo(capW * 0.3, 0);
    g.lineTo(capW * 0.7, 0);
    g.lineTo(capW * 0.66, capH * 0.1);
    g.lineTo(capW * 0.34, capH * 0.1);
    g.closePath();
    g.fill();
  }

  // ---------------- head ----------------
  const hdW = u * 0.6, hdH = HEAD_H;
  const head = mkCanvas(hdW, hdH);
  {
    const g = head.getContext('2d')!;
    const cx = hdW / 2;

    g.fillStyle = '#e8ab7d';
    g.beginPath(); g.ellipse(hdW * 0.11, hdH * 0.5, hdW * 0.07, hdH * 0.08, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(hdW * 0.89, hdH * 0.5, hdW * 0.07, hdH * 0.08, 0, 0, Math.PI * 2); g.fill();

    const face = g.createRadialGradient(cx - hdW * 0.1, hdH * 0.32, hdW * 0.05, cx, hdH * 0.45, hdW * 0.5);
    face.addColorStop(0, '#ffe2c6');
    face.addColorStop(1, '#dda276');
    g.fillStyle = face;
    g.beginPath();
    g.ellipse(cx, hdH * 0.44, hdW * 0.38, hdH * 0.34, 0, 0, Math.PI * 2);
    g.fill();

    // brows, shoved right up — the whole expression lives here
    g.strokeStyle = '#e2e8f0';
    g.lineWidth = Math.max(2, hdW * 0.07);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - hdW * 0.26, hdH * 0.3);
    g.quadraticCurveTo(cx - hdW * 0.16, hdH * 0.2, cx - hdW * 0.05, hdH * 0.26);
    g.moveTo(cx + hdW * 0.26, hdH * 0.3);
    g.quadraticCurveTo(cx + hdW * 0.16, hdH * 0.2, cx + hdW * 0.05, hdH * 0.26);
    g.stroke();

    for (const s of [-1, 1]) {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(cx + s * hdW * 0.15, hdH * 0.41, hdW * 0.1, hdH * 0.1, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0f172a';
      g.beginPath();
      g.arc(cx + s * hdW * 0.15, hdH * 0.42, hdW * 0.045, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cx + s * hdW * 0.13, hdH * 0.39, hdW * 0.017, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = '#d18f63';
    g.beginPath();
    g.ellipse(cx, hdH * 0.53, hdW * 0.06, hdH * 0.05, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = '#f8fafc';
    g.beginPath();
    g.moveTo(cx - hdW * 0.34, hdH * 0.52);
    g.quadraticCurveTo(cx - hdW * 0.3, hdH * 1.02, cx, hdH * 0.99);
    g.quadraticCurveTo(cx + hdW * 0.3, hdH * 1.02, cx + hdW * 0.34, hdH * 0.52);
    g.quadraticCurveTo(cx, hdH * 0.66, cx - hdW * 0.34, hdH * 0.52);
    g.closePath();
    g.fill();

    // shouting mouth, cut into the beard
    g.fillStyle = '#5b1a1a';
    g.beginPath();
    g.ellipse(cx, hdH * 0.72, hdW * 0.11, hdH * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f87171';
    g.beginPath();
    g.ellipse(cx, hdH * 0.77, hdW * 0.07, hdH * 0.04, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(cx - hdW * 0.22, hdH * 0.6);
    g.quadraticCurveTo(cx, hdH * 0.54, cx + hdW * 0.22, hdH * 0.6);
    g.quadraticCurveTo(cx + hdW * 0.1, hdH * 0.68, cx, hdH * 0.63);
    g.quadraticCurveTo(cx - hdW * 0.1, hdH * 0.68, cx - hdW * 0.22, hdH * 0.6);
    g.closePath();
    g.fill();

    g.fillStyle = 'rgba(248,113,113,0.4)';
    g.beginPath(); g.ellipse(cx - hdW * 0.28, hdH * 0.52, hdW * 0.07, hdH * 0.05, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + hdW * 0.28, hdH * 0.52, hdW * 0.07, hdH * 0.05, 0, 0, Math.PI * 2); g.fill();
  }

  // ---------------- crown ----------------
  const crW = u * 0.54, crH = CROWN_H;
  const crown = mkCanvas(crW, crH);
  {
    const g = crown.getContext('2d')!;
    const gold = g.createLinearGradient(0, 0, 0, crH);
    gold.addColorStop(0, '#fef3c7');
    gold.addColorStop(0.45, '#fbbf24');
    gold.addColorStop(1, '#b45309');
    g.fillStyle = gold;
    g.beginPath();
    g.moveTo(crW * 0.04, crH * 0.95);
    g.lineTo(crW * 0.04, crH * 0.42);
    g.lineTo(crW * 0.2, crH * 0.66);
    g.lineTo(crW * 0.32, crH * 0.12);
    g.lineTo(crW * 0.5, crH * 0.5);
    g.lineTo(crW * 0.68, crH * 0.12);
    g.lineTo(crW * 0.8, crH * 0.66);
    g.lineTo(crW * 0.96, crH * 0.42);
    g.lineTo(crW * 0.96, crH * 0.95);
    g.closePath();
    g.fill();
    g.strokeStyle = '#92400e';
    g.lineWidth = Math.max(1, crW * 0.02);
    g.stroke();

    g.fillStyle = '#fffbeb';
    for (const pt of [[0.04, 0.42], [0.32, 0.12], [0.68, 0.12], [0.96, 0.42]]) {
      g.beginPath(); g.arc(crW * pt[0], crH * pt[1], crW * 0.045, 0, Math.PI * 2); g.fill();
    }

    const jewels: [number, string][] = [[0.22, '#22c55e'], [0.5, '#ef4444'], [0.78, '#3b82f6']];
    for (const j of jewels) {
      g.fillStyle = j[1];
      g.beginPath(); g.arc(crW * j[0], crH * 0.74, crW * 0.055, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath(); g.arc(crW * j[0] - crW * 0.018, crH * 0.71, crW * 0.018, 0, Math.PI * 2); g.fill();
    }

    g.fillStyle = '#f8fafc';
    g.fillRect(crW * 0.02, crH * 0.88, crW * 0.96, crH * 0.12);
  }

  const hipY = LEG_H;
  const neckY = hipY + TORSO_H;
  return {
    cape, torso, arm, leg, head, crown,
    hipY,
    shoulderY: hipY + TORSO_H * 0.8,
    neckY,
    crownY: neckY + HEAD_H * 0.63,
    totalH: neckY + HEAD_H * 0.9 + CROWN_H * 0.9,
    u,
  };
};

/**
 * The dragon, also in parts, drawn face-on looking straight down the shaft.
 *
 * Face-on is what lets him track the king: a profile head would have to
 * flip every time the king ran past underneath, and that flip is always
 * uglier than the chase. Straight on, following him is a translation and
 * a small rotation, and the jaw opens by dropping away rather than
 * hinging — which is what an open mouth does from the front.
 */
export interface DragonParts {
  skull: HTMLCanvasElement;
  jaw: HTMLCanvasElement;
  neck: HTMLCanvasElement;
  w: number;
  h: number;
  /** Head-local offsets, measured down from the neck joint it rotates about. */
  mouthY: number;
  eyeY: number;
  eyeDX: number;
}

const createDragonParts = (w: number, h: number): DragonParts => {
  // ---------------- skull ----------------
  const skull = mkCanvas(w, h);
  {
    const g = skull.getContext('2d')!;
    const cx = w / 2;

    // horns first, so they read as growing out from behind the skull
    g.fillStyle = '#d6d3d1';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * w * 0.26, h * 0.24);
      g.quadraticCurveTo(cx + s * w * 0.56, h * 0.06, cx + s * w * 0.48, h * 0.02);
      g.quadraticCurveTo(cx + s * w * 0.4, h * 0.12, cx + s * w * 0.18, h * 0.3);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#a8a29e';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * w * 0.3, h * 0.2);
      g.quadraticCurveTo(cx + s * w * 0.5, h * 0.08, cx + s * w * 0.46, h * 0.04);
      g.lineTo(cx + s * w * 0.34, h * 0.16);
      g.closePath();
      g.fill();
    }

    const scale = g.createLinearGradient(0, 0, 0, h);
    scale.addColorStop(0, '#4ade80');
    scale.addColorStop(0.4, '#22c55e');
    scale.addColorStop(0.75, '#15803d');
    scale.addColorStop(1, '#14532d');
    g.fillStyle = scale;
    g.beginPath();
    g.moveTo(cx - w * 0.3, h * 0.14);
    g.quadraticCurveTo(cx, h * 0.02, cx + w * 0.3, h * 0.14);
    g.quadraticCurveTo(cx + w * 0.4, h * 0.4, cx + w * 0.26, h * 0.62);
    g.quadraticCurveTo(cx, h * 0.76, cx - w * 0.26, h * 0.62);
    g.quadraticCurveTo(cx - w * 0.4, h * 0.4, cx - w * 0.3, h * 0.14);
    g.closePath();
    g.fill();

    g.fillStyle = 'rgba(6,78,59,0.55)';
    g.beginPath();
    g.moveTo(cx - w * 0.28, h * 0.26);
    g.quadraticCurveTo(cx, h * 0.34, cx + w * 0.28, h * 0.26);
    g.quadraticCurveTo(cx, h * 0.18, cx - w * 0.28, h * 0.26);
    g.closePath();
    g.fill();

    g.fillStyle = 'rgba(4,60,40,0.28)';
    for (let i = 0; i < 26; i++) {
      const sx = cx + rnd(-w * 0.26, w * 0.26);
      const sy = rnd(h * 0.18, h * 0.6);
      g.beginPath();
      g.ellipse(sx, sy, w * 0.03, h * 0.02, rnd(0, 3), 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = '#052e16';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + s * w * 0.09, h * 0.55, w * 0.035, h * 0.022, s * 0.5, 0, Math.PI * 2);
      g.fill();
    }

    // upper teeth along the mouth line
    g.fillStyle = '#f8fafc';
    for (let i = 0; i < 7; i++) {
      const tx = cx - w * 0.22 + i * w * 0.073;
      const drop = h * (i === 0 || i === 6 ? 0.09 : 0.055);
      g.beginPath();
      g.moveTo(tx, h * 0.63);
      g.lineTo(tx + w * 0.045, h * 0.63);
      g.lineTo(tx + w * 0.022, h * 0.63 + drop);
      g.closePath();
      g.fill();
    }
  }

  // ---------------- lower jaw ----------------
  const jawW = w * 0.58, jawH = h * 0.3;
  const jaw = mkCanvas(jawW, jawH);
  {
    const g = jaw.getContext('2d')!;
    const jg = g.createLinearGradient(0, 0, 0, jawH);
    jg.addColorStop(0, '#166534');
    jg.addColorStop(1, '#052e16');
    g.fillStyle = jg;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(jawW, 0);
    g.quadraticCurveTo(jawW * 0.86, jawH, jawW * 0.5, jawH);
    g.quadraticCurveTo(jawW * 0.14, jawH, 0, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#f1f5f9';
    for (let i = 0; i < 6; i++) {
      const tx = jawW * (0.08 + i * 0.16);
      g.beginPath();
      g.moveTo(tx, jawH * 0.16);
      g.lineTo(tx + jawW * 0.075, jawH * 0.16);
      g.lineTo(tx + jawW * 0.037, 0);
      g.closePath();
      g.fill();
    }
  }

  // ---------------- one neck segment, reused down the curve ----------------
  const segW = w * 0.5, segH = w * 0.3;
  const neck = mkCanvas(segW, segH);
  {
    const g = neck.getContext('2d')!;
    const ng = g.createLinearGradient(0, 0, segW, 0);
    ng.addColorStop(0, '#14532d');
    ng.addColorStop(0.35, '#22c55e');
    ng.addColorStop(0.6, '#16a34a');
    ng.addColorStop(1, '#052e16');
    g.fillStyle = ng;
    g.beginPath();
    g.ellipse(segW / 2, segH / 2, segW / 2, segH / 2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(190,242,100,0.3)';
    g.beginPath();
    g.ellipse(segW * 0.5, segH * 0.6, segW * 0.2, segH * 0.3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#065f46';
    g.beginPath();
    g.moveTo(segW * 0.42, 0);
    g.lineTo(segW * 0.58, 0);
    g.lineTo(segW * 0.5, segH * 0.2);
    g.closePath();
    g.fill();
  }

  return { skull, jaw, neck, w, h, mouthY: h * 0.63, eyeY: h * 0.36, eyeDX: w * 0.15 };
};

// =====================================================================
// Component
// =====================================================================

export function KingsEscapeGame({ hitsTarget, onFinish, onHit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hits, setHits] = useState(0);
  const [danger, setDanger] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, cell = 0, boardX = 0, boardTop = 0, sceneH = 0;

    let wallSprite: HTMLCanvasElement | null = null;
    let rubbleSprite: HTMLCanvasElement | null = null;
    let kingParts: KingParts | null = null;
    let dragonParts: DragonParts | null = null;
    let tileSprites: HTMLCanvasElement[] = [];

    const grid = makeGrid();
    const parts = new ParticleField();
    const shake = new Shaker();
    const calls = new Callouts();

    let phase: Phase = 'idle';
    let timer = 0;                 // ms elapsed inside the current phase
    let hitCount = 0;
    let peril = 0;                 // 0 safe … 1 the dragon has him
    let shownPeril = 0;            // last value pushed into React state

    // ---------------------------------------------------------------
    // The two actors
    //
    // The king runs along the crest and the dragon hunts him along it.
    // The chase only works because the dragon tracks with a lag: he
    // swings towards wherever the king was a moment ago, which is what
    // makes running somewhere else worth doing. Committing to a breath
    // locks his aim entirely, so a late dodge beats it.
    // ---------------------------------------------------------------
    let kingX = 0.5;               // 0…1 across the shaft
    let kingVX = 0;
    let kingAim = 0.5;             // where he is currently bolting for
    let kingRetarget = 0;          // ms until he changes his mind again
    let kingFace = 1;
    let kingStride = 0;            // run-cycle phase
    let kingHop = 0;               // height above the crest, in cells
    let kingHopV = 0;
    let kingScared = 0;            // spikes to 1 when the dragon commits

    let dragX = 0.5;
    let dragState: 'watch' | 'charge' | 'fire' | 'recover' = 'watch';
    let dragT = 0;                 // ms inside the current state
    let dragNext = 2200;           // ms of watching before the next breath
    let dragOpen = 0;              // jaw, 0…1
    let dragGlow = 0;              // throat charge, 0…1

    const updateActors = (ms: number) => {
      const f = ms / 16.667;
      const panic = 0.35 + peril * 0.65;

      // ---- dragon ----
      dragT += ms;
      // Locked on while breathing; otherwise swinging over, faster the
      // higher the pile has carried the king.
      const lag = dragState === 'fire' ? 0.00025 : 0.0022 + peril * 0.0035;
      dragX += (kingX - dragX) * clamp(lag * ms, 0, 1);

      switch (dragState) {
        case 'watch':
          dragOpen += (0.12 - dragOpen) * 0.08 * f;
          dragGlow *= Math.pow(0.92, f);
          if (dragT > dragNext) { dragState = 'charge'; dragT = 0; }
          break;
        case 'charge':
          dragOpen += (0.9 - dragOpen) * 0.1 * f;
          dragGlow = clamp(dragT / 620, 0, 1);
          if (dragT > 620) { dragState = 'fire'; dragT = 0; kingScared = 1; shake.add(5); }
          break;
        case 'fire':
          dragOpen += (1 - dragOpen) * 0.25 * f;
          if (dragT > 430) { dragState = 'recover'; dragT = 0; }
          break;
        default:
          dragOpen += (0.1 - dragOpen) * 0.07 * f;
          dragGlow *= Math.pow(0.88, f);
          if (dragT > 520) {
            dragState = 'watch';
            dragT = 0;
            // He works up to it: rarely at the bottom, relentlessly near the top.
            dragNext = rnd(2400, 4000) - peril * 1700;
          }
          break;
      }

      // ---- king ----
      kingScared = Math.max(0, kingScared - 0.012 * f);

      kingRetarget -= ms;
      if (kingRetarget <= 0) {
        kingAim = rnd(0.12, 0.88);
        kingRetarget = rnd(420, 1250) / (0.5 + panic);
      }
      // A committed dragon overrides whatever he was doing: bolt for the
      // far side of the shaft.
      if (dragState === 'charge' || dragState === 'fire') {
        kingAim = dragX > 0.5 ? rnd(0.1, 0.3) : rnd(0.7, 0.9);
      }

      kingVX += clamp(kingAim - kingX, -1, 1) * 0.00019 * (0.7 + panic) * ms;
      kingVX *= Math.pow(0.84, f);
      kingX = clamp(kingX + kingVX * f, 0.1, 0.9);
      if (Math.abs(kingVX) > 0.0006) kingFace = kingVX > 0 ? 1 : -1;
      kingStride += (Math.abs(kingVX) * 260 + 0.05 * panic) * f;

      // Panicked hops — always when the breath comes, otherwise now and then.
      if (kingHop <= 0 && (dragState === 'fire' && dragT < 60 ? true : Math.random() < 0.004 * panic)) {
        kingHopV = 0.15 + panic * 0.1;
      }
      if (kingHop > 0 || kingHopV > 0) {
        kingHop += kingHopV * f;
        kingHopV -= 0.016 * f;
        if (kingHop <= 0) { kingHop = 0; kingHopV = 0; }
      }
    };

    /** Composes the king out of his parts, at his feet position. */
    const drawKing = (g: CanvasRenderingContext2D, cx: number, feetY: number, now: number) => {
      const k = kingParts;
      if (!k) return;
      const u = k.u;
      const panic = 0.35 + peril * 0.65;
      const moving = Math.min(1, Math.abs(kingVX) * 220);
      const swing = Math.sin(kingStride) * (0.3 + 0.6 * moving);
      const scared = clamp(kingScared, 0, 1);
      const looking = dragState === 'charge' || dragState === 'fire';

      g.save();
      g.translate(cx, feetY);
      g.scale(kingFace, 1);
      // Leans into the run, and shudders outright while the breath winds up.
      g.rotate(clamp(kingVX * 22, -0.3, 0.3) * kingFace + Math.sin(now / 38) * 0.025 * scared);

      const hipDX = u * 0.1, shDX = u * 0.23;
      const legPX = k.leg.width / 2, legPY = k.leg.width * 0.34;
      const armPX = k.arm.width / 2, armPY = k.arm.width * 0.42;

      // cape, behind everything, trailing the direction of travel
      g.save();
      g.translate(0, -k.shoulderY);
      g.rotate(clamp(-kingVX * 26, -0.5, 0.5) + Math.sin(now / 150) * 0.09 * (0.4 + panic));
      g.drawImage(k.cape, -k.cape.width / 2, -k.cape.height * 0.05);
      g.restore();

      // far leg and arm, knocked back so the near side reads in front
      g.save();
      g.globalAlpha = 0.72;
      g.translate(-hipDX, -k.hipY);
      g.rotate(-swing);
      g.drawImage(k.leg, -legPX, -legPY);
      g.restore();

      // Arms run at his sides, then go straight up over his head in a fright.
      const flailA = -2.45 + Math.sin(now / 52) * 0.4;
      const flailB = -2.75 + Math.sin(now / 47 + 1.4) * 0.4;
      g.save();
      g.globalAlpha = 0.72;
      g.translate(-shDX, -k.shoulderY);
      g.rotate(lerp(-swing * 0.7, flailA, scared));
      g.drawImage(k.arm, -armPX, -armPY);
      g.restore();

      // torso, breathing hard
      g.save();
      g.translate(0, -k.hipY);
      g.scale(1 + Math.sin(now / 110) * 0.02 * panic, 1);
      g.drawImage(k.torso, -k.torso.width / 2, -k.torso.height);
      g.restore();

      // head, and a crown that lags a beat behind it
      const headTilt = Math.sin(now / 88) * 0.1 * panic + (looking ? -0.2 : 0);
      g.save();
      g.translate(0, -k.neckY);
      g.rotate(headTilt);
      g.drawImage(k.head, -k.head.width / 2, -k.head.height * 0.9);
      g.rotate(Math.sin(now / 88 - 1.1) * 0.18 * panic);
      g.translate(0, -(k.crownY - k.neckY));
      g.drawImage(k.crown, -k.crown.width / 2, -k.crown.height);
      g.restore();

      // near leg and arm
      g.save();
      g.translate(hipDX, -k.hipY);
      g.rotate(swing);
      g.drawImage(k.leg, -legPX, -legPY);
      g.restore();

      g.save();
      g.translate(shDX, -k.shoulderY);
      g.rotate(lerp(swing * 0.7, flailB, scared));
      g.drawImage(k.arm, -armPX, -armPY);
      g.restore();

      // sweat, thrown off as he runs
      if (scared > 0.2) {
        g.fillStyle = 'rgba(147,197,253,' + (scared * 0.85).toFixed(3) + ')';
        for (let i = 0; i < 2; i++) {
          const p = ((now / 360) + i * 0.5) % 1;
          g.beginPath();
          g.ellipse(
            u * (0.26 + i * 0.1) * (i ? -1 : 1),
            -k.crownY + p * u * 0.55,
            u * 0.032, u * 0.048, 0, 0, Math.PI * 2,
          );
          g.fill();
        }
      }

      g.restore();
    };

    /** Neck, head, eyes and breath — aimed wherever the king has got to. */
    const drawDragon = (
      g: CanvasRenderingContext2D, now: number,
      shaftX: number, shaftW: number, kx: number, ky: number,
    ) => {
      const d = dragonParts;
      if (!d) return;

      const headX = shaftX + shaftW * dragX;
      const rear = dragState === 'charge' ? -dragGlow : dragState === 'fire' ? 1 : 0;
      const headY = cell * 0.42 + Math.sin(now / 420) * cell * 0.05 + rear * cell * 0.2;

      // The head is drawn nose-down, so aiming is the angle between straight
      // down and the line to the king.
      const aim = clamp(Math.atan2(-(kx - headX), Math.max(cell, ky - headY)), -0.55, 0.55);

      // ---- neck, snaking out of the top of the shaft ----
      const ax = shaftX + shaftW * 0.5, ay = -cell * 1.1;
      const bx = ax + (headX - ax) * 0.2, by = headY * 0.4;
      const SEG = 9;
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG;
        const nx = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * bx + t * t * headX;
        const ny = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * by + t * t * headY;
        const s = lerp(0.6, 1.05, t);
        g.drawImage(d.neck, nx - d.neck.width * s / 2, ny - d.neck.height * s / 2,
          d.neck.width * s, d.neck.height * s);
      }

      g.save();
      g.translate(headX, headY);
      g.rotate(aim);

      const top = -d.h * 0.06;
      const mouth = top + d.mouthY;
      const gape = d.h * (0.04 + dragOpen * 0.24);

      // throat, with the charge burning down inside it
      g.fillStyle = '#160702';
      g.beginPath();
      g.ellipse(0, mouth + gape * 0.45, d.w * 0.2, gape * 0.62, 0, 0, Math.PI * 2);
      g.fill();
      if (dragGlow > 0.01) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const th = g.createRadialGradient(0, mouth + gape * 0.4, 0, 0, mouth + gape * 0.4, d.w * 0.26);
        th.addColorStop(0, 'rgba(255,247,214,' + (0.9 * dragGlow).toFixed(3) + ')');
        th.addColorStop(0.45, 'rgba(249,115,22,' + (0.6 * dragGlow).toFixed(3) + ')');
        th.addColorStop(1, 'rgba(239,68,68,0)');
        g.fillStyle = th;
        g.beginPath();
        g.arc(0, mouth + gape * 0.4, d.w * 0.26, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }

      // lower jaw, dropping away as the mouth opens
      g.drawImage(
        d.jaw, -d.jaw.width / 2, mouth + gape * 0.5,
        d.jaw.width, d.jaw.height * (0.55 + dragOpen * 0.7),
      );

      // skull over the top of it
      g.drawImage(d.skull, -d.skull.width / 2, top);

      // eyes: amber at rest, white-hot on the charge, pupils on the king
      const heat = clamp(dragGlow, 0, 1);
      for (const s of [-1, 1]) {
        const ex = s * d.eyeDX, ey = top + d.eyeY;
        g.save();
        g.globalCompositeOperation = 'lighter';
        const eg = g.createRadialGradient(ex, ey, 0, ex, ey, d.w * 0.12);
        eg.addColorStop(0, heat > 0.5 ? 'rgba(255,255,240,0.95)' : 'rgba(253,224,71,0.9)');
        eg.addColorStop(0.35, 'rgba(251,146,60,' + (0.5 + heat * 0.4).toFixed(3) + ')');
        eg.addColorStop(1, 'rgba(239,68,68,0)');
        g.fillStyle = eg;
        g.beginPath();
        g.arc(ex, ey, d.w * 0.12, 0, Math.PI * 2);
        g.fill();
        g.restore();
        g.fillStyle = '#fef3c7';
        g.beginPath();
        g.ellipse(ex, ey, d.w * 0.045, d.h * 0.035, 0, 0, Math.PI * 2);
        g.fill();
        // slit pupil, leaning after the king
        g.fillStyle = '#0f172a';
        g.beginPath();
        g.ellipse(ex - aim * d.w * 0.05, ey, d.w * 0.013, d.h * 0.03, 0, 0, Math.PI * 2);
        g.fill();
      }

      // ---- the breath ----
      const firing = dragState === 'fire' || result === 'caught';
      if (firing) {
        const dist = Math.max(1, Math.hypot(kx - headX, ky - headY));
        // How far down the shaft it actually reaches. Well short of him
        // until the pile has carried him up into range — which is the
        // whole bargain of the game, made visible.
        const cap = result === 'caught' ? 1.05 : clamp(0.4 + peril * 0.72, 0, 1);
        const grow = result === 'caught'
          ? clamp((now - overAt) / 220, 0, 1)
          : clamp(dragT / 120, 0, 1) * clamp(1 - (dragT - 300) / 130, 0, 1);
        const len = dist * cap * grow;

        if (len > 2) {
          const y0 = mouth + gape * 0.4;
          const w0 = d.w * 0.13, w1 = d.w * (0.22 + grow * 0.2);
          g.save();
          g.globalCompositeOperation = 'lighter';
          const fg = g.createLinearGradient(0, y0, 0, y0 + len);
          fg.addColorStop(0, 'rgba(255,255,245,0.95)');
          fg.addColorStop(0.22, 'rgba(253,224,71,0.85)');
          fg.addColorStop(0.6, 'rgba(249,115,22,0.5)');
          fg.addColorStop(1, 'rgba(239,68,68,0)');
          g.fillStyle = fg;
          // A wobbling cone — a straight-edged triangle reads as a laser.
          const wob = Math.sin(now / 40) * d.w * 0.05;
          g.beginPath();
          g.moveTo(-w0, y0);
          g.quadraticCurveTo(-w1 + wob, y0 + len * 0.55, -w1 * 0.8, y0 + len);
          g.quadraticCurveTo(0, y0 + len * 1.1, w1 * 0.8, y0 + len);
          g.quadraticCurveTo(w1 - wob, y0 + len * 0.55, w0, y0);
          g.closePath();
          g.fill();
          g.restore();

          // Embers, spawned in world space at the tip of the jet.
          const tipX = headX - Math.sin(aim) * (y0 + len);
          const tipY = headY + Math.cos(aim) * (y0 + len);
          for (let i = 0; i < 2; i++) {
            parts.smoke(tipX + rnd(-12, 12), tipY + rnd(-8, 8), rnd(9, 18), '#fca5a5');
          }
          if (grow > 0.4) shake.add(1.6);
          // Close enough to singe him: sparks off the king himself.
          if (len > dist * 0.9) parts.explosion(kx + rnd(-6, 6), ky + rnd(-6, 6), 0.3);
        }
      } else if (dragState === 'charge' && Math.random() < 0.4) {
        const mx = headX - Math.sin(aim) * mouth;
        const my = headY + Math.cos(aim) * mouth;
        parts.smoke(mx + rnd(-10, 10), my, rnd(6, 12), '#fdba74');
      }

      g.restore();
    };
    let running = true;
    let live = false;              // pile only rises after the first move
    let flash = 0;
    let overAt = 0;
    let result: Outcome | null = null;
    let selected: { r: number; c: number } | null = null;
    let dragFrom: { r: number; c: number; x: number; y: number } | null = null;
    let swapAnim: { ar: number; ac: number; br: number; bc: number; reject: boolean } | null = null;
    let popping: [number, number][] = [];
    const startedAt = performance.now();

    // ---------------------------------------------------------------
    // Layout
    // ---------------------------------------------------------------
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const pad = Math.max(6, W * 0.025);
      cell = Math.min((W - pad * 2) / COLS, (H * 0.56) / ROWS);
      boardX = (W - cell * COLS) / 2;
      boardTop = H - cell * ROWS - pad;
      sceneH = boardTop;

      wallSprite = createWallSprite(W, Math.max(1, sceneH));
      rubbleSprite = createRubbleSprite(Math.max(1, cell * COLS), Math.max(1, sceneH));
      kingParts = createKingParts(cell * 1.25);
      dragonParts = createDragonParts(cell * 1.9, cell * 1.5);
      tileSprites = Array.from({ length: TYPES }, (_, i) => createTileSprite(i, cell, dpr));
    };
    fit();
    window.addEventListener('resize', fit);

    const cellAt = (px: number, py: number) => {
      const c = Math.floor((px - boardX) / cell);
      const r = Math.floor((py - boardTop) / cell);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
      return { r, c };
    };

    // ---------------------------------------------------------------
    // Round flow
    // ---------------------------------------------------------------
    const finish = (why: Outcome) => {
      if (result) return;
      phase = 'over';
      result = why;
      overAt = performance.now();
      setOutcome(why);
      flash = 1;
      shake.add(why === 'escaped' ? 12 : 20);
      const kx = boardX + cell * COLS * kingX;
      if (why === 'escaped') {
        parts.confetti(kx, sceneH * 0.4, 110);
      } else {
        parts.explosion(kx, sceneH * 0.3, 1.7);
      }
    };

    const award = (cleared: number) => {
      const gained = Math.max(1, Math.round(cleared / 3));
      hitCount = Math.min(hitsTarget, hitCount + gained);
      peril = clamp(peril - DROP_PER_HIT * gained, 0, 1);
      setHits(hitCount);
      onHit?.(hitCount);
      if (hitCount >= hitsTarget) finish('escaped');
    };

    /** Clears whatever is matching; returns false when the board is quiet. */
    const resolve = (): boolean => {
      const m = findMatches(grid);
      if (!m.size) {
        if (!hasMove(grid)) {
          // Dead board: repack it rather than stranding the player.
          const fresh = makeGrid();
          for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c] = fresh[r][c];
          calls.add(boardX + (cell * COLS) / 2, boardTop + cell, 'NO MOVES — RESHUFFLED', '#e2e8f0');
        }
        phase = 'idle';
        return false;
      }

      popping = [];
      for (const k of m) {
        const [r, c] = k.split(',').map(Number);
        const t = grid[r][c];
        if (t) { t.pop = 0.0001; popping.push([r, c]); }
      }
      phase = 'clear';
      timer = 0;
      return true;
    };

    const trySwap = (a: { r: number; c: number }, b: { r: number; c: number }) => {
      if (phase !== 'idle' || !grid[a.r][a.c] || !grid[b.r][b.c]) return;
      const adjacent = Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
      if (!adjacent) return;

      live = true;
      setStarted(true);

      const ta = grid[a.r][a.c], tb = grid[b.r][b.c];
      grid[a.r][a.c] = tb; grid[b.r][b.c] = ta;

      if (findMatches(grid).size) {
        swapAnim = { ar: a.r, ac: a.c, br: b.r, bc: b.c, reject: false };
      } else {
        // Put it straight back; the animation plays the nudge and return.
        grid[a.r][a.c] = ta; grid[b.r][b.c] = tb;
        swapAnim = { ar: a.r, ac: a.c, br: b.r, bc: b.c, reject: true };
      }
      selected = null;
      phase = 'anim';
      timer = 0;
    };

    // ---------------------------------------------------------------
    // Input
    // ---------------------------------------------------------------
    const localPoint = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onDown = (e: PointerEvent) => {
      if (phase !== 'idle') return;
      const p = localPoint(e);
      const at = cellAt(p.x, p.y);
      if (!at) return;
      canvas.setPointerCapture?.(e.pointerId);
      if (selected && (Math.abs(selected.r - at.r) + Math.abs(selected.c - at.c) === 1)) {
        trySwap(selected, at);
        dragFrom = null;
        return;
      }
      selected = at;
      dragFrom = { ...at, x: p.x, y: p.y };
    };

    const onMove = (e: PointerEvent) => {
      if (!dragFrom || phase !== 'idle') return;
      const p = localPoint(e);
      const dx = p.x - dragFrom.x, dy = p.y - dragFrom.y;
      if (Math.hypot(dx, dy) < cell * 0.4) return;
      const target = Math.abs(dx) > Math.abs(dy)
        ? { r: dragFrom.r, c: dragFrom.c + (dx > 0 ? 1 : -1) }
        : { r: dragFrom.r + (dy > 0 ? 1 : -1), c: dragFrom.c };
      const from = { r: dragFrom.r, c: dragFrom.c };
      dragFrom = null;
      if (target.r < 0 || target.r >= ROWS || target.c < 0 || target.c >= COLS) return;
      trySwap(from, target);
    };

    const onUp = () => { dragFrom = null; };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    // ---------------------------------------------------------------
    // Frame
    // ---------------------------------------------------------------
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      if (!running) return;
      const rawMs = Math.min(50, now - last);
      last = now;
      const dt = rawMs / 16.667;
      timer += rawMs;

      // ---- pile physics ----
      if (phase !== 'over') {
        if (live) peril = clamp(peril + rawMs / (RISE_SECONDS * 1000), 0, 1);
        if (Math.abs(peril - shownPeril) > 0.01) { shownPeril = peril; setDanger(peril); }
        if (peril >= 1) finish('caught');
      }

      updateActors(rawMs);

      // ---- phase machine ----
      if (phase === 'anim' && swapAnim && timer >= SWAP_MS) {
        const reject = swapAnim.reject;
        swapAnim = null;
        if (reject) { phase = 'idle'; } else { resolve(); }
      } else if (phase === 'clear' && timer >= POP_MS) {
        let n = 0;
        for (const [r, c] of popping) {
          if (!grid[r][c]) continue;
          const px = boardX + c * cell + cell / 2;
          const py = boardTop + r * cell + cell / 2;
          parts.explosion(px, py, 0.42);
          grid[r][c] = null;
          n++;
        }
        if (n) {
          shake.add(Math.min(9, 2 + n * 0.6));
          const gained = Math.max(1, Math.round(n / 3));
          const cx0 = boardX + (cell * COLS) / 2;
          calls.add(cx0, boardTop - cell * 0.3, `-${gained} RUBBLE`, '#7dd3fc');
          award(n);
        }
        popping = [];
        if (phase !== 'over') {
          applyGravity(grid);
          phase = 'fall';
          timer = 0;
        }
      } else if (phase === 'fall' && timer >= FALL_MS) {
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const t = grid[r][c];
          if (t) t.dy = 0;
        }
        if (phase !== 'over') resolve();
      }

      // ---- animation progress ----
      const popT = phase === 'clear' ? clamp(timer / POP_MS, 0, 1) : 0;
      if (phase === 'clear') for (const [r, c] of popping) {
        const t = grid[r][c];
        if (t) t.pop = popT;
      }
      if (phase === 'fall') {
        const k = 1 - easeOutCubic(clamp(timer / FALL_MS, 0, 1));
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const t = grid[r][c];
          if (t) t.dy = t.dy0 * k;
        }
      }

      // =============================================================
      // Draw
      // =============================================================
      ctx.clearRect(0, 0, W, H);
      shake.update();
      shake.begin(ctx);

      // ---- shaft walls ----
      if (wallSprite) ctx.drawImage(wallSprite, 0, 0, W, sceneH);

      const shaftX = boardX, shaftW = cell * COLS;
      const kingH = kingParts ? kingParts.totalH : cell * 1.45;
      const ceiling = cell * 1.5;                        // the height of the jaws
      // At full peril his head is level with the mouth, not sailing past it.
      const pileTop = lerp(sceneH, ceiling + kingH * 0.95, peril);
      const pileH = Math.max(0, sceneH - pileTop);

      // ---- rubble, drawn as the bottom slice of the baked column ----
      if (rubbleSprite && pileH > 1) {
        const srcY = rubbleSprite.height - pileH;
        ctx.drawImage(
          rubbleSprite,
          0, Math.max(0, srcY), rubbleSprite.width, Math.min(rubbleSprite.height, pileH),
          shaftX, pileTop, shaftW, pileH,
        );
        // A lit crest so the top of the pile reads as a surface.
        ctx.fillStyle = 'rgba(226,232,240,0.35)';
        ctx.fillRect(shaftX, pileTop, shaftW, 3);
      }

      // ---- where the king has got to along the crest ----
      const kingPx = shaftX + shaftW * kingX;
      const kingFeetY = pileTop - kingHop * cell;
      const kingHeadY = kingFeetY - kingH * 0.6;

      // ---- the king ----
      if (kingParts) {
        ctx.save();
        if (result === 'caught') ctx.globalAlpha = clamp(1 - (now - overAt) / 700, 0, 1);
        // On a win he rides the collapsing pile down and out of shot.
        const drop = result === 'escaped'
          ? easeOutCubic(clamp((now - overAt) / 900, 0, 1)) * cell * 1.4
          : 0;
        drawKing(ctx, kingPx, kingFeetY + drop, now);
        ctx.restore();
      }

      // ---- dragon, hunting him along it ----
      if (dragonParts) drawDragon(ctx, now, shaftX, shaftW, kingPx, kingHeadY);

      // ---- shaft edge pillars, over the rubble ----
      const pillar = ctx.createLinearGradient(0, 0, 0, sceneH);
      pillar.addColorStop(0, '#f59e0b');
      pillar.addColorStop(1, '#b45309');
      ctx.fillStyle = pillar;
      ctx.fillRect(shaftX - cell * 0.16, 0, cell * 0.16, sceneH);
      ctx.fillRect(shaftX + shaftW, 0, cell * 0.16, sceneH);

      // ---- board ----
      ctx.save();
      ctx.fillStyle = 'rgba(15,23,42,0.55)';
      ctx.fillRect(boardX - 4, boardTop - 4, cell * COLS + 8, cell * ROWS + 8);
      ctx.beginPath();
      ctx.rect(boardX, boardTop, cell * COLS, cell * ROWS);
      ctx.clip();

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const t = grid[r][c];
          if (!t) continue;

          let x = boardX + c * cell;
          let y = boardTop + (r - t.dy) * cell;

          if (swapAnim) {
            const p = clamp(timer / SWAP_MS, 0, 1);
            const isA = swapAnim.ar === r && swapAnim.ac === c;
            const isB = swapAnim.br === r && swapAnim.bc === c;
            if (isA || isB) {
              const ox = (isA ? swapAnim.bc - swapAnim.ac : swapAnim.ac - swapAnim.bc) * cell;
              const oy = (isA ? swapAnim.br - swapAnim.ar : swapAnim.ar - swapAnim.br) * cell;
              // A rejected swap pushes out and springs back; a good one glides home.
              const k = swapAnim.reject ? Math.sin(p * Math.PI) * 0.85 : 1 - p;
              x += ox * k;
              y += oy * k;
            }
          }

          const sprite = tileSprites[t.t];
          if (!sprite) continue;

          const s = t.pop ? 1 - easeOutCubic(t.pop) : 1;
          if (s <= 0.02) continue;

          ctx.save();
          ctx.translate(x + cell / 2, y + cell / 2);
          if (t.pop) { ctx.rotate(t.pop * 0.9); ctx.globalAlpha = 1 - t.pop; }
          ctx.scale(s, s);
          ctx.drawImage(sprite, -cell / 2, -cell / 2, cell, cell);
          ctx.restore();
        }
      }

      // selection ring
      if (selected && phase === 'idle') {
        const pulse = 0.55 + Math.sin(now / 180) * 0.25;
        ctx.strokeStyle = `rgba(253,224,71,${pulse})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(
          boardX + selected.c * cell + 2, boardTop + selected.r * cell + 2,
          cell - 4, cell - 4,
        );
      }
      ctx.restore();

      // ---- effects ----
      calls.update(dt);
      calls.draw(ctx);
      parts.update(dt);
      parts.draw(ctx);
      shake.end(ctx);

      drawVignette(ctx, W, H);
      if (flash > 0) { drawFlash(ctx, W, H, flash); flash -= 0.05 * dt; }

      // A red rim once the dragon is within reach — readable at a glance.
      if (peril > 0.62 && phase !== 'over') {
        ctx.strokeStyle = `rgba(239,68,68,${(peril - 0.62) / 0.38 * (0.45 + Math.sin(now / 150) * 0.25)})`;
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, W - 6, H - 6);
      }

      // ---- hand off once the outro has played ----
      if (phase === 'over' && now - overAt > 1400) {
        running = false;
        onFinish(hitCount, {
          game: 'match',
          outcome: result,
          target: hitsTarget,
          peril: Number(peril.toFixed(3)),
          seconds: Math.round((now - startedAt) / 1000),
        });
        return;
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.round((hits / Math.max(1, hitsTarget)) * 100);

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 shadow-2xl shadow-slate-950/50">
      {/* ---- king's safety meter ---- */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">King</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{
              width: `${Math.max(3, (1 - danger) * 100)}%`,
              background: danger > 0.62
                ? 'linear-gradient(90deg,#ef4444,#f97316)'
                : 'linear-gradient(90deg,#22c55e,#84cc16)',
            }}
          />
        </div>
        <span className={`text-[9px] font-black uppercase tracking-widest ${danger > 0.62 ? 'text-rose-400' : 'text-emerald-400'}`}>
          {danger > 0.62 ? 'In reach' : 'Safe'}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        className="mx-auto block h-[520px] w-full max-w-[400px] cursor-pointer touch-none select-none"
      />

      <div className="mt-3 text-center">
        {outcome === 'escaped' && (
          <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
            The king is clear — {hits}/{hitsTarget}
          </p>
        )}
        {outcome === 'caught' && (
          <p className="text-sm font-black uppercase tracking-[0.2em] text-rose-400">
            The dragon got him — {hits}/{hitsTarget} banked
          </p>
        )}
        {!outcome && (
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">
            {hits}/{hitsTarget} cleared · {pct}%
          </p>
        )}
        <p className="mt-1 text-center text-[10px] font-medium leading-relaxed text-slate-500">
          {started
            ? 'Match three to collapse the rubble. Every clear drops the king further from the jaws.'
            : 'Swap two neighbours to line up three of a kind. The pile starts rising on your first move.'}
        </p>
      </div>
    </div>
  );
}
