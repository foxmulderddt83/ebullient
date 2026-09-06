-- =====================================================================
-- Price Slash campaigns  (gamified group discount for agent landing pages)
-- =====================================================================
-- A campaign is a *game with terms*: which mini-game, how much a round is
-- worth, how many players unlock a group drop, and how long the whole
-- thing runs. It does not know where it is used.
--
-- A landing page picks the game it wants via agent_landing_pages
-- .slash_campaign_id, so one challenge can be dropped onto several pages
-- and a page's game can be swapped without touching the campaign.
--
-- The accumulated discount is mirrored onto the campaign's agent_coupons
-- row, so checkout keeps using validate_coupon()/redeem_coupon() exactly
-- as before - no change to the booking flow.
--
--   * slash_campaigns    - the game, its terms and its clock
--   * slash_participants - one row per person per campaign (one round each)
--
-- RLS follows the agent-portal shape: the public may read a live campaign
-- and may only ever write through the SECURITY DEFINER functions, so a
-- visitor cannot declare their own prize. Idempotent - safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Campaigns
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.slash_campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL,
  -- Stated in the agent's own words and shown to every visitor, so the
  -- task is never ambiguous ("Get 10 friends to play and we cut RM 100").
  goal_text         text,
  game_type         text NOT NULL DEFAULT 'slash',

  -- The payload: this coupon's discount_value is rewritten as the
  -- campaign progresses. Where the game is *shown* is the page's choice.
  coupon_id         uuid REFERENCES public.agent_coupons(id) ON DELETE CASCADE,
  package_id        uuid REFERENCES public.packages(id)      ON DELETE SET NULL,

  -- The headline price the game visibly slices. Display only; the money
  -- that actually moves is the coupon's discount_value.
  base_price        numeric NOT NULL DEFAULT 0,

  reward_type       text NOT NULL DEFAULT 'fixed',

  -- "Every N players unlocks reward_per_tier" - the group-buy half.
  players_per_tier  integer NOT NULL DEFAULT 10,
  reward_per_tier   numeric NOT NULL DEFAULT 0,

  -- What one perfect personal round is worth, and how many successful
  -- hits a perfect round takes. A partial round scores pro rata.
  reward_per_player numeric NOT NULL DEFAULT 0,
  hits_target       integer NOT NULL DEFAULT 20,

  -- Hard ceiling on the whole campaign, so a runaway link cannot give
  -- the aircraft away.
  max_reward        numeric NOT NULL DEFAULT 0,

  duration_hours    integer NOT NULL DEFAULT 24,
  starts_at         timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),

  -- Running totals, maintained by slash_play().
  player_count      integer NOT NULL DEFAULT 0,
  tiers_unlocked    integer NOT NULL DEFAULT 0,
  current_reward    numeric NOT NULL DEFAULT 0,

  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.slash_campaigns DROP CONSTRAINT IF EXISTS slash_campaigns_game_type_check;
ALTER TABLE public.slash_campaigns ADD CONSTRAINT slash_campaigns_game_type_check
  CHECK (game_type IN ('slash', 'shoot', 'spin', 'match'));

ALTER TABLE public.slash_campaigns DROP CONSTRAINT IF EXISTS slash_campaigns_reward_type_check;
ALTER TABLE public.slash_campaigns ADD CONSTRAINT slash_campaigns_reward_type_check
  CHECK (reward_type IN ('fixed', 'percent'));

ALTER TABLE public.slash_campaigns DROP CONSTRAINT IF EXISTS slash_campaigns_positive_check;
ALTER TABLE public.slash_campaigns ADD CONSTRAINT slash_campaigns_positive_check
  CHECK (players_per_tier >= 1 AND hits_target >= 1 AND duration_hours >= 1);

CREATE INDEX IF NOT EXISTS slash_campaigns_live_idx  ON public.slash_campaigns (is_active, expires_at);
CREATE INDEX IF NOT EXISTS slash_campaigns_owner_idx ON public.slash_campaigns (created_by, created_at DESC);

