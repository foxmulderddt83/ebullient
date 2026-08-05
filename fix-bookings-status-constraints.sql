-- bookings: allow 'partial' as a payment_status.
--
-- The bug
-- -------
-- Saving a booking from the admin panel failed with
--   23514  new row for relation "bookings" violates check constraint
--          "bookings_payment_status_check"
--
-- The live constraint is:
--   CHECK (payment_status = ANY (ARRAY[
--     'unpaid', 'pending', 'paid', 'failed', 'refunded', 'pending_verification'
--   ]))
--
-- The Payment Status dropdown offers Unpaid / Paid / Partial / Refunded.
-- Every one of those is permitted except 'partial' — that single missing value
-- is the whole bug. Picking "Partial" is the only way to trigger the 23514.
--
-- Scope
-- -----
-- payment_status only. The status constraint already permits every value the
-- Booking Status dropdown offers (pending, confirmed, cancelled, completed,
-- failed, pending_verification, rescheduled), so it needs no change — an
-- earlier draft of this file would have narrowed it by dropping 'failed', which
-- is why it errored with "is violated by some row". That draft is abandoned.
--
-- 'pending' and 'failed' are kept below because the live constraint allows them
-- and existing rows may rely on them; this only widens, never narrows.
--
-- Existing data (paid, unpaid, pending_verification) all satisfies the new list,
-- so this validates cleanly — no NOT VALID needed.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status = ANY (ARRAY[
    'unpaid'::text,
    'pending'::text,
    'pending_verification'::text,
    'partial'::text,
    'paid'::text,
    'failed'::text,
    'refunded'::text
  ]));
