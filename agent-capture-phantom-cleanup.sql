-- ---------------------------------------------------------------------
-- Remove the form captures that record nothing the visitor did.
--
-- BookingWizard filed a capture whenever the cart was non-empty, and the
-- cart is restored from localStorage on load. A package left over from an
-- earlier visit therefore produced a row on a plain refresh: no name, no
-- contact, no flight, never paid - a lead the agent cannot act on and did
-- not earn. The code no longer does this, but the rows it already wrote
-- are still in the table.
--
-- A row with no name, no email and no phone that never completed carries
-- nothing an agent can use: there is no one to follow up. That, and not
-- the cart contents, is what makes it safe to delete - a genuine visitor
-- who typed even a phone number is kept.
--
-- Run the SELECT first and look at the count before running the DELETE.
-- There is no undo.
-- ---------------------------------------------------------------------

-- 1. What would go, and how it splits by page/link.
SELECT count(*) AS phantom_rows,
       min(updated_at) AS oldest,
       max(updated_at) AS newest
  FROM public.share_link_form_captures
 WHERE coalesce(btrim(name),  '') = ''
   AND coalesce(btrim(email), '') = ''
   AND coalesce(btrim(phone), '') = ''
   AND completed = false
   AND booking_id IS NULL;

-- 2. A sample to eyeball before committing to it.
SELECT id, share_link_id, landing_page_id, step_reached, furthest_step,
       cart_total, city, country, updated_at
  FROM public.share_link_form_captures
 WHERE coalesce(btrim(name),  '') = ''
   AND coalesce(btrim(email), '') = ''
   AND coalesce(btrim(phone), '') = ''
   AND completed = false
   AND booking_id IS NULL
 ORDER BY updated_at DESC
 LIMIT 25;

-- 3. The delete. Uncomment and run once the counts above look right.
--
-- BEGIN;
--
-- DELETE FROM public.share_link_form_captures
--  WHERE coalesce(btrim(name),  '') = ''
--    AND coalesce(btrim(email), '') = ''
--    AND coalesce(btrim(phone), '') = ''
--    AND completed = false
--    AND booking_id IS NULL;
--
-- COMMIT;
