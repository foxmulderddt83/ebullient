-- Add NRIC to the pilot and ground crew rosters.
--
-- Nullable on purpose: the 6 existing pilots and 5 existing crew have no NRIC on
-- file, and a NOT NULL column would either reject the migration or force a
-- placeholder value onto real personnel records.
--
-- Safe to run more than once (IF NOT EXISTS), and it takes no table rewrite:
-- adding a nullable column with no default is metadata-only in Postgres.

ALTER TABLE public.pilots      ADD COLUMN IF NOT EXISTS nric text;
ALTER TABLE public.ground_crew ADD COLUMN IF NOT EXISTS nric text;

COMMENT ON COLUMN public.pilots.nric      IS 'National identity number (NRIC).';
COMMENT ON COLUMN public.ground_crew.nric IS 'National identity number (NRIC).';

-- PostgREST caches the table schema; without this the admin panel's first save
-- fails with "Could not find the 'nric' column of 'pilots' in the schema cache".
NOTIFY pgrst, 'reload schema';
