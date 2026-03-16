CREATE TABLE IF NOT EXISTS public.calibration_curve_points (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  curve_id TEXT NOT NULL REFERENCES public.calibration_curves(id) ON DELETE CASCADE,
  point_key NUMERIC NOT NULL,
  point_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (curve_id, point_key)
);

INSERT INTO public.calibration_curve_points (curve_id, point_key, point_value)
SELECT
  curve.id,
  point.key::numeric,
  point.value::numeric
FROM public.calibration_curves AS curve
CROSS JOIN LATERAL jsonb_each_text(curve.data_points) AS point(key, value)
ON CONFLICT (curve_id, point_key) DO UPDATE
SET
  point_value = EXCLUDED.point_value,
  updated_at = NOW();
