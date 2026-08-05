-- Supabase security linter remediation.
--
-- Guiding constraint: the public booking flow must keep working. Anonymous
-- visitors legitimately write to bookings, booking_items, booking_passengers and
-- user_interactions, and legitimately call several SECURITY DEFINER functions.
-- So the goal is not to remove anon access — it is to stop anon writing values
-- it has no business writing.
--
-- Verified against the actual call sites before writing this:
--   BookingWizard.tsx:1864  and  Checkout.tsx:452   insert bookings
--   BookingWizard.tsx:1894  and  Checkout.tsx:482   insert booking_items
--   BookingWizard.tsx:1968                          inserts booking_passengers
--   analytics.ts:106                                inserts user_interactions
-- Both booking paths insert exactly payment_status 'unpaid' and status
-- 'pending' or 'pending_verification', which is what STEP 2 pins down.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1 — READ ONLY. Run first and keep the output.
-- ═══════════════════════════════════════════════════════════════════════════
-- Nothing below changes anything; it tells us what we are working with, and two
-- of the fixes further down cannot be written safely without it.

-- 1a. Current policies on the affected tables
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('bookings','booking_items','booking_passengers',
                    'event_registrations','user_interactions','activity_logs')
ORDER BY tablename, cmd, policyname;

-- 1b. Body of delete_user_entirely — see the warning in STEP 4
SELECT pg_get_functiondef('public.delete_user_entirely(uuid)'::regprocedure);

-- 1c. Who can execute the helper functions that RLS policies depend on
SELECT p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
CROSS JOIN (SELECT unnest(ARRAY['anon','authenticated']) AS rolname) r
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('is_staff','is_admin','get_my_role')
ORDER BY p.proname, r.rolname;

-- 1d. Any policy that calls a helper function — these are why 1c matters
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ILIKE '%is_staff%' OR qual ILIKE '%is_admin%' OR qual ILIKE '%get_my_role%'
    OR with_check ILIKE '%is_staff%' OR with_check ILIKE '%is_admin%' OR with_check ILIKE '%get_my_role%')
ORDER BY tablename;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2 — Stop anon creating pre-paid bookings.  THE REAL VULNERABILITY.
-- ═══════════════════════════════════════════════════════════════════════════
-- `Allow public insert bookings` has WITH CHECK (true), so anyone holding the
-- publishable anon key — which ships in the browser bundle, so everyone — can
-- POST a booking with payment_status 'paid' and status 'confirmed' and receive a
-- confirmed flight without paying. The linter reports this as a generic warning;
-- it is the most serious item in the report.
--
-- Both real booking paths always send 'unpaid' plus 'pending' or
-- 'pending_verification', so pinning those values costs the app nothing.
-- Staff continue to move bookings to paid/confirmed through their own
-- authenticated UPDATE policy, which this does not touch.

BEGIN;

DROP POLICY IF EXISTS "Allow public insert bookings" ON public.bookings;

CREATE POLICY "Allow public insert bookings"
  ON public.bookings FOR INSERT TO anon
  WITH CHECK (
    payment_status = 'unpaid'
    AND status IN ('pending', 'pending_verification')
    AND total_amount >= 0
    AND COALESCE(deposit_amount, 0) >= 0
  );

-- booking_items: previously any anon could attach items to ANY booking id,
-- including someone else's, at any price they chose. Require the parent booking
-- to exist and to still be unpaid, and require non-negative money.
DROP POLICY IF EXISTS "Allow public insert booking_items" ON public.booking_items;

CREATE POLICY "Allow public insert booking_items"
  ON public.booking_items FOR INSERT TO anon
  WITH CHECK (
    quantity > 0
    AND unit_price >= 0
    AND total_price >= 0
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.booking_id = booking_items.booking_id
        AND b.payment_status = 'unpaid'
    )
  );

-- booking_passengers: same reasoning — passengers may only be attached to a
-- booking that exists and has not been paid for yet.
DROP POLICY IF EXISTS "Allow public insert booking_passengers" ON public.booking_passengers;

