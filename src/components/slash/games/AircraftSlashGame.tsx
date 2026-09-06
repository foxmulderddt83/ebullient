import { useEffect, useRef, useState } from 'react';
import type { GameProps } from './types';
import {
  ParticleField, Shaker, Callouts, createAircraftSprite, makeClouds, drawClouds,
  drawDaySky, drawRidges, drawVignette, drawFlash, rnd, clamp, type Cloud,
} from './engine';

/**
 * Sky Slash — aircraft cross a live sky and the player swipes through them.
 *
 * Everything is one canvas: a parallax backdrop (sky, ridges, three cloud
 * depths), sprite-blitted aircraft with animated propellers and contrails,
 * a glowing multi-pass blade trail, and a particle layer for the wreckage.
 *
 * The whole loop runs on delta time rather than frame count, so a 120Hz
 * iPad and a struggling budget Android play at the same speed instead of
 * one of them running the round at double pace.
 */

interface Plane {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  dead: boolean;
  deadFor: number;
  roll: number;          // banking, eased toward the direction of travel
  spin: number;          // tumble once cut
  prop: number;          // propeller phase
  puff: number;          // contrail emit timer
  hp: number;
}

interface TrailPoint { x: number; y: number; t: number }

const ROUND_SECONDS = 30;
const COMBO_WINDOW = 900;   // ms within which hits chain

