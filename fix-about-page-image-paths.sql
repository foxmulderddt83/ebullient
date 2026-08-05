-- About page: repoint every captioned panel at its Supabase storage image,
-- and drop the duplicated "Strike Back Season 7" panel.
--
-- Covers both captioned sections in one statement:
--   what_we_have_done  → about-page/w1.png … w7.png  (8 panels in, 7 out)
--   achievements       → about-page/a1.png … a3.png  (3 panels)
--
-- Why the repoint is needed
-- -------------------------
-- About.tsx prefers additional_data.image_data over the images[] column (see the
-- displayData ternary in AutoScrollGallery). The earlier image migration updated
-- images[] but left image_data pointing at https://www.onedaypilot.com/img/odp/*,
-- which now 404s. Both galleries therefore render broken panels even though every
-- file is present and public in storage under about-page/.
--
-- Why it rewrites rather than replaces
-- ------------------------------------
-- Each element is patched in place: the existing `description` (the panel label)
-- is untouched and only the url changes, with the filename derived from the old
-- url. A panel cannot drift onto someone else's image — w3.png stays with
-- "8TV Game Show / Baki Zainal", a2.png with "KL Tower Base Jump 2016".
--
-- The duplicate
-- -------------
-- w7.png and w8.png both carried the label "Strike Back Season 7 / Cinemax USA",
-- so the gallery showed the same panel twice. w8 is dropped from image_data and
-- from images[] together, keeping the two columns consistent.
--
-- Notes
-- -----
-- images is jsonb (not text[]), hence jsonb_array_elements_text rather than unnest.
-- WITH ORDINALITY + ORDER BY preserves panel order.
-- Idempotent: re-running rewrites about-page/xN.png to itself and finds no w8.

UPDATE public.about_page AS p
SET
  additional_data = jsonb_set(
    COALESCE(p.additional_data, '{}'::jsonb),
    '{image_data}',
    COALESCE((
      SELECT jsonb_agg(
               jsonb_set(
                 elem,
                 '{url}',
                 to_jsonb('about-page/' || regexp_replace(elem->>'url', '^.*/', ''))
               )
               ORDER BY ord
             )
      FROM jsonb_array_elements(p.additional_data->'image_data')
           WITH ORDINALITY AS t(elem, ord)
      WHERE NOT (
        p.section_key = 'what_we_have_done'
        AND regexp_replace(elem->>'url', '^.*/', '') = 'w8.png'
      )
    ), '[]'::jsonb)
  ),
  images = COALESCE((
    SELECT jsonb_agg(img ORDER BY ord)
    FROM jsonb_array_elements_text(p.images)
         WITH ORDINALITY AS u(img, ord)
    WHERE NOT (
      p.section_key = 'what_we_have_done'
      AND regexp_replace(img, '^.*/', '') = 'w8.png'
    )
  ), p.images)
WHERE p.section_key IN ('what_we_have_done', 'achievements')
  AND p.additional_data ? 'image_data';