-- ---------------------------------------------------------------------
-- 2. Participants - one round per person, enforced by the unique index
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.slash_participants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    uuid NOT NULL REFERENCES public.slash_campaigns(id) ON DELETE CASCADE,
  session_id     text NOT NULL,
  share_link_id  uuid REFERENCES public.agent_share_links(id) ON DELETE SET NULL,
  display_name   text,
  game_type      text,
  hits           integer NOT NULL DEFAULT 0,
  reward_earned  numeric NOT NULL DEFAULT 0,
  -- Which tier number this player completed, when they were the one that
  -- tipped it over. NULL for everyone else.
  tier_unlocked  integer,
  status         text NOT NULL DEFAULT 'completed',
  run_detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  country        text,
  city           text,
  device_type    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- The "ONE person only, then the next person" rule.
CREATE UNIQUE INDEX IF NOT EXISTS slash_participants_session_key
  ON public.slash_participants (campaign_id, session_id);

CREATE INDEX IF NOT EXISTS slash_participants_campaign_idx
  ON public.slash_participants (campaign_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 3. A landing page chooses its game
-- ---------------------------------------------------------------------
ALTER TABLE public.agent_landing_pages
  ADD COLUMN IF NOT EXISTS slash_campaign_id uuid
  REFERENCES public.slash_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS agent_landing_pages_slash_idx
  ON public.agent_landing_pages (slash_campaign_id);

-- Carry over anything created while the campaign owned the association,
-- then retire those columns. Guarded so re-running is harmless.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'slash_campaigns'
      AND column_name = 'landing_page_id'
  ) THEN
    EXECUTE $mig$
      UPDATE public.agent_landing_pages p
      SET slash_campaign_id = s.id
      FROM public.slash_campaigns s
      WHERE s.landing_page_id = p.id AND p.slash_campaign_id IS NULL
    $mig$;

    -- A campaign that was only ever reached through a share link still
    -- lands on whatever page that link points at.
    EXECUTE $mig$
      UPDATE public.agent_landing_pages p
      SET slash_campaign_id = s.id
      FROM public.slash_campaigns s
      JOIN public.agent_share_links l ON l.id = s.share_link_id
      WHERE l.landing_page_id = p.id AND p.slash_campaign_id IS NULL
    $mig$;
  END IF;
END $$;

DROP INDEX IF EXISTS public.slash_campaigns_link_idx;
DROP INDEX IF EXISTS public.slash_campaigns_page_idx;
ALTER TABLE public.slash_campaigns DROP COLUMN IF EXISTS landing_page_id;
ALTER TABLE public.slash_campaigns DROP COLUMN IF EXISTS share_link_id;

-- =====================================================================
-- Row Level Security
-- =====================================================================
ALTER TABLE public.slash_campaigns    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slash_participants ENABLE ROW LEVEL SECURITY;

-- A live campaign is public - it is painted onto a public web page.
DROP POLICY IF EXISTS slash_campaigns_public_read ON public.slash_campaigns;
CREATE POLICY slash_campaigns_public_read ON public.slash_campaigns
  FOR SELECT TO anon, authenticated
  USING (is_active = true AND expires_at > now());

DROP POLICY IF EXISTS slash_campaigns_staff_all ON public.slash_campaigns;
CREATE POLICY slash_campaigns_staff_all ON public.slash_campaigns
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- The ledger holds IP addresses and device hashes, so it is staff-only.
-- Writes only ever happen inside slash_play(), which is SECURITY DEFINER,
-- so there is no public INSERT policy either.
DROP POLICY IF EXISTS slash_participants_public_read ON public.slash_participants;

DROP POLICY IF EXISTS slash_participants_staff_all ON public.slash_participants;
CREATE POLICY slash_participants_staff_all ON public.slash_participants
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- =====================================================================
-- Functions
-- =====================================================================

