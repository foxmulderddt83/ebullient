import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { GameProps } from './types';
import { ParticleField, Shaker, clamp, rnd } from './engine';

/**
 * Lucky Spin — one spin, stopped by hand.
 *
 * The wheel is not rigged: STOP switches on friction and whichever wedge
 * is under the needle when it actually comes to rest is the result.
 * Choosing a winner up front and animating towards it is the usual trick,
 * but then the button is decoration and the player is being asked to
 * believe their timing mattered.
 *
 * The face — metal rim, bevelled wedges, pegs, labels — is rendered once
 * into an offscreen canvas and then rotate-blitted, so a spinning wheel
 * costs one drawImage per frame instead of forty gradient fills.
 */

/** Each wedge as a fraction of a perfect round. */
const WEDGES = [1.0, 0.25, 0.65, 0.4, 0.9, 0.15, 0.75, 0.5];

type Phase = 'idle' | 'spinning' | 'stopping' | 'done';

export function LuckySpinGame({
  hitsTarget, onFinish, onHit, rewardPerPlayer = 0, rewardType = 'fixed',
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [resultLabel, setResultLabel] = useState<string | null>(null);

  const angle = useRef(0);
  const velocity = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  const finished = useRef(false);
  const startedAt = useRef(0);

  const label = (fraction: number) => {
    if (!rewardPerPlayer) return `${Math.round(fraction * 100)}%`;
    const v = rewardPerPlayer * fraction;
    return rewardType === 'percent' ? `${v.toFixed(0)}%` : `RM ${v.toFixed(0)}`;
  };

  /** ["RM", "38"] for ringgit, ["", "38%"] for a percentage. */
  const splitLabel = (fraction: number): [string, string] => {
    if (!rewardPerPlayer) return ['', `${Math.round(fraction * 100)}%`];
    const v = rewardPerPlayer * fraction;
    return rewardType === 'percent' ? ['', `${v.toFixed(0)}%`] : ['RM', v.toFixed(0)];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let last = performance.now();
    let face: HTMLCanvasElement | null = null;
    let faceR = 0;
    let pegAngle = 0;      // needle deflection
    let pegVel = 0;
    let lastPeg = -1;
    let glow = 0;
    let winIdx = -1;

    const parts = new ParticleField();
    const shake = new Shaker();
    const seg = (Math.PI * 2) / WEDGES.length;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;

    /** Draws the wheel face once at the size it will be displayed. */
    const buildFace = (R: number) => {
      const size = Math.ceil(R * 2 + 8);
      const c = document.createElement('canvas');
      c.width = c.height = Math.ceil(size * dpr);
      const g = c.getContext('2d')!;
      g.scale(dpr, dpr);
      const cx = size / 2, cy = size / 2;

      WEDGES.forEach((_, i) => {
        const a0 = i * seg, a1 = a0 + seg;
        const mid = a0 + seg / 2;

        // Radial shading so each wedge reads as a lit surface, not a flat fill.
        const base = i % 2 === 0
          ? ['#e8746f', '#CD5C5C', '#8f3d3d']
          : ['#33415a', '#1e293b', '#0b1120'];
        const grad = g.createRadialGradient(
          cx + Math.cos(mid) * R * 0.15, cy + Math.sin(mid) * R * 0.15, R * 0.1,
          cx, cy, R,
        );
        grad.addColorStop(0, base[0]);
        grad.addColorStop(0.55, base[1]);
        grad.addColorStop(1, base[2]);

        g.beginPath();
        g.moveTo(cx, cy);
        g.arc(cx, cy, R, a0, a1);
        g.closePath();
        g.fillStyle = grad;
        g.fill();

        // separator with a highlight edge, for the bevel
        g.strokeStyle = 'rgba(255,255,255,0.22)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
        g.stroke();

        // Labels are NOT baked in - see drawLabels(). Text painted into a
        // rotating face turns upside down through half of every spin.
      });

      // inner shadow around the hub, so the face looks dished
      const dish = g.createRadialGradient(cx, cy, R * 0.08, cx, cy, R * 0.55);
      dish.addColorStop(0, 'rgba(0,0,0,0.45)');
      dish.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = dish;
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();

      // brushed metal rim
      const rim = g.createLinearGradient(0, 0, size, size);
      rim.addColorStop(0, '#f8fafc');
      rim.addColorStop(0.25, '#94a3b8');
      rim.addColorStop(0.5, '#f1f5f9');
      rim.addColorStop(0.75, '#64748b');
      rim.addColorStop(1, '#e2e8f0');
      g.strokeStyle = rim;
      g.lineWidth = R * 0.075;
      g.beginPath(); g.arc(cx, cy, R - R * 0.03, 0, Math.PI * 2); g.stroke();

      // pegs the needle will flick against
      for (let i = 0; i < WEDGES.length; i++) {
        const a = i * seg;
        const px = cx + Math.cos(a) * (R - R * 0.035);
        const py = cy + Math.sin(a) * (R - R * 0.035);
        const pg = g.createRadialGradient(px - 1.5, py - 1.5, 0.5, px, py, R * 0.032);
        pg.addColorStop(0, '#ffffff');
        pg.addColorStop(1, '#64748b');
        g.fillStyle = pg;
        g.beginPath(); g.arc(px, py, R * 0.03, 0, Math.PI * 2); g.fill();
      }

      c.style.width = `${size}px`;
      return c;
    };

    const fit = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      faceR = Math.min(W, H) / 2 - 14;
      face = buildFace(faceR);
    };
    fit();
    window.addEventListener('resize', fit);

    /**
     * Which wedge sits under the needle. The needle points straight up,
     * which is -90° in canvas space, so the wheel's rotation is undone and
     * the angle re-based there before dividing into wedges.
     */
    const wedgeAtNeedle = () => {
      const a = ((-Math.PI / 2 - angle.current) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      return Math.floor(a / seg) % WEDGES.length;
    };

    const settle = () => {
      if (finished.current) return;
      finished.current = true;
      const idx = wedgeAtNeedle();
      const fraction = WEDGES[idx];
      const hits = Math.max(1, Math.round(hitsTarget * fraction));

      winIdx = idx;
      glow = 1;
      shake.add(10);
      const cx = W / 2, cy = H / 2;
      parts.confetti(cx, cy - faceR * 0.2, 90);

      setResultLabel(label(fraction));
      setPhase('done');
      phaseRef.current = 'done';
      onHit?.(hits);
      onFinish(hits, {
        game: 'spin', wedge: idx, fraction, target: hitsTarget,
        seconds: Math.round((performance.now() - startedAt.current) / 1000),
      });
    };

    const frame = (now: number) => {
      if (!running) return;
      const raw = now - last;
      last = now;
      const dt = clamp(raw / 16.667, 0, 3);

      const cx = W / 2, cy = H / 2, R = faceR;
      ctx.clearRect(0, 0, W, H);

      // ---- physics ----
      if (phaseRef.current === 'spinning') {
        velocity.current = Math.min(0.4, velocity.current + 0.011 * dt);
      } else if (phaseRef.current === 'stopping') {
        velocity.current *= Math.pow(0.982, dt);
        velocity.current -= 0.00032 * dt;
        if (velocity.current <= 0.0016) { velocity.current = 0; settle(); }
      }
      angle.current += velocity.current * dt;

      // needle flicks each time a peg goes past
      const pegNow = wedgeAtNeedle();
      if (pegNow !== lastPeg) {
        lastPeg = pegNow;
        pegVel -= Math.min(0.42, velocity.current * 1.5);
      }
      pegVel += -pegAngle * 0.35 * dt;     // spring back to rest
      pegVel *= Math.pow(0.82, dt);        // damping
      pegAngle += pegVel * dt;
      pegAngle = clamp(pegAngle, -0.6, 0.25);

      // ---- soft shadow under the wheel ----
      const sh = ctx.createRadialGradient(cx, cy + R * 0.08, R * 0.5, cx, cy + R * 0.1, R * 1.12);
      sh.addColorStop(0, 'rgba(15,23,42,0.28)');
      sh.addColorStop(1, 'rgba(15,23,42,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, W, H);

      shake.update();
      shake.begin(ctx);

      // ---- the face ----
      if (face) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle.current);
        const s = R * 2 + 8;
        ctx.drawImage(face, -s / 2, -s / 2, s, s);
        ctx.restore();
      }

      // ---- labels: redrawn upright every frame ----
      // Eight fillText calls a frame is nothing, and it buys a wheel whose
      // prizes stay readable at every angle instead of half of them
      // hanging upside down.
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#ffffff';
      WEDGES.forEach((fraction, i) => {
        const mid = i * seg + seg / 2 + angle.current;
        const lx = cx + Math.cos(mid) * R * 0.68;
        const ly = cy + Math.sin(mid) * R * 0.68;
        // Unit above, amount below. Side by side, two labels either side of
        // the vertical axis are only ~0.5R apart and collide; stacking makes
        // each one as narrow as its digits.
        const [unit, amount] = splitLabel(fraction);
        if (unit) {
          ctx.font = `900 ${Math.max(8, R * 0.062)}px "Plus Jakarta Sans", system-ui, sans-serif`;
          ctx.globalAlpha = 0.75;
          ctx.fillText(unit, lx, ly - R * 0.088);
          ctx.globalAlpha = 1;
        }
        ctx.font = `900 ${Math.max(13, R * 0.135)}px "Plus Jakarta Sans", system-ui, sans-serif`;
        ctx.fillText(amount, lx, ly + (unit ? R * 0.032 : 0));
      });
      ctx.restore();

      // ---- motion blur while it is really moving ----
      if (velocity.current > 0.08) {
        const a = clamp((velocity.current - 0.08) / 0.3, 0, 1) * 0.35;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        const mb = ctx.createRadialGradient(cx, cy, R * 0.45, cx, cy, R);
        mb.addColorStop(0, 'rgba(255,255,255,0)');
        mb.addColorStop(1, 'rgba(255,255,255,0.55)');
        ctx.fillStyle = mb;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // ---- winning wedge glow ----
      if (glow > 0 && winIdx >= 0) {
        const a0 = winIdx * seg + angle.current;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = glow * 0.55;
        const wg = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
        wg.addColorStop(0, 'rgba(251,191,36,0)');
        wg.addColorStop(1, 'rgba(251,191,36,0.95)');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a0, a0 + seg);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        glow -= 0.012 * dt;
      }

      // ---- gloss sweep across the top-left ----
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16;
      const gloss = ctx.createLinearGradient(cx - R, cy - R, cx + R * 0.3, cy + R * 0.5);
      gloss.addColorStop(0, 'rgba(255,255,255,0.9)');
      gloss.addColorStop(0.45, 'rgba(255,255,255,0.12)');
      gloss.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gloss;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // ---- hub ----
      const hub = ctx.createRadialGradient(cx - R * 0.05, cy - R * 0.06, R * 0.02, cx, cy, R * 0.19);
      hub.addColorStop(0, '#ffffff');
      hub.addColorStop(0.6, '#e2e8f0');
      hub.addColorStop(1, '#94a3b8');
      ctx.fillStyle = hub;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(15,23,42,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // hub screws
      ctx.fillStyle = '#94a3b8';
      for (let i = 0; i < 4; i++) {
        const a = angle.current + (Math.PI / 2) * i;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * R * 0.11, cy + Math.sin(a) * R * 0.11, R * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#CD5C5C';
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.055, 0, Math.PI * 2); ctx.fill();

      // ---- needle, hinged above the rim ----
      ctx.save();
      ctx.translate(cx, cy - R - 4);
      ctx.rotate(pegAngle);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      const ng = ctx.createLinearGradient(0, -12, 0, 24);
      ng.addColorStop(0, '#fde68a');
      ng.addColorStop(0.5, '#fbbf24');
      ng.addColorStop(1, '#b45309');
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.moveTo(0, 17);
      ctx.lineTo(-8.5, -8);
      ctx.quadraticCurveTo(0, -14, 8.5, -8);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fffbeb';
      ctx.beginPath(); ctx.arc(0, -5, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      if (dt > 0) parts.update(dt);
      parts.draw(ctx);
      shake.end(ctx);

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (phaseRef.current !== 'idle') return;
    startedAt.current = performance.now();
    phaseRef.current = 'spinning';
    setPhase('spinning');
  };

  const stop = () => {
    if (phaseRef.current !== 'spinning') return;
    phaseRef.current = 'stopping';
    setPhase('stopping');
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 shadow-2xl shadow-slate-950/50">
      <canvas ref={canvasRef} className="mx-auto block h-[300px] w-full max-w-[350px] touch-none sm:h-[360px]" />

      <div className="mt-3 flex flex-col items-center gap-2">
        {phase === 'idle' && (
          <Button
            onClick={start}
            className="h-12 w-full max-w-[260px] rounded-xl bg-gradient-to-b from-[#e0716c] to-[#A14A4A] text-xs font-black uppercase tracking-[0.25em] shadow-lg shadow-rose-950/40 transition-transform active:scale-95"
          >
            Spin the wheel
          </Button>
        )}
        {phase === 'spinning' && (
          <Button
            onClick={stop}
            className="h-12 w-full max-w-[260px] animate-pulse rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-xs font-black uppercase tracking-[0.25em] text-slate-900 shadow-lg shadow-amber-900/40 transition-transform active:scale-95"
          >
            Stop it now
          </Button>
        )}
        {phase === 'stopping' && (
          <p className="py-3 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
            Slowing down…
          </p>
        )}
        {phase === 'done' && resultLabel && (
          <p className="py-3 text-center text-sm font-black uppercase tracking-[0.2em] text-amber-300">
            Landed on {resultLabel}
          </p>
        )}
        <p className="text-center text-[10px] font-medium text-slate-500">
          One spin per person. Whatever the needle lands on is your cut.
        </p>
      </div>
    </div>
  );
}
