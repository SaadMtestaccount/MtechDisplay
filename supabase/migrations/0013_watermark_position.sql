-- 0013_watermark_position.sql — where the "Powered by MTech" badge sits on a screen: the badge
-- CENTRE as fractions (0..1) of the player stage. Both null = the default bottom-right corner.
-- Set by MTech staff from the TV tile's "Position watermark" preview.
alter table public.screens
  add column if not exists watermark_x double precision,
  add column if not exists watermark_y double precision;
alter table public.screens drop constraint if exists screens_watermark_check;
-- Written null-symmetrically on purpose: `x between 0 and 1 and y between 0 and 1` is NULL (which
-- CHECK accepts) when only one side is null, so that form would let half-set positions through.
alter table public.screens add constraint screens_watermark_check check (
  (watermark_x is null) = (watermark_y is null)
  and (watermark_x is null or (watermark_x >= 0 and watermark_x <= 1))
  and (watermark_y is null or (watermark_y >= 0 and watermark_y <= 1))
);