-- ---------------------------------------------------------------------
-- slash_sync_coupon - push the campaign's accumulated reward onto the
-- coupon it is attached to. This is the only place the money changes, so
-- the booking flow needs no knowledge of campaigns at all.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.slash_sync_coupon(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.slash_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.slash_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND OR c.coupon_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.agent_coupons
  SET discount_type  = c.reward_type,
      discount_value = c.current_reward,
      -- A percentage campaign still respects the campaign ceiling.
      max_discount   = CASE WHEN c.reward_type = 'percent'
                            THEN NULLIF(c.max_reward, 0)
                            ELSE max_discount END,
      -- The coupon must not outlive the countdown the visitor was shown.
      expires_at     = c.expires_at,
      is_active      = c.is_active,
      updated_at     = now()
  WHERE id = c.coupon_id;
END;
$$;

-- =====================================================================
-- Device locking
-- =====================================================================
-- One turn per DEVICE, not per browser tab. The web exposes no hardware
-- id, so this is three independent signals recorded with every round;
-- any one of them matching an earlier round blocks a replay.
--
--   device_token - a random id the browser keeps in four stores at once
--                  (localStorage, IndexedDB, Cache Storage, cookie), so
--                  clearing any one of them is survived.
--   fingerprint  - a hash of properties that stay the same across
--                  browsers on one machine. This is what catches "same
--                  phone, different browser".
--   ip_address   - from Cloudflare's cf-connecting-ip. Verified: a
--                  request arriving with that header already set is
--                  rejected 403, so it cannot be forged. x-forwarded-for
--                  is NOT safe - a client's value is prepended to it, so
--                  only its final element can be trusted.
--
-- A fingerprint is low-entropy by design (high-entropy signals such as
-- canvas differ per browser, which would defeat the point), so it only
-- ever blocks in combination with the IP, and that rule is switchable
-- per campaign.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. What we record about each round
-- ---------------------------------------------------------------------
ALTER TABLE public.slash_participants
  ADD COLUMN IF NOT EXISTS device_token text,
  ADD COLUMN IF NOT EXISTS fingerprint  text,
  ADD COLUMN IF NOT EXISTS ip_address   text;

-- The real "one turn" rule. Partial, so rounds banked before device
-- tokens existed (NULL) do not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS slash_participants_device_key
  ON public.slash_participants (campaign_id, device_token)
  WHERE device_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS slash_participants_fp_idx
  ON public.slash_participants (campaign_id, fingerprint, ip_address);
CREATE INDEX IF NOT EXISTS slash_participants_ip_idx
  ON public.slash_participants (campaign_id, ip_address);

-- ---------------------------------------------------------------------
-- 2. How strict each campaign wants to be
-- ---------------------------------------------------------------------
ALTER TABLE public.slash_campaigns
  -- Blocks a second round from the same hardware on the same network
  -- even in a different browser. Costs the odd false positive: two
  -- identical handsets on one wifi look alike.
  ADD COLUMN IF NOT EXISTS strict_device_lock boolean NOT NULL DEFAULT true,
  -- Backstop for someone who wipes storage AND changes browser. Kept
  -- loose by default because homes, offices and mobile carriers put many
  -- genuine people behind one address. 0 = no cap.
  ADD COLUMN IF NOT EXISTS max_plays_per_ip integer NOT NULL DEFAULT 3;

-- ---------------------------------------------------------------------
-- 3. The caller's real IP
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.slash_client_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h json;
  v text;
  parts text[];
BEGIN
  h := nullif(current_setting('request.headers', true), '')::json;
  IF h IS NULL THEN RETURN NULL; END IF;

  -- Written by Cloudflare's edge. A request that already carries this
  -- header never reaches us, so its value cannot be attacker-supplied.
  v := h->>'cf-connecting-ip';
  IF v IS NOT NULL AND btrim(v) <> '' THEN RETURN btrim(v); END IF;

  -- Only the final element of x-forwarded-for was appended by the trusted
  -- proxy; everything before it may have come from the client.
  v := h->>'x-forwarded-for';
  IF v IS NOT NULL AND btrim(v) <> '' THEN
    parts := string_to_array(v, ',');
    RETURN btrim(parts[array_length(parts, 1)]);
  END IF;

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Shared verdict, so the panel and the play call never disagree
--
-- Returning the reason (rather than a bare boolean) lets the page say
-- "this device already played" instead of offering a round it is about
-- to refuse.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.slash_block_reason(
  p_campaign_id   uuid,
  p_session_id    text,
  p_device_token  text,
  p_fingerprint   text,
  p_ip            text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c       public.slash_campaigns%ROWTYPE;
  v_token text := nullif(btrim(coalesce(p_device_token, '')), '');
  v_fp    text := nullif(btrim(coalesce(p_fingerprint, '')), '');
  v_ip    text := nullif(btrim(coalesce(p_ip, '')), '');
  v_count integer;
BEGIN
  SELECT * INTO c FROM public.slash_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  -- This exact device, however many browsers or tabs it has open.
  IF v_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.slash_participants
    WHERE campaign_id = p_campaign_id AND device_token = v_token
  ) THEN
    RETURN 'already_played';
  END IF;

  -- Backstop for a browser that blocks every storage API we use.
  IF p_session_id IS NOT NULL AND btrim(p_session_id) <> '' AND EXISTS (
    SELECT 1 FROM public.slash_participants
    WHERE campaign_id = p_campaign_id AND session_id = p_session_id
  ) THEN
    RETURN 'already_played';
  END IF;

  -- Same hardware, same network, different browser.
  IF c.strict_device_lock AND v_fp IS NOT NULL AND v_ip IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.slash_participants
    WHERE campaign_id = p_campaign_id AND fingerprint = v_fp AND ip_address = v_ip
  ) THEN
    RETURN 'same_device';
  END IF;

  -- Everything wiped and a different browser opened: fall back to a cap
  -- on how many rounds one address may bank.
  IF c.max_plays_per_ip > 0 AND v_ip IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.slash_participants
    WHERE campaign_id = p_campaign_id AND ip_address = v_ip;
    IF v_count >= c.max_plays_per_ip THEN
      RETURN 'ip_limit';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. slash_state - now device-aware, so the panel knows before it offers
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.slash_state(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.slash_state(
  p_campaign_id     uuid DEFAULT NULL,
  p_landing_page_id uuid DEFAULT NULL,
  p_token           text DEFAULT NULL,
  p_session_id      text DEFAULT NULL,
  p_device_token    text DEFAULT NULL,
  p_fingerprint     text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    'package_id',        c.package_id,
    'base_price',        c.base_price,
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
$$;

-- ---------------------------------------------------------------------
-- 6. slash_play - enforces the same verdict, and records the signals
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.slash_play(uuid, text, integer, jsonb, text, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.slash_play(
  p_campaign_id   uuid,
  p_session_id    text,
  p_hits          integer,
  p_detail        jsonb   DEFAULT '{}'::jsonb,
  p_name          text    DEFAULT NULL,
  p_country       text    DEFAULT NULL,
  p_city          text    DEFAULT NULL,
  p_device_type   text    DEFAULT NULL,
  p_share_link_id uuid    DEFAULT NULL,
  p_device_token  text    DEFAULT NULL,
  p_fingerprint   text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c           public.slash_campaigns%ROWTYPE;
  v_hits      integer;
  v_reward    numeric;
  v_players   integer;
  v_tiers     integer;
  v_total     numeric;
  v_tier_hit  integer;
  v_ip        text;
  v_block     text;
BEGIN
  IF p_session_id IS NULL OR btrim(p_session_id) = '' THEN
    RETURN json_build_object('ok', false, 'reason', 'no_session',
      'message', 'Could not identify this player.');
  END IF;

  -- Lock the campaign row: two players finishing at the same instant must
  -- not both be counted as the one who tipped a tier over, and the device
  -- checks below have to be serialised against each other too.
  SELECT * INTO c FROM public.slash_campaigns WHERE id = p_campaign_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found',
      'message', 'This challenge no longer exists.');
  END IF;

  IF NOT c.is_active THEN
    RETURN json_build_object('ok', false, 'reason', 'inactive',
      'message', 'This challenge has been closed.');
  END IF;

  IF c.expires_at <= now() THEN
    RETURN json_build_object('ok', false, 'reason', 'expired',
      'message', 'Time is up - this challenge has ended.');
  END IF;

  -- The IP is read here, never accepted from the caller.
  v_ip    := public.slash_client_ip();
  v_block := public.slash_block_reason(c.id, p_session_id, p_device_token, p_fingerprint, v_ip);

  IF v_block = 'already_played' THEN
    RETURN json_build_object('ok', false, 'reason', 'already_played',
      'message', 'This device has already taken its turn. Pass the link to someone else.');
  ELSIF v_block = 'same_device' THEN
    RETURN json_build_object('ok', false, 'reason', 'same_device',
      'message', 'This device has already played, even in another browser. Pass the link to someone else.');
  ELSIF v_block = 'ip_limit' THEN
    RETURN json_build_object('ok', false, 'reason', 'ip_limit',
      'message', 'This network has used up its turns. Try from a different connection.');
  ELSIF v_block IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'reason', v_block,
      'message', 'You cannot play this round.');
  END IF;

  v_hits   := LEAST(GREATEST(coalesce(p_hits, 0), 0), c.hits_target);
  v_reward := round(c.reward_per_player * v_hits::numeric / c.hits_target::numeric, 2);

  v_players := c.player_count + 1;
  v_tiers   := v_players / c.players_per_tier;
  v_tier_hit := CASE WHEN v_tiers > c.tiers_unlocked THEN v_tiers ELSE NULL END;

  INSERT INTO public.slash_participants (
    campaign_id, session_id, share_link_id, display_name, game_type,
    hits, reward_earned, tier_unlocked, status, run_detail,
    country, city, device_type, device_token, fingerprint, ip_address
  ) VALUES (
    c.id, p_session_id, p_share_link_id, nullif(btrim(coalesce(p_name, '')), ''), c.game_type,
    v_hits, v_reward, v_tier_hit, 'completed', coalesce(p_detail, '{}'::jsonb),
    p_country, p_city, p_device_type,
    nullif(btrim(coalesce(p_device_token, '')), ''),
    nullif(btrim(coalesce(p_fingerprint, '')), ''),
    v_ip
  );

  SELECT coalesce(sum(reward_earned), 0) INTO v_total
  FROM public.slash_participants WHERE campaign_id = c.id;

  v_total := v_total + (v_tiers * c.reward_per_tier);

  IF c.max_reward > 0 AND v_total > c.max_reward THEN
    v_total := c.max_reward;
  END IF;
  IF c.reward_type = 'percent' AND v_total > 100 THEN
    v_total := 100;
  END IF;

  UPDATE public.slash_campaigns
  SET player_count   = v_players,
      tiers_unlocked = v_tiers,
      current_reward = v_total,
      updated_at     = now()
  WHERE id = c.id;

  PERFORM public.slash_sync_coupon(c.id);

  RETURN json_build_object(
    'ok',             true,
    'hits',           v_hits,
    'reward_earned',  v_reward,
    'tier_unlocked',  v_tier_hit,
    'player_count',   v_players,
    'current_reward', v_total,
    'message',        'Your slice has been banked.'
  );

EXCEPTION
  -- The unique index is the final word if two rounds from one device race
  -- each other past the checks above.
  WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'reason', 'already_played',
      'message', 'This device has already taken its turn.');
END;
$$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.slash_client_ip() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.slash_block_reason(uuid, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.slash_state(uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.slash_play(uuid, text, integer, jsonb, text, text, text, text, uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.slash_state(uuid, uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.slash_play(uuid, text, integer, jsonb, text, text, text, text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.slash_client_ip() TO authenticated;
GRANT EXECUTE ON FUNCTION public.slash_block_reason(uuid, text, text, text, text) TO authenticated;
