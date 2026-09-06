-- Adds the "King's Escape" match-three to the slash campaigns.
--
-- The games are cosmetic: slash_play() decides what a round is worth from
-- the hit count alone, so nothing here touches the money path. The only
-- thing Postgres knows about a game is its name, and that is guarded by a
-- CHECK constraint that has to learn the new value.
--
-- Safe to re-run.

ALTER TABLE public.slash_campaigns DROP CONSTRAINT IF EXISTS slash_campaigns_game_type_check;
ALTER TABLE public.slash_campaigns ADD CONSTRAINT slash_campaigns_game_type_check
  CHECK (game_type IN ('slash', 'shoot', 'spin', 'match'));
