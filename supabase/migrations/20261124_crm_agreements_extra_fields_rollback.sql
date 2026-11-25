-- Rollback: Remove medium, vehicle_type, personal_info from public.crm_agreements
-- Date: 2026-11-24

BEGIN;

ALTER TABLE public.crm_agreements DROP COLUMN IF EXISTS medium;
ALTER TABLE public.crm_agreements DROP COLUMN IF EXISTS vehicle_type;
ALTER TABLE public.crm_agreements DROP COLUMN IF EXISTS personal_info;

COMMIT;
