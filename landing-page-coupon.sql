-- ---------------------------------------------------------------------
-- A landing page that runs a coupon should apply it at checkout on its
-- own, without the visitor typing the code.
--
-- The wizard already applies whatever ?coupon= is on the URL, and
-- AgentLanding already puts one there when the visitor arrived through a
-- share link - resolve_share_link hands it the code. A page opened
-- directly has no link to ask, and agent_coupons has no public select
-- policy, so the page's own coupon_id could not be turned into a code.
--
-- This is the same shape as the coupon_code column of resolve_share_link:
-- definer rights, one active coupon, nothing else about it exposed.
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.landing_page_coupon(uuid);

CREATE FUNCTION public.landing_page_coupon(p_page_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.code
    FROM public.agent_landing_pages g
    JOIN public.agent_coupons c ON c.id = g.coupon_id
   WHERE g.id = p_page_id
     AND c.is_active = true
   LIMIT 1;
$$;

-- Draft pages are deliberately not excluded: ?preview=1 has to price the
-- same way the published page will, or the proof is not a proof. The id
-- is a uuid and the code is what the customer is given anyway.
REVOKE EXECUTE ON FUNCTION public.landing_page_coupon(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.landing_page_coupon(uuid) TO anon, authenticated;
