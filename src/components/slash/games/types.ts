/**
 * The contract every slash mini-game honours.
 *
 * A game reports hits and nothing else — the reward those hits are worth
 * is decided by slash_play() in Postgres, so games stay purely cosmetic
 * and can be swapped or added without touching the money path.
 */
export interface GameProps {
  /** Hits that constitute a perfect round. Reaching it ends the round. */
  hitsTarget: number;
  /** Called once, when the round is over for any reason. */
  onFinish: (hits: number, detail: Record<string, unknown>) => void;
  /** Fired on each successful hit so the price panel can tick down live. */
  onHit?: (hits: number) => void;
  /**
   * What a perfect round is worth. Only games that have to print prize
   * amounts on themselves (the wheel) need these; the value shown is
   * still indicative — Postgres has the last word on what is banked.
   */
  rewardPerPlayer?: number;
  rewardType?: 'fixed' | 'percent';
}
