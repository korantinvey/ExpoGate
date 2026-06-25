-- Migration : mise à jour table stands
-- Ajout surface (numeric 2 décimales) et angles (integer)
-- Suppression emplacement

ALTER TABLE stands
  ADD COLUMN IF NOT EXISTS surface numeric(10,2),
  ADD COLUMN IF NOT EXISTS angles integer;

ALTER TABLE stands
  DROP COLUMN IF EXISTS emplacement;
