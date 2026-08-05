-- bookings: widen the status / payment_status CHECK constraints to the values
-- the application actually uses.
--
-- The bug
-- -------
-- Saving a booking from the admin panel fails with
--   23514  new row for relation "bookings" violates check constraint
--          "bookings_payment_status_check"
-- because the Payment Status dropdown offers values the constraint rejects.
-- 'partial' and 'refunded' have never once been stored, which means the
-- Cancel & Refund action (which writes payment_status: 'refunded') has been
-- failing with the same error all along. 'rescheduled' is in the same position.
--
-- Why NOT VALID
-- -------------
-- A first attempt at this failed with
--   ERROR: 23514: check constraint "bookings_status_check" of relation
--          "bookings" is violated by some row
-- so at least one existing row holds a status outside the list below. Adding the
-- constraint NOT VALID enforces it on every future insert and update — which is
-- what unblocks the admin panel — without rejecting the legacy rows outright.
-- Nothing is deleted or rewritten.
--
-- Run STEP 1 first: it names the offending rows. If their values are legitimate,
-- add them to the lists in STEP 2 before running it. Once the data is clean,
-- STEP 3 promotes the constraints to fully validated.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — find the rows that break the constraint, and confirm constraint names
-- ─────────────────────────────────────────────────────────────────────────────

SELECT status, payment_status, count(*) AS rows
FROM public.bookings
WHERE status IS NOT NULL AND status NOT IN
        ('pending', 'pending_verification', 'confirmed', 'completed', 'cancelled', 'rescheduled')
   OR payment_status IS NOT NULL AND payment_status NOT IN
        ('unpaid', 'pending_verification', 'partial', 'paid', 'refunded')
GROUP BY status, payment_status
ORDER BY rows DESC;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.bookings'::regclass AND contype = 'c';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — widen the constraints (safe to run with legacy rows present)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (
    payment_status IS NULL
    OR payment_status IN ('unpaid', 'pending_verification', 'partial', 'paid', 'refunded')
  ) NOT VALID;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (
    status IS NULL
    OR status IN ('pending', 'pending_verification', 'confirmed', 'completed', 'cancelled', 'rescheduled')
  ) NOT VALID;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — optional, once STEP 1 returns no rows: promote to fully validated
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_payment_status_check;
-- ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_status_check;
--
-- If STEP 1's second query shows a differently-named status constraint, the
-- DROP ... IF EXISTS above silently no-ops and the old restriction survives.
-- Drop it by its real name and re-run STEP 2.
