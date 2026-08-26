-- Secure tables created after the initial RLS baseline. The application reaches
-- these tables through make-server with service_role, so direct Data API access
-- from anon/authenticated is intentionally denied.

BEGIN;

ALTER TABLE public.measurement_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calibration_curve_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_conversion_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.measurement_configs,
  public.calibration_curve_points,
  public.material_conversion_factors,
  public.unit_categories,
  public.units
FROM anon, authenticated;

COMMIT;