CREATE POLICY "Allow public insert booking_passengers"
  ON public.booking_passengers FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.booking_id = booking_passengers.booking_id
        AND b.payment_status = 'unpaid'
    )
  );

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3 — user_interactions: remove the duplicate policy
-- ═══════════════════════════════════════════════════════════════════════════
-- The linter reports this table twice because it carries two INSERT policies
-- that both allow everything. Policies are OR'd, so the pair is no safer than
-- one — drop the redundant one and keep a single, named policy.
-- This table is pure page-view telemetry (analytics.ts), so anon must keep
-- INSERT; there is nothing sensitive to protect beyond volume.

BEGIN;

DROP POLICY IF EXISTS "Allow public insert interactions" ON public.user_interactions;
DROP POLICY IF EXISTS "user_interactions_insert" ON public.user_interactions;

CREATE POLICY "user_interactions_insert"
  ON public.user_interactions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4 — delete_user_entirely.  READ BEFORE RUNNING ANYTHING HERE.
-- ═══════════════════════════════════════════════════════════════════════════
-- The linter says any signed-in user can execute it. If the function body does
-- not itself check is_admin(), then any customer who registers an account can
-- delete any user in the system. That is a bigger hole than everything above.
--
-- I could not read the body, so I am not rewriting it blind — run 1b first.
-- If the body has no admin guard, add one as its first statement:
--
--   IF NOT public.is_admin() THEN
--     RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
--   END IF;
--
-- Do NOT simply revoke EXECUTE from authenticated: Admin.tsx:4916 calls this as
-- a signed-in admin, so revoking breaks user deletion in the admin panel.


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5 — Deliberately NOT changed, and why
-- ═══════════════════════════════════════════════════════════════════════════
--
-- These SECURITY DEFINER functions stay callable by anon because the public
-- checkout depends on them. Each was traced to a real anonymous call site:
--   find_or_create_customer   Checkout.tsx:431      creating a booking
--   is_timeslot_taken         Checkout.tsx:414      slot availability
--   get_blocked_times         BookingWizard.tsx:1265
--   submit_payment_proof      Checkout.tsx:529      QR-pay receipt upload
--   check_admin_email_exists  Admin.tsx:4726        runs before sign-in, so the
--                                                   caller is necessarily anon
-- Revoking any of these breaks booking or admin login. They are an accepted,
-- documented exposure rather than an oversight.
--
-- check_admin_email_exists does allow admin-email enumeration. The fix is rate
-- limiting or returning a constant, not revoking it — flagged, not changed.
--
-- is_staff / is_admin / get_my_role are NOT revoked from anon here even though
-- schemas.md says they should be. Query 1d shows which policies call them: if
-- any anon-facing policy does, revoking EXECUTE makes those queries fail with
-- "permission denied for function" and takes the public site down. Run 1c/1d,
-- and if no anon-facing policy references them, then this is safe:
--
--   REVOKE EXECUTE ON FUNCTION public.is_staff()    FROM anon;
--   REVOKE EXECUTE ON FUNCTION public.is_admin()    FROM anon;
--   REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
--
-- Test the home page logged out immediately afterwards, and be ready to
-- GRANT ... TO anon again.
--
-- Leaked-password protection is not SQL — enable it at
-- Authentication → Providers → Email → "Prevent use of leaked passwords"
-- in the Supabase dashboard. Nothing in the app changes.


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6 — Verify the booking flow still works, before you trust any of this
-- ═══════════════════════════════════════════════════════════════════════════
-- In the browser, logged OUT:
--   1. Add a package, go to Checkout, complete a QR-pay booking end to end.
--   2. Confirm the row lands in bookings, with its booking_items and
--      booking_passengers rows attached.
-- Then logged in as admin:
--   3. Open Bookings, change a status and a payment status, save.
--   4. Change something in Configuration and save.
--   5. Sign out and sign back in.
-- If step 1 fails with "new row violates row-level security policy", the app is
-- sending a value STEP 2 does not permit — send me the payload and I will widen
-- the WITH CHECK to match rather than leaving it broken.
