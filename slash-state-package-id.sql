-- Adds package_id to slash_state(), so the package cards know which
-- package a running campaign is re-pricing. Display only: the cart and
-- the checkout price check still use the real price, and the discount is
-- collected by the campaign's own coupon.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.slash_state(p_campaign_id uuid DEFAULT NULL::uuid, p_landing_page_id uuid DEFAULT NULL::uuid, p_token text DEFAULT NULL::text, p_session_id text DEFAULT NULL::text, p_device_token text DEFAULT NULL::text, p_fingerprint text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c          public.slash_campaigns%ROWTYPE;
  v_page_id  uuid := p_landing_page_id;
  v_camp_id  uuid := p_campaign_id;
  v_played   public.slash_participants%ROWTYPE;
  v_to_next  integer;
  v_coupon   text;
  v_ip       text;
  v_block    text;
BEGIN
  IF v_page_id IS NULL AND p_token IS NOT NULL AND btrim(p_token) <> '' THEN
    SELECT l.landing_page_id INTO v_page_id
    FROM public.agent_share_links l
    WHERE lower(l.token) = lower(btrim(p_token));
  END IF;

  IF v_camp_id IS NULL AND v_page_id IS NOT NULL THEN
    SELECT p.slash_campaign_id INTO v_camp_id
    FROM public.agent_landing_pages p
    WHERE p.id = v_page_id;
  END IF;

  IF v_camp_id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT * INTO c
  FROM public.slash_campaigns s
  WHERE s.id = v_camp_id
    AND s.is_active = true
    AND s.expires_at > now()
    AND s.starts_at <= now();

  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  v_ip    := public.slash_client_ip();
  v_block := public.slash_block_reason(c.id, p_session_id, p_device_token, p_fingerprint, v_ip);

  -- Whichever signal matched, show this visitor their own round if we can
  -- find it, so the panel can print what they actually won.
  SELECT * INTO v_played FROM public.slash_participants
  WHERE campaign_id = c.id
    AND (
      (p_device_token IS NOT NULL AND device_token = btrim(p_device_token))
      OR (p_session_id IS NOT NULL AND session_id = p_session_id)
      OR (p_fingerprint IS NOT NULL AND v_ip IS NOT NULL
          AND fingerprint = btrim(p_fingerprint) AND ip_address = v_ip)
    )
  ORDER BY created_at DESC
  LIMIT 1;

  v_to_next := c.players_per_tier - (c.player_count % c.players_per_tier);
  IF v_to_next = 0 THEN v_to_next := c.players_per_tier; END IF;

  IF c.coupon_id IS NOT NULL AND c.current_reward > 0 THEN
    SELECT code INTO v_coupon FROM public.agent_coupons
    WHERE id = c.coupon_id AND is_active = true
      AND (expires_at IS NULL OR expires_at > now());
  END IF;

  RETURN json_build_object(
    'found',             true,
    'id',                c.id,
    'title',             c.title,
    'goal_text',         c.goal_text,
    'game_type',         c.game_type,
    'base_price',        c.base_price,
    'package_id',        c.package_id,
    'reward_type',       c.reward_type,
    'players_per_tier',  c.players_per_tier,
    'reward_per_tier',   c.reward_per_tier,
    'reward_per_player', c.reward_per_player,
    'hits_target',       c.hits_target,
    'max_reward',        c.max_reward,
    'player_count',      c.player_count,
    'tiers_unlocked',    c.tiers_unlocked,
    'current_reward',    c.current_reward,
    'players_to_next',   v_to_next,
    'expires_at',        c.expires_at,
    'seconds_left',      GREATEST(0, floor(extract(epoch FROM (c.expires_at - now()))))::bigint,
    'coupon_code',       v_coupon,
    'has_played',        (v_block IS NOT NULL),
    'block_reason',      v_block,
    'my_hits',           coalesce(v_played.hits, 0),
    'my_reward',         coalesce(v_played.reward_earned, 0)
  );
END;
$function$
