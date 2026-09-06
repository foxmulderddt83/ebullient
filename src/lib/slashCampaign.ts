import { supabase } from './supabase';
import { getSessionId, getGeo, readShareContext, SHARE_REF_PARAM } from './agentTracking';
import { getDeviceIdentity } from './deviceIdentity';

/**
 * Client side of the "price slash" campaigns.
 *
 * The browser is deliberately dumb here: it reports how many hits a round
 * landed, plus the two device signals from ./deviceIdentity. slash_play()
 * in Postgres owns the arithmetic, the one-turn-per-device rule and the
 * campaign ceiling, and reads the caller's IP from Cloudflare itself - so
 * a player editing their console can at best claim a perfect round they
 * did not earn, never a prize the campaign was not offering or a second
 * turn on a device that has already had one.
 */

export type SlashGameType = 'slash' | 'shoot' | 'spin' | 'match';

export const GAME_LABELS: Record<SlashGameType, string> = {
  slash: 'Sky Slash',
  shoot: 'Sky Shooter',
  spin: 'Lucky Spin',
  match: "King's Escape",
};

export const GAME_BLURBS: Record<SlashGameType, string> = {
  slash: 'Aircraft fly across the screen — swipe to slash them and cut the price with every hit.',
  shoot: 'Targets dive from the top of the screen — tap to shoot them down before they escape.',
  spin: 'One spin of the wheel. Hit STOP and the price drops by whatever it lands on.',
  match: 'Match three to collapse the rubble and keep the king out of the dragon’s reach.',
};

export interface SlashState {
  found: boolean;
  id: string;
  title: string;
  goal_text: string | null;
  game_type: SlashGameType;
  /** The package whose asking price this campaign is cutting. */
  package_id: string | null;
  base_price: number;
  reward_type: 'fixed' | 'percent';
  players_per_tier: number;
  reward_per_tier: number;
  reward_per_player: number;
  hits_target: number;
  max_reward: number;
  player_count: number;
  tiers_unlocked: number;
  current_reward: number;
  players_to_next: number;
  expires_at: string;
  seconds_left: number;
  coupon_code: string | null;
  has_played: boolean;
  /** Why this device may not play: already_played | same_device | ip_limit */
  block_reason: 'already_played' | 'same_device' | 'ip_limit' | null;
  my_hits: number;
  my_reward: number;
}

export interface SlashPlayResult {
  ok: boolean;
  reason?: string;
  message: string;
  hits?: number;
  reward_earned?: number;
  tier_unlocked?: number | null;
  player_count?: number;
  current_reward?: number;
}

/** Coerces the json the RPC returns into numbers the UI can do maths on. */
const normalise = (raw: any): SlashState | null => {
  if (!raw || raw.found !== true) return null;
  return {
    ...raw,
    base_price: Number(raw.base_price || 0),
    reward_per_tier: Number(raw.reward_per_tier || 0),
    reward_per_player: Number(raw.reward_per_player || 0),
    max_reward: Number(raw.max_reward || 0),
    current_reward: Number(raw.current_reward || 0),
    my_reward: Number(raw.my_reward || 0),
    seconds_left: Number(raw.seconds_left || 0),
  } as SlashState;
};

/**
 * Finds the campaign attached to this page or share link, if any.
 * Returns null whenever there is nothing live to show, which is the
 * normal case for most pages.
 */
export const fetchSlashState = async (
  opts: { campaignId?: string | null; landingPageId?: string | null } = {},
): Promise<SlashState | null> => {
  if (!supabase) return null;
  try {
    // The session context is written by resolveShareLink(), which may not
    // have finished yet on a cold load - so fall back to the token still
    // sitting on the URL. A campaign attached only to a share link would
    // otherwise fail to appear on the visitor's first paint.
    const ctx = readShareContext();
    const token = ctx.token
      || new URLSearchParams(window.location.search).get(SHARE_REF_PARAM);

    // Resolved before asking, so a device that has already played is told
    // so rather than being offered a round the server will refuse.
    const device = await getDeviceIdentity();

    const { data, error } = await supabase.rpc('slash_state', {
      p_campaign_id: opts.campaignId ?? null,
      p_landing_page_id: opts.landingPageId ?? null,
      p_token: token ?? null,
      p_session_id: getSessionId(),
      p_device_token: device.deviceToken,
      p_fingerprint: device.fingerprint,
    });
    if (error) throw error;
    return normalise(data);
  } catch (e) {
    console.warn('[slash] state failed', e);
    return null;
  }
};

/**
 * Banks a finished round. `hits` is clamped server-side to the campaign's
 * hits_target, so passing a wild number simply scores a perfect round.
 */
export const submitSlashRound = async (
  campaignId: string,
  hits: number,
  detail: Record<string, unknown> = {},
): Promise<SlashPlayResult> => {
  if (!supabase) return { ok: false, message: 'Offline — try again in a moment.' };
  try {
    const geo = await getGeo();
    const ctx = readShareContext();
    const device = await getDeviceIdentity();
    const { data, error } = await supabase.rpc('slash_play', {
      p_campaign_id: campaignId,
      p_session_id: getSessionId(),
      p_hits: Math.max(0, Math.round(hits)),
      p_detail: detail,
      p_name: null,
      p_country: geo.country_name || null,
      p_city: geo.city || null,
      p_device_type: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      // The campaign no longer knows where it is played; the visitor does.
      p_share_link_id: ctx.shareLinkId ?? null,
      // The IP is NOT sent - the server reads it from Cloudflare, because
      // anything the browser says about itself is a suggestion.
      p_device_token: device.deviceToken,
      p_fingerprint: device.fingerprint,
    });
    if (error) throw error;
    return data as SlashPlayResult;
  } catch (e: any) {
    console.warn('[slash] play failed', e);
    return { ok: false, message: e?.message || 'Could not save your round.' };
  }
};

/** "3h 42m 10s" - the countdown every link has to display. */
export const formatCountdown = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
};

/** How the reward reads on screen, in the campaign's own unit. */
export const formatReward = (value: number, type: 'fixed' | 'percent'): string =>
  type === 'percent' ? `${Number(value).toFixed(0)}%` : `RM ${Number(value).toFixed(2)}`;

/** The price after the campaign's accumulated cut - what the panel counts down to. */
export const priceAfterReward = (base: number, reward: number, type: 'fixed' | 'percent'): number => {
  const cut = type === 'percent' ? base * (reward / 100) : reward;
  return Math.max(0, base - cut);
};
