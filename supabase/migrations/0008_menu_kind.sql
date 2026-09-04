-- =============================================================================
-- MSIGN — 0008_menu_kind.sql
-- Adds the reusable 'menu' playlist kind. MUST be its own migration: PostgreSQL
-- forbids using a newly-added enum value in the same transaction that adds it, and
-- the migration runner applies each file in its own transaction. 0009 uses 'menu'.
-- =============================================================================

alter type public.playlist_kind add value if not exists 'menu';
