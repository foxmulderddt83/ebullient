-- ---------------------------------------------------------------------
-- A landing page that runs a coupon should apply it at checkout on its
-- own, without the visitor typing the code - and should say so up front
-- when it cannot.
--
-- The wizard already applies whatever ?coupon= is on the URL, and
-- AgentLanding already puts one there when the visitor arrived through a
-- share link - resolve_share_link hands it the code. A page opened
-- directly has no link to ask, and agent_coupons has no public select
-- policy, so the page's own coupon_id could not be turned into a code.
--
-- The verdict is not decided here. Whether a coupon is good depends on
-- the carrier rules in validate_coupon, which knows about share-link
-- schedules and published pages; a second copy of that reasoning would
-- drift, and the page would end up promising a discount checkout then
-- refuses. So this asks validate_coupon and passes its answer through.
--
-- The two arguments are chosen so the only thing under test is whether
-- the coupon is live:
--   p_package_ids - the packages the coupon itself covers, so its own
--                   scope check cannot fail. A visitor who then picks
--                   something outside that scope is told at checkout,
--                   which is the right place for it.
--   p_subtotal    - the coupon's own min_spend, so the minimum is met
--                   exactly. The cart is empty at this point; a real
--                   subtotal of 0 would read as "below minimum".
-- p_email is left null: once_per_customer cannot be judged before the
-- visitor has entered an address, and checkout still enforces it.
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.landing_page_coupon(uuid);

CREATE FUNCTION public.landing_page_coupon(p_page_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.agent_coupons%ROWTYPE;
  v_pkgs   uuid[] := '{}'::uuid[];
  v_check  json;
BEGIN
  -- Draft pages are deliberately not excluded: ?preview=1 has to price the
  -- same way the published page will, or the proof is not a proof.
  SELECT c.* INTO v_coupon
    FROM public.agent_landing_pages g
    JOIN public.agent_coupons c ON c.id = g.coupon_id
   WHERE g.id = p_page_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('state', 'none');
  END IF;

  IF array_length(v_coupon.package_ids, 1) IS NOT NULL THEN
    v_pkgs := v_coupon.package_ids;
  ELSIF array_length(v_coupon.category_ids, 1) IS NOT NULL THEN
    SELECT coalesce(array_agg(p.id), '{}'::uuid[]) INTO v_pkgs
      FROM public.packages p
     WHERE p.category_id = ANY (v_coupon.category_ids);
  END IF;

  v_check := public.validate_coupon(
    v_coupon.code, v_pkgs, coalesce(v_coupon.min_spend, 0), NULL
  );

  IF coalesce((v_check ->> 'valid')::boolean, false) THEN
    RETURN json_build_object(
      'state', 'ok',
      'code', v_coupon.code,
      'expires_at', v_check ->> 'expires_at'
    );
  END IF;

  -- No code is handed back when it would only be refused. The page shows
  -- the reason instead, and nothing goes on the URL for the wizard to try.
  RETURN json_build_object(
    'state', 'unavailable',
    'reason', v_check ->> 'reason',
    'message', v_check ->> 'message'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.landing_page_coupon(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.landing_page_coupon(uuid) TO anon, authenticated;
