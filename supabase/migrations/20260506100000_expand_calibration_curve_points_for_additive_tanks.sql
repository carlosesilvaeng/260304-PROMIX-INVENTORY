ALTER TABLE public.calibration_curve_points
  ADD COLUMN IF NOT EXISTS available_gallons NUMERIC,
  ADD COLUMN IF NOT EXISTS consumed_gallons NUMERIC,
  ADD COLUMN IF NOT EXISTS percentage NUMERIC,
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE public.calibration_curve_points
SET available_gallons = point_value
WHERE available_gallons IS NULL;