export function AircraftSlashGame({ hitsTarget, onFinish, onHit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hits, setHits] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [combo, setCombo] = useState(0);

  const planes = useRef<Plane[]>([]);
  const trail = useRef<TrailPoint[]>([]);
  const pressed = useRef(false);
  const hitCount = useRef(0);
  const finished = useRef(false);
  const startedAt = useRef(0);
  const comboRef = useRef(0);
  const lastHitAt = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let spawnIn = 400;
    let last = performance.now();
    let flash = 0;
    let freeze = 0;          // hit-stop, in ms
    let scroll = 0;          // parallax offset

    const parts = new ParticleField();
    const shake = new Shaker();
    const calls = new Callouts();
    const sprite = createAircraftSprite();
    let clouds: Cloud[] = [];

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!clouds.length) clouds = makeClouds(W, H, 6);
    };
    fit();
    window.addEventListener('resize', fit);

    startedAt.current = performance.now();

    const spawn = () => {
      const fromLeft = Math.random() < 0.5;
      const size = rnd(46, 76);
      const speed = rnd(2.1, 3.6);
      planes.current.push({
        x: fromLeft ? -size : W + size,
        y: rnd(H * 0.14, H * 0.74),
        vx: fromLeft ? speed : -speed,
        vy: rnd(-0.35, 0.35),
        size,
        dead: false, deadFor: 0,
        roll: 0, spin: 0,
        prop: Math.random() * 6.28,
        puff: 0,
        hp: 1,
      });
    };

    /** Point-to-segment distance — the swipe/aircraft hit test. */
    const distSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax, dy = by - ay;
      const l2 = dx * dx + dy * dy;
      const t = l2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    };

    const end = () => {
      if (finished.current) return;
      finished.current = true;
      running = false;
      onFinish(hitCount.current, {
        game: 'slash',
        seconds: Math.round((performance.now() - startedAt.current) / 1000),
        target: hitsTarget,
      });
    };

    const registerHit = (p: Plane) => {
      if (p.dead || finished.current) return;
      p.dead = true;
      p.spin = rnd(-0.14, 0.14) || 0.1;

      parts.explosion(p.x, p.y, p.size / 62);
      shake.add(9);
      flash = 0.85;
      freeze = 55;                           // brief hit-stop: the hit lands

      const now = performance.now();
      comboRef.current = now - lastHitAt.current < COMBO_WINDOW ? comboRef.current + 1 : 1;
      lastHitAt.current = now;
      setCombo(comboRef.current);

      hitCount.current += 1;
      setHits(hitCount.current);
      onHit?.(hitCount.current);

      calls.add(
        p.x, p.y - p.size * 0.3,
        comboRef.current > 1 ? `${comboRef.current}x COMBO` : 'CUT!',
        comboRef.current > 1 ? '#fbbf24' : '#fff',
      );

      if (hitCount.current >= hitsTarget) end();
    };

    // ---------------- input ----------------
    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onDown = (e: PointerEvent) => {
      pressed.current = true;
      const { x, y } = pos(e);
      trail.current = [{ x, y, t: performance.now() }];
      // A clean tap counts too — not everyone swipes on a phone.
      planes.current.forEach(p => {
        if (!p.dead && Math.hypot(p.x - x, p.y - y) < p.size * 0.55) registerHit(p);
      });
      canvas.setPointerCapture?.(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!pressed.current) return;
      const { x, y } = pos(e);
      const prev = trail.current[trail.current.length - 1];
      const pt = { x, y, t: performance.now() };
      trail.current.push(pt);
      if (trail.current.length > 26) trail.current.shift();
      if (prev) {
        planes.current.forEach(p => {
          if (p.dead) return;
          if (distSeg(p.x, p.y, prev.x, prev.y, pt.x, pt.y) < p.size * 0.46) registerHit(p);
        });
      }
    };

    const onUp = () => { pressed.current = false; };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    // ---------------- drawing ----------------

    const drawPlane = (p: Plane) => {
      const h = p.size * (150 / 256);
      ctx.save();
      ctx.translate(p.x, p.y);

      // Nose follows the flight path; a cut aircraft tumbles instead.
      const heading = p.dead ? p.roll : Math.atan2(p.vy, Math.abs(p.vx)) * 0.6;
      ctx.rotate(heading);
      if (p.vx < 0) ctx.scale(-1, 1);        // mirror, so it always flies nose-first

      if (p.dead) {
        ctx.globalAlpha = clamp(1 - p.deadFor / 1400, 0, 1);
      }

      // ground shadow hint under the aircraft
      ctx.save();
      ctx.globalAlpha *= 0.18;
      ctx.translate(6, 10);
      ctx.filter = 'blur(1px)';
      ctx.drawImage(sprite, -p.size / 2, -h / 2, p.size, h);
      ctx.restore();
      ctx.filter = 'none';

      ctx.drawImage(sprite, -p.size / 2, -h / 2, p.size, h);

      // --- propeller: a translucent disc plus two swept blades ---
      const px = p.size * 0.455, py = -h * 0.045;
      const pr = h * 0.42;
      ctx.save();
      ctx.translate(px, py);
      ctx.globalAlpha *= p.dead ? 0.25 : 0.55;
      const disc = ctx.createRadialGradient(0, 0, pr * 0.15, 0, 0, pr);
      disc.addColorStop(0, 'rgba(255,255,255,0.05)');
      disc.addColorStop(0.75, 'rgba(226,232,240,0.30)');
      disc.addColorStop(1, 'rgba(226,232,240,0)');
      ctx.fillStyle = disc;
      ctx.beginPath(); ctx.ellipse(0, 0, pr * 0.34, pr, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        const a = p.prop + i * Math.PI;
        ctx.beginPath();
        ctx.ellipse(0, 0, pr * 0.3, pr, 0, a, a + 0.7);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    };

    const frame = (now: number) => {
      if (!running) return;
      const raw = now - last;
      last = now;
      // Normalised to 60fps steps, clamped so a stalled tab does not teleport.
      let dt = clamp(raw / 16.667, 0, 3);

      if (freeze > 0) { freeze -= raw; dt = 0; }

      // ---- backdrop ----
      scroll += dt * 0.6;
      drawDaySky(ctx, W, H, now);
      drawRidges(ctx, W, H, scroll);
      drawClouds(ctx, clouds, W, dt, -1);

      // ---- clock ----
      const elapsed = (now - startedAt.current) / 1000;
      const left = Math.max(0, ROUND_SECONDS - elapsed);
      setSecondsLeft(Math.ceil(left));
      if (left <= 0) { end(); return; }

      if (comboRef.current && now - lastHitAt.current > COMBO_WINDOW) {
        comboRef.current = 0;
        setCombo(0);
      }

      shake.update();
      shake.begin(ctx);

      // ---- spawning ----
      spawnIn -= raw * (dt > 0 ? 1 : 0);
      const alive = planes.current.filter(p => !p.dead).length;
      if (spawnIn <= 0 && alive < 5) {
        spawn();
        spawnIn = rnd(420, 780);
      }

      // ---- aircraft ----
      for (const p of planes.current) {
        if (dt > 0) {
          p.prop += dt * 0.9;
          if (p.dead) {
            p.deadFor += raw;
            p.vy += 0.34 * dt;              // falls out of the sky
            p.vx *= 0.985;
            p.roll += p.spin * dt;
            p.puff -= raw;
            if (p.puff <= 0) {
              parts.smoke(p.x + rnd(-8, 8), p.y + rnd(-6, 6), rnd(12, 22), '#64748b');
              p.puff = 38;
            }
          } else {
            p.puff -= raw;
            if (p.puff <= 0) {
              // Contrail streams from behind the tail, not from the centre.
              parts.smoke(p.x - Math.sign(p.vx) * p.size * 0.42, p.y + p.size * 0.02, rnd(5, 9));
              p.puff = 60;
            }
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        drawPlane(p);
      }
      planes.current = planes.current.filter(
        p => p.deadFor < 1500 && p.x > -320 && p.x < W + 320 && p.y < H + 260,
      );

      // ---- effects ----
      if (dt > 0) { parts.update(dt); calls.update(dt); }
      parts.draw(ctx);

      // ---- blade trail: soft glow under a bright core ----
      const cutoff = now - 300;
      trail.current = trail.current.filter(t => t.t > cutoff);
      if (trail.current.length > 1) {
        for (const pass of [
          { w: 26, col: 'rgba(125,211,252,0.30)', op: 'lighter' as GlobalCompositeOperation },
          { w: 11, col: 'rgba(255,255,255,0.55)', op: 'lighter' as GlobalCompositeOperation },
          { w: 4, col: '#ffffff', op: 'source-over' as GlobalCompositeOperation },
        ]) {
          ctx.globalCompositeOperation = pass.op;
          ctx.strokeStyle = pass.col;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (let i = 1; i < trail.current.length; i++) {
            const a = trail.current[i - 1], b = trail.current[i];
            const age = (now - b.t) / 300;
            const taper = (i / trail.current.length) * (1 - age);
            if (taper <= 0) continue;
            ctx.globalAlpha = taper;
            ctx.lineWidth = pass.w * taper;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }

      calls.draw(ctx);
      shake.end(ctx);

      // ---- post ----
      if (flash > 0) { drawFlash(ctx, W, H, flash); flash -= 0.09 * Math.max(dt, 0.5); }
      drawVignette(ctx, W, H);

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.min(100, (hits / hitsTarget) * 100);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-sky-950 shadow-2xl shadow-sky-950/40">
      <canvas
        ref={canvasRef}
        className="block h-[340px] w-full touch-none select-none sm:h-[440px]"
      />

      {/* progress rail */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-black/25">
        <div
          className="h-full bg-gradient-to-r from-[#CD5C5C] via-amber-400 to-emerald-400 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <span className="rounded-lg border border-white/10 bg-black/45 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-white backdrop-blur-md">
          {hits} / {hitsTarget} cut
        </span>
        {combo > 1 && (
          <span className="animate-pulse rounded-lg border border-amber-300/40 bg-amber-400/25 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-amber-200 backdrop-blur-md">
            {combo}x combo
          </span>
        )}
        <span className={`rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest backdrop-blur-md ${
          secondsLeft <= 5 ? 'bg-rose-600/70 text-white' : 'bg-black/45 text-white'
        }`}>
          {secondsLeft}s
        </span>
      </div>

      {hits === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-[11px] font-black uppercase tracking-[0.25em] text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          Swipe through the aircraft
        </p>
      )}
    </div>
  );
}
