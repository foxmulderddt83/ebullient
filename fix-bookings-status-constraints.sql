-- bookings: widen the status / payment_status CHECK constraints to the values
-- the application actually uses.
--
-- The bug
-- -------
-- Saving a booking from the admin panel fails with
--   23514  new row for relation "bookings" violates check constraint
--          "bookings_payment_status_check"
-- because the Payment Status dropdown offers values the constraint rejects.
--
-- Evidence: across every booking row, payment_status only ever holds
--   paid, unpaid, pending_verification
-- and status only ever holds
--   pending, pending_verification, confirmed, completed, cancelled
--
-- So 'partial' and 'refunded' have never successfully been written — which means
-- the Cancel & Refund action (Admin.tsx, `.update({ status: 'cancelled',
-- payment_status: 'refunded' })`) has been failing with this same 23514 too.
-- Likewise 'rescheduled' has never been stored, so picking it in the Booking
-- Status dropdown would fail next.
--
-- The choice
-- ----------
-- Widen the database to match the app rather than stripping options out of the
-- UI: the refund and reschedule flows are intended features, and narrowing the
-- dropdown would remove them rather than fix them.
--
-- IMPORTANT — check the constraint names first
-- --------------------------------------------
-- 'bookings_payment_status_check' is confirmed by the error message. The status
-- constraint's name is assumed to follow the same convention. DROP ... IF EXISTS
-- is a no-op on a name that does not exist, so if the real name differs the old
-- restriction stays in place and 'rescheduled' will still be rejected. Run this
-- first and adjust the names below to match:
--
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'public.bookings'::regclass AND contype = 'c';

BEGIN;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (
    payment_status IS NULL
    OR payment_status IN ('unpaid', 'pending_verification', 'partial', 'paid', 'refunded')
  );

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (
    status IS NULL
    OR status IN ('pending', 'pending_verification', 'confirmed', 'completed', 'cancelled', 'rescheduled')
  );

COMMIT;

-- NULL is permitted explicitly so the constraint does not turn an unset column
-- into a hard failure; a bare IN (...) already passes on NULL, this just makes
-- the intent obvious to the next reader.
