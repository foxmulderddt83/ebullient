import { useEffect, useRef, useState } from 'react';
import type { GameProps } from './types';
import {
  ParticleField, Shaker, Callouts, createJetSprite, drawNightSky, drawSkyline,
  drawVignette, drawFlash, rnd, clamp,
} from './engine';

/**
 * Sky Shooter — a night intercept. Jets dive out of the dark toward a
 * turret on the deck and the player taps them down.
 *
 * The tap itself decides the hit and a tracer is drawn from the turret to
 * where the player touched. Firing a real travelling bullet and testing
 * collision mid-flight looks better on paper, but on a phone it means a
 * tap that visibly landed on a target can still miss, which reads as
 * broken. The tracer keeps the feel; the tap keeps the fairness.
 */

interface Jet {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  dead: boolean;
  deadFor: number;
  roll: number;
  spin: number;
  burn: number;       // afterburner emit timer
  lock: number;       // 0..1 reticle bloom
}

interface Tracer { x1: number; y1: number; x2: number; y2: number; life: number }

const ROUND_SECONDS = 30;
const COMBO_WINDOW = 900;

export function SkyShooterGame({ hitsTarget, onFinish, onHit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hits, setHits] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [combo, setCombo] = useState(0);
  const [shots, setShots] = useState(0);

  const jets = useRef<Jet[]>([]);
  const tracers = useRef<Tracer[]>([]);
  const hitCount = useRef(0);
  const shotCount = useRef(0);
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
    let spawnIn = 350;
    let last = performance.now();
    let flash = 0;
    let freeze = 0;
    let recoil = 0;
    let barrelAngle = -Math.PI / 2;

    const parts = new ParticleField();
    const shake = new Shaker();
    const calls = new Callouts();
    const sprite = createJetSprite();

    // Backdrop is randomised once, then reused — a skyline that reshuffles
    // every frame reads as noise.
    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random(), y: Math.random() * 0.75, r: rnd(0.5, 1.7), p: rnd(0, 6.28),
    }));
    const towers = Array.from({ length: 14 }, (_, i) => ({
      x: i / 14 + rnd(-0.02, 0.02),
      w: rnd(0.04, 0.085),
      h: rnd(0.06, 0.2),
      lit: Array.from({ length: 14 }, () => Math.random()),
    }));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener('resize', fit);

    startedAt.current = performance.now();

    const spawn = () => {
      const size = rnd(34, 54);
      jets.current.push({
        x: rnd(size, Math.max(size + 1, W - size)),
        y: -size,
        vx: rnd(-0.7, 0.7),
        vy: rnd(1.5, 2.6),
        size,
        dead: false, deadFor: 0,
        roll: 0, spin: 0,
        burn: 0, lock: 0,
      });
    };

    const end = () => {
      if (finished.current) return;
      finished.current = true;
      running = false;
      onFinish(hitCount.current, {
        game: 'shoot',
        seconds: Math.round((performance.now() - startedAt.current) / 1000),
        target: hitsTarget,
        shots: shotCount.current,
      });
    };

    const onDown = (e: PointerEvent) => {
      if (finished.current) return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;

      const gunX = W / 2, gunY = H - 22;
      barrelAngle = Math.atan2(y - gunY, x - gunX);
      tracers.current.push({ x1: gunX, y1: gunY, x2: x, y2: y, life: 1 });
      recoil = 1;
      shotCount.current += 1;
      setShots(shotCount.current);

      // muzzle flash + ejected sparks
      parts.explosion(gunX + Math.cos(barrelAngle) * 30, gunY + Math.sin(barrelAngle) * 30, 0.34);

      // Nearest live jet under the tap wins, so overlapping targets never
      // swallow a shot that clearly landed on the front one.
      let best: Jet | null = null;
      let bestD = Infinity;
      for (const j of jets.current) {
        if (j.dead) continue;
        const d = Math.hypot(j.x - x, j.y - y);
        if (d < j.size * 0.85 && d < bestD) { best = j; bestD = d; }
      }

      if (best) {
        const j = best as Jet;
        j.dead = true;
        j.spin = rnd(-0.2, 0.2) || 0.14;
        parts.explosion(j.x, j.y, j.size / 42);
        shake.add(11);
        flash = 0.9;
        freeze = 55;

        const now = performance.now();
        comboRef.current = now - lastHitAt.current < COMBO_WINDOW ? comboRef.current + 1 : 1;
        lastHitAt.current = now;
        setCombo(comboRef.current);

        hitCount.current += 1;
        setHits(hitCount.current);
        onHit?.(hitCount.current);

        calls.add(j.x, j.y - j.size * 0.4,
          comboRef.current > 1 ? `${comboRef.current}x COMBO` : 'HIT!',
          comboRef.current > 1 ? '#fbbf24' : '#fff');

        if (hitCount.current >= hitsTarget) end();
      } else {
        comboRef.current = 0;
        setCombo(0);
      }
    };

    canvas.addEventListener('pointerdown', onDown);

    const drawJet = (j: Jet) => {
      const h = j.size * (200 / 150);
      ctx.save();
      ctx.translate(j.x, j.y);
      ctx.rotate(j.dead ? j.roll : Math.atan2(j.vx, j.vy) * -0.5);
      if (j.dead) ctx.globalAlpha = clamp(1 - j.deadFor / 1200, 0, 1);

      // afterburner cone behind the tail
      if (!j.dead) {
        const bl = h * (0.36 + Math.sin(performance.now() / 45) * 0.06);
        const bg = ctx.createLinearGradient(0, h * 0.42, 0, h * 0.42 + bl);
        bg.addColorStop(0, 'rgba(255,255,255,0.95)');
        bg.addColorStop(0.25, 'rgba(147,197,253,0.8)');
        bg.addColorStop(0.6, 'rgba(59,130,246,0.35)');
        bg.addColorStop(1, 'rgba(59,130,246,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(-j.size * 0.1, h * 0.42);
        ctx.lineTo(j.size * 0.1, h * 0.42);
        ctx.lineTo(0, h * 0.42 + bl);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.drawImage(sprite, -j.size / 2, -h / 2, j.size, h);
      ctx.restore();

      // lock-on reticle, blooming as it closes
      if (!j.dead && j.lock > 0.02) {
        const t = j.lock;
        const r = j.size * (0.6 - 0.12 * t);
        ctx.save();
        ctx.translate(j.x, j.y);
        ctx.rotate(performance.now() / 1400);
        ctx.globalAlpha = t * 0.85;
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(r, r * 0.55);
          ctx.lineTo(r, r);
          ctx.lineTo(r * 0.55, r);
          ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    };

    const drawTurret = () => {
      const gx = W / 2, gy = H - 18 + recoil * 5;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.scale(0.72, 0.72);

      // barrel
      ctx.save();
      ctx.rotate(barrelAngle + Math.PI / 2);
      const bar = ctx.createLinearGradient(-5, 0, 5, 0);
      bar.addColorStop(0, '#334155');
      bar.addColorStop(0.5, '#94a3b8');
      bar.addColorStop(1, '#1e293b');
      ctx.fillStyle = bar;
      ctx.fillRect(-5, -40 + recoil * 8, 10, 42);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-7, -44 + recoil * 8, 14, 7);
      ctx.restore();

      // mount
      const mg = ctx.createLinearGradient(0, -16, 0, 16);
      mg.addColorStop(0, '#475569');
      mg.addColorStop(1, '#0f172a');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.moveTo(-34, 18); ctx.lineTo(-18, -14);
      ctx.lineTo(18, -14); ctx.lineTo(34, 18);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#CD5C5C';
      ctx.fillRect(-12, -4, 24, 5);
      ctx.restore();
    };

    const frame = (now: number) => {
      if (!running) return;
      const raw = now - last;
      last = now;
      let dt = clamp(raw / 16.667, 0, 3);
      if (freeze > 0) { freeze -= raw; dt = 0; }

      drawNightSky(ctx, W, H, stars, now);
      drawSkyline(ctx, W, H, towers);

      const elapsed = (now - startedAt.current) / 1000;
      const left = Math.max(0, ROUND_SECONDS - elapsed);
      setSecondsLeft(Math.ceil(left));
      if (left <= 0) { end(); return; }

      if (comboRef.current && now - lastHitAt.current > COMBO_WINDOW) {
        comboRef.current = 0; setCombo(0);
      }

      shake.update();
      shake.begin(ctx);

      spawnIn -= dt > 0 ? raw : 0;
      if (spawnIn <= 0 && jets.current.filter(j => !j.dead).length < 6) {
        spawn();
        spawnIn = rnd(360, 700);
      }

      for (const j of jets.current) {
        if (dt > 0) {
          if (j.dead) {
            j.deadFor += raw;
            j.vy += 0.3 * dt;
            j.roll += j.spin * dt;
            j.burn -= raw;
            if (j.burn <= 0) { parts.smoke(j.x + rnd(-6, 6), j.y, rnd(12, 20), '#475569'); j.burn = 34; }
          } else {
            // Lock tightens as the jet comes into the engagement envelope.
            j.lock = clamp(j.lock + (j.y > H * 0.12 ? 0.05 : -0.05) * dt, 0, 1);
            j.burn -= raw;
            if (j.burn <= 0) {
              parts.smoke(j.x, j.y - j.size * 0.5, rnd(4, 7), '#93c5fd');
              j.burn = 55;
            }
            if (j.x < j.size * 0.4 || j.x > W - j.size * 0.4) j.vx *= -1;
          }
          j.x += j.vx * dt;
          j.y += j.vy * dt;
        }
        drawJet(j);
      }
      jets.current = jets.current.filter(
        j => (j.dead ? j.y < H + 180 : j.y < H * 0.94) && j.deadFor < 1300,
      );

      if (dt > 0) { parts.update(dt); calls.update(dt); }
      parts.draw(ctx);

      // tracers, glow pass then core
      for (const tr of tracers.current) {
        if (dt > 0) tr.life -= 0.09 * dt;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.max(0, tr.life) * 0.5;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
        ctx.globalAlpha = Math.max(0, tr.life);
        ctx.strokeStyle = '#fffbeb';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      tracers.current = tracers.current.filter(t => t.life > 0);

      if (recoil > 0) recoil -= 0.08 * Math.max(dt, 0.4);
      drawTurret();

      calls.draw(ctx);
      shake.end(ctx);

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.min(100, (hits / hitsTarget) * 100);
  const accuracy = shots ? Math.round((hits / shots) * 100) : 100;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl shadow-slate-950/50">
      <canvas
        ref={canvasRef}
        className="block h-[340px] w-full touch-none select-none sm:h-[440px]"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-black/30">
        <div
          className="h-full bg-gradient-to-r from-[#CD5C5C] via-amber-400 to-emerald-400 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <span className="rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-white backdrop-blur-md">
          {hits} / {hitsTarget} down
        </span>
        {combo > 1 && (
          <span className="animate-pulse rounded-lg border border-amber-300/40 bg-amber-400/25 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-amber-200 backdrop-blur-md">
            {combo}x combo
          </span>
        )}
        <span className={`rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest backdrop-blur-md ${
          secondsLeft <= 5 ? 'bg-rose-600/70 text-white' : 'bg-black/50 text-white'
        }`}>
          {secondsLeft}s
        </span>
      </div>

      {shots > 0 && (
        <span className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300 backdrop-blur-md">
          {accuracy}% accuracy
        </span>
      )}

      {shots === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-[11px] font-black uppercase tracking-[0.25em] text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          Tap the jets to shoot them down
        </p>
      )}
    </div>
  );
}
