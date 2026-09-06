-- ---------------------------------------------------------------------
-- A landing page carries a coupon just as a share link does.
--
-- validate_coupon decided whether a code was live by counting the share
-- links pointing at it. That predates "Coupon this page runs": a page is
-- now a carrier in its own right, and a coupon can be attached to one
-- without any link existing.
--
-- The old logic failed in both directions. A coupon carried only by a
-- page fell through to the no-carrier branch, which is right by accident;
-- but a coupon whose one share link had expired was refused at checkout
-- even while a published page was still selling it - "This coupon is no
-- longer being offered", on a page whose own editor says it runs that
-- coupon.
--
-- Pages have no schedule of their own: a page is live when it is
-- published. So where a page is the only live carrier, the coupon's own
-- starts_at/expires_at are the window - without that check a published
-- page would keep honouring a coupon years after it expired. Link
-- scheduling is untouched.
-- ---------------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code        text,
  p_package_ids uuid[]  DEFAULT '{}'::uuid[],
  p_subtotal    numeric DEFAULT 0,
  p_email       text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_coupon      public.agent_coupons%ROWTYPE;
  v_discount    numeric := 0;
  v_used        integer := 0;
  v_matches     boolean;
  v_links_total integer := 0;
  v_links_live  integer := 0;
  v_pages_live  integer := 0;
  v_starts      timestamptz;
  v_ends        timestamptz;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN json_build_object('valid', false, 'reason', 'empty', 'message', 'Enter a coupon code.');
  END IF;

  SELECT * INTO v_coupon
  FROM public.agent_coupons
  WHERE upper(code) = upper(btrim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'reason', 'not_found', 'message', 'This coupon code is not valid.');
  END IF;

  IF NOT v_coupon.is_active THEN
    RETURN json_build_object('valid', false, 'reason', 'inactive', 'message', 'This coupon is no longer active.');
  END IF;

  -- The campaign window lives on the share links that carry this coupon.
  -- A published landing page carries it too - see below.
  SELECT count(*),
         count(*) FILTER (
           WHERE l.is_active
             AND (l.starts_at  IS NULL OR l.starts_at  <= now())
             AND (l.expires_at IS NULL OR l.expires_at >  now())
         ),
         min(l.starts_at) FILTER (WHERE l.starts_at > now()),
         max(l.expires_at)
    INTO v_links_total, v_links_live, v_starts, v_ends
  FROM public.agent_share_links l
  WHERE l.coupon_id = v_coupon.id;

  -- A page carries a coupon the same way a link does, and has no schedule
  -- of its own: it is live once published. Only published pages count -
  -- a draft is not offering anything to anybody, so it must not make a
  -- coupon look carried. Were it counted, a page still being written
  -- would put its own coupon into the "carried but nothing live" branch
  -- and have it refused, including in its own ?preview=1.
  SELECT count(*)
    INTO v_pages_live
  FROM public.agent_landing_pages g
  WHERE g.coupon_id = v_coupon.id AND g.is_published;

  IF v_links_total > 0 OR v_pages_live > 0 THEN
    -- Tied to a campaign: the code is only good while something carrying it runs.
    IF v_links_live = 0 AND v_pages_live = 0 THEN
      IF v_starts IS NOT NULL THEN
        RETURN json_build_object(
          'valid', false, 'reason', 'not_started',
          'message', 'This coupon is not active yet. It starts on ' ||
                     to_char(v_starts AT TIME ZONE 'Asia/Kuala_Lumpur', 'DD Mon YYYY HH12:MI AM') || '.'
        );
      END IF;
      IF v_ends IS NOT NULL THEN
        RETURN json_build_object(
          'valid', false, 'reason', 'expired',
          'message', 'This coupon expired on ' ||
                     to_char(v_ends AT TIME ZONE 'Asia/Kuala_Lumpur', 'DD Mon YYYY HH12:MI AM') || '.'
        );
      END IF;
      RETURN json_build_object('valid', false, 'reason', 'inactive',
        'message', 'This coupon is no longer being offered.');
    END IF;

    -- Held up only by a published page, which carries no dates of its own:
    -- the coupon's window is the only one there is to honour. Without this
    -- a published page would go on applying a coupon long after it expired.
    IF v_links_live = 0 AND v_pages_live > 0 THEN
      IF v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > now() THEN
        RETURN json_build_object('valid', false, 'reason', 'not_started',
          'message', 'This coupon is not active yet.');
      END IF;
      IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN
        RETURN json_build_object('valid', false, 'reason', 'expired',
          'message', 'This coupon has expired.');
      END IF;
      v_ends := v_coupon.expires_at;
    END IF;
  ELSE
    -- Nothing carries it: fall back to whatever window sits on the coupon.
    IF v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > now() THEN
      RETURN json_build_object('valid', false, 'reason', 'not_started',
        'message', 'This coupon is not active yet.');
    END IF;
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN
      RETURN json_build_object('valid', false, 'reason', 'expired',
        'message', 'This coupon has expired.');
    END IF;
    v_ends := v_coupon.expires_at;
  END IF;

  SELECT count(*) INTO v_used
  FROM public.coupon_redemptions
  WHERE coupon_id = v_coupon.id AND status = 'applied';

  IF v_coupon.max_uses > 0 AND v_used >= v_coupon.max_uses THEN
    RETURN json_build_object('valid', false, 'reason', 'used_up',
      'message', 'This coupon has already been used.');
  END IF;

  IF v_coupon.once_per_customer AND p_email IS NOT NULL AND btrim(p_email) <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.coupon_redemptions
      WHERE coupon_id = v_coupon.id
        AND status = 'applied'
        AND lower(customer_email) = lower(btrim(p_email))
    ) THEN
      RETURN json_build_object('valid', false, 'reason', 'already_used_by_customer',
        'message', 'You have already used this coupon.');
    END IF;
  END IF;

  IF array_length(v_coupon.package_ids, 1) IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM unnest(p_package_ids) pid WHERE pid = ANY (v_coupon.package_ids)
    ) INTO v_matches;

    IF NOT v_matches AND array_length(v_coupon.category_ids, 1) IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.packages p
        WHERE p.id = ANY (p_package_ids) AND p.category_id = ANY (v_coupon.category_ids)
      ) INTO v_matches;
    END IF;

    IF NOT v_matches THEN
      RETURN json_build_object('valid', false, 'reason', 'package_mismatch',
        'message', 'This coupon does not apply to the package you selected.');
    END IF;
  ELSIF array_length(v_coupon.category_ids, 1) IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.packages p
      WHERE p.id = ANY (p_package_ids) AND p.category_id = ANY (v_coupon.category_ids)
    ) INTO v_matches;

    IF NOT v_matches THEN
      RETURN json_build_object('valid', false, 'reason', 'package_mismatch',
        'message', 'This coupon does not apply to the package you selected.');
    END IF;
  END IF;

  IF v_coupon.min_spend > 0 AND p_subtotal < v_coupon.min_spend THEN
    RETURN json_build_object('valid', false, 'reason', 'min_spend',
      'message', 'This coupon needs a minimum spend of RM ' || to_char(v_coupon.min_spend, 'FM999999990.00') || '.');
  END IF;

  IF v_coupon.discount_type = 'percent' THEN
    v_discount := round(p_subtotal * (v_coupon.discount_value / 100.0), 2);
    IF v_coupon.max_discount IS NOT NULL AND v_discount > v_coupon.max_discount THEN
      v_discount := v_coupon.max_discount;
    END IF;
  ELSE
    v_discount := v_coupon.discount_value;
  END IF;

  IF v_discount > p_subtotal THEN v_discount := p_subtotal; END IF;
  IF v_discount < 0 THEN v_discount := 0; END IF;

  RETURN json_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'description', v_coupon.description,
    'agent_name', v_coupon.agent_name,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount,
    'expires_at', v_ends,
    'message', 'Coupon applied.'
  );
END;
$function$;

COMMIT;
