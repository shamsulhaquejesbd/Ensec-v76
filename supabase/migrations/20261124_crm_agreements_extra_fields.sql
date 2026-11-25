-- Migration: Add medium, vehicle_type, personal_info to public.crm_agreements
-- Date: 2026-11-24

BEGIN;

ALTER TABLE public.crm_agreements ADD COLUMN IF NOT EXISTS medium TEXT;
ALTER TABLE public.crm_agreements ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.crm_agreements ADD COLUMN IF NOT EXISTS personal_info TEXT;
ALTER TABLE public.crm_agreements ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

COMMIT;
