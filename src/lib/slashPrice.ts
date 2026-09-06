import { useEffect, useState } from 'react';
import { fetchSlashState, priceAfterReward } from './slashCampaign';
import { readShareContext } from './agentTracking';

/**
 * What a running price-slash campaign does to a package's price.
 *
 * The campaign sets the price outright — there is no coupon behind it and
 * nothing for a customer to type. The card, the cart, the checkout summary
 * and the amount charged are all the same number, and that number is
 * base price minus the cut the group has won.
 *
 * The cut itself is never computed here: it comes from slash_state, which
 * Postgres owns and which only slash_play() can move. So the browser can
 * choose to display a campaign price, but it cannot invent one — the most
 * it can claim is the discount the server already agrees exists.
 */
export interface SlashPrice {
  packageId: string;
  reward: number;
  rewardType: 'fixed' | 'percent';
}

/** Fired by SlashGamePanel once a round banks, so open prices re-read. */
export const SLASH_UPDATED_EVENT = 'slash:updated';

/**
 * One-shot read, for the code paths that cannot use a hook — chiefly the
 * price re-check on submit.
 *
 * Returns null unless a campaign is live AND has actually cut something:
 * a campaign nobody has played has not changed any price yet.
 */
export const fetchSlashPrice = async (): Promise<SlashPrice | null> => {
  const ctx = readShareContext();
  // No share context means no campaign can be attached to this visit, and
  // the RPC would only be answering "found: false".
  if (!ctx.landingPageId && !ctx.token) return null;

  const s = await fetchSlashState({ landingPageId: ctx.landingPageId ?? null });
  return s && s.package_id && s.current_reward > 0
    ? { packageId: s.package_id, reward: s.current_reward, rewardType: s.reward_type }
    : null;
};

/** The live campaign for this visit, kept current as rounds are played. */
export const useSlashPrice = (): SlashPrice | null => {
  const [slash, setSlash] = useState<SlashPrice | null>(null);

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      const next = await fetchSlashPrice();
      if (!cancelled) setSlash(next);
    };

    read();
    window.addEventListener(SLASH_UPDATED_EVENT, read);
    return () => {
      cancelled = true;
      window.removeEventListener(SLASH_UPDATED_EVENT, read);
    };
  }, []);

  return slash;
};

/** The campaign price for one package, or null when it isn't the target. */
export const slashedPrice = (
  slash: SlashPrice | null,
  packageId: string,
  price: number,
): number | null => (
  slash && slash.packageId === packageId
    ? priceAfterReward(price, slash.reward, slash.rewardType)
    : null
);
