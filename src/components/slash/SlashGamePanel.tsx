import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Timer, Users, Zap, Trophy, Share2, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchSlashState, submitSlashRound, formatCountdown, formatReward, priceAfterReward,
  GAME_LABELS, type SlashState,
} from '@/lib/slashCampaign';
import { SLASH_UPDATED_EVENT } from '@/lib/slashPrice';
import { AircraftSlashGame } from './games/AircraftSlashGame';
import { SkyShooterGame } from './games/SkyShooterGame';
import { LuckySpinGame } from './games/LuckySpinGame';
import { KingsEscapeGame } from './games/KingsEscapeGame';

/**
 * The visitor-facing half of a price-slash campaign: the goal, the clock,
 * the group progress bar and the one round of the game this person gets.
 *
 * Renders nothing at all when the page has no live campaign, so it is safe
 * to mount unconditionally on every agent landing page.
 */

interface Props {
  landingPageId?: string | null;
  campaignId?: string | null;
}

type Stage = 'intro' | 'playing' | 'result';

export function SlashGamePanel({ landingPageId = null, campaignId = null }: Props) {
  const [state, setState] = useState<SlashState | null>(null);
  const [stage, setStage] = useState<Stage>('intro');
  const [seconds, setSeconds] = useState(0);
  const [liveHits, setLiveHits] = useState(0);
  const [banked, setBanked] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const s = await fetchSlashState({ landingPageId, campaignId });
    setState(s);
    if (s) setSeconds(s.seconds_left);
  }, [landingPageId, campaignId]);

  useEffect(() => { load(); }, [load]);

  // One interval for the whole panel — the countdown has to keep running
  // while a game is on screen, so it cannot live inside the game.
  useEffect(() => {
    if (!state) return;
    const id = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [state]);


  const handleFinish = async (hits: number, detail: Record<string, unknown>) => {
    if (!state || submitting) return;
    setSubmitting(true);
    const res = await submitSlashRound(state.id, hits, detail);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.message);
      setStage('intro');
      await load();
      return;
    }

    setBanked(res.reward_earned ?? 0);
    setStage('result');
    // The package cards on this page are still showing the old price until
    // they are told otherwise.
    window.dispatchEvent(new Event(SLASH_UPDATED_EVENT));
    if (res.tier_unlocked) {
      toast.success(`Target reached — a bonus ${formatReward(state.reward_per_tier, state.reward_type)} came off for everyone.`);
    }
    await load();
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: state?.title || 'Help me cut this price', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      toast.success('Link copied — send it to a friend.');
    } catch {
      /* the visitor dismissed the share sheet */
    }
  };

  if (!state) return null;

  const expired = seconds <= 0;
  const currentPrice = priceAfterReward(state.base_price, state.current_reward, state.reward_type);

  // While a round is in flight the panel previews what this player has
  // shaved so far, so the price visibly falls with every hit.
  const previewReward = state.reward_per_player * (Math.min(liveHits, state.hits_target) / state.hits_target);
  const livePrice = stage === 'playing'
    ? priceAfterReward(state.base_price, state.current_reward + previewReward, state.reward_type)
    : currentPrice;

  const tierPct = ((state.players_per_tier - state.players_to_next) / state.players_per_tier) * 100;

  return (
    <section id="slash-challenge" className="scroll-mt-20 bg-slate-950 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">

        {/* ---------- headline + clock ---------- */}
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#CD5C5C]">
            {GAME_LABELS[state.game_type]} Challenge
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
            {state.title}
          </h2>
          {state.goal_text && (
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-300">
              {state.goal_text}
            </p>
          )}
        </div>

        {/* ---------- the price being sliced ---------- */}
        <div className="mt-7 rounded-3xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur-sm sm:p-7">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Price right now
          </p>
          <div className="mt-2 flex items-baseline justify-center gap-3">
            {state.base_price > 0 && state.current_reward > 0 && (
              <span className="text-lg font-bold text-slate-500 line-through sm:text-2xl">
                RM {state.base_price.toFixed(2)}
              </span>
            )}
            <span className="text-4xl font-black tabular-nums text-white sm:text-6xl">
              RM {livePrice.toFixed(2)}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-emerald-400">
            {formatReward(state.current_reward, state.reward_type)} cut so far
            {state.max_reward > 0 && ` · up to ${formatReward(state.max_reward, state.reward_type)}`}
          </p>
        </div>

        {/* ---------- clock / players / next target ---------- */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat
            icon={<Timer className="h-3.5 w-3.5" />}
            label="Time left"
            value={expired ? 'Ended' : formatCountdown(seconds)}
            tone={expired ? 'text-rose-400' : 'text-white'}
          />
          <Stat
            icon={<Users className="h-3.5 w-3.5" />}
            label="Players"
            value={String(state.player_count)}
          />
          <Stat
            icon={<Trophy className="h-3.5 w-3.5" />}
            label="To next drop"
            value={String(state.players_to_next)}
          />
        </div>

        {/* ---------- the goal, stated plainly ---------- */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
              Next {state.players_to_next} player{state.players_to_next === 1 ? '' : 's'} unlock
              {state.players_to_next === 1 ? 's' : ''} {formatReward(state.reward_per_tier, state.reward_type)} off
            </p>
            <span className="shrink-0 text-[11px] font-black tabular-nums text-[#CD5C5C]">
              {state.player_count % state.players_per_tier}/{state.players_per_tier}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#CD5C5C] to-amber-400 transition-[width] duration-500"
              style={{ width: `${Math.max(4, tierPct)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Every <strong className="text-slate-200">{state.players_per_tier}</strong> people who play cut
            a further <strong className="text-slate-200">{formatReward(state.reward_per_tier, state.reward_type)}</strong> off
            for everyone. Your own round is worth up to{' '}
            <strong className="text-slate-200">{formatReward(state.reward_per_player, state.reward_type)}</strong> on top.
            Everything stops when the clock runs out.
          </p>
        </div>

        {/* ---------- the round ---------- */}
        <div className="mt-5">
          {expired ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm font-bold uppercase tracking-widest text-slate-400">
              This challenge has ended
            </p>
          ) : stage === 'playing' ? (
            <>
              {state.game_type === 'slash' && (
                <AircraftSlashGame hitsTarget={state.hits_target} onHit={setLiveHits} onFinish={handleFinish} />
              )}
              {state.game_type === 'shoot' && (
                <SkyShooterGame hitsTarget={state.hits_target} onHit={setLiveHits} onFinish={handleFinish} />
              )}
              {state.game_type === 'match' && (
                <KingsEscapeGame hitsTarget={state.hits_target} onHit={setLiveHits} onFinish={handleFinish} />
              )}
              {state.game_type === 'spin' && (
                <LuckySpinGame
                  hitsTarget={state.hits_target}
                  rewardPerPlayer={state.reward_per_player}
                  rewardType={state.reward_type}
                  onHit={setLiveHits}
                  onFinish={handleFinish}
                />
              )}
              {submitting && (
                <p className="mt-3 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Banking your slice…
                </p>
              )}
            </>
          ) : stage === 'result' ? (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6 text-center">
              <Zap className="mx-auto h-7 w-7 text-emerald-400" />
              <p className="mt-2 text-lg font-black uppercase tracking-tight text-white">
                You cut {formatReward(banked ?? 0, state.reward_type)}
              </p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                Total off now {formatReward(state.current_reward, state.reward_type)}
              </p>
              <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-slate-300">
                That is your one turn. Send this link on — every extra person who plays
                pushes the price down further, and the discount is waiting at checkout.
              </p>
              <Button onClick={share} className="mt-4 h-11 rounded-xl bg-white px-6 text-xs font-black uppercase tracking-[0.2em] text-slate-900 hover:bg-slate-100">
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
                {copied ? 'Link copied' : 'Share the link'}
              </Button>
            </div>
          ) : state.has_played ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <p className="text-sm font-black uppercase tracking-tight text-white">
                {state.block_reason === 'ip_limit'
                  ? 'This network has used its turns'
                  : 'This device has already played'}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-400">
                {state.block_reason === 'ip_limit'
                  ? 'Everyone on this connection has taken their turn. Someone on a different network can still play.'
                  : state.block_reason === 'same_device'
                    ? 'One round per device — switching browser does not get you another. Pass the link to someone else.'
                    : 'One round per device. Share the link and the next player picks up where you left off.'}
              </p>
              <Button onClick={share} className="mt-4 h-11 rounded-xl bg-white px-6 text-xs font-black uppercase tracking-[0.2em] text-slate-900 hover:bg-slate-100">
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
                {copied ? 'Link copied' : 'Share the link'}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => { setLiveHits(0); setStage('playing'); }}
              className="h-14 w-full rounded-2xl bg-[#CD5C5C] text-sm font-black uppercase tracking-[0.25em] text-white shadow-[0_10px_30px_rgba(205,92,92,0.35)] hover:bg-[#A14A4A]"
            >
              Play {GAME_LABELS[state.game_type]}
            </Button>
          )}
        </div>

        {state.current_reward > 0 && (
          <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400">
            This is the price on the package — no code needed
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({ icon, label, value, tone = 'text-white' }: {
  icon: React.ReactNode; label: string; value: string; tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 text-slate-400">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className={`mt-1 text-sm font-black tabular-nums sm:text-lg ${tone}`}>{value}</p>
    </div>
  );
}
