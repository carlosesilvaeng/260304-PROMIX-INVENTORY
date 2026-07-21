INSERT INTO units (
  id, category_id, code, name_es, name_en, symbol, measurement_system,
  factor_to_base, decimal_precision, sort_order, active
)
VALUES (
  'ft-in', 'length', 'ft-in', 'pie y pulgada', 'feet and inches', 'ft/in', 'imperial',
  0.3048, 3, 25, true
)
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  code = EXCLUDED.code,
  name_es = EXCLUDED.name_es,
  name_en = EXCLUDED.name_en,
  symbol = EXCLUDED.symbol,
  measurement_system = EXCLUDED.measurement_system,
  factor_to_base = EXCLUDED.factor_to_base,
  decimal_precision = EXCLUDED.decimal_precision,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active,
  updated_at = NOW();

ALTER TABLE plant_aggregates_config
  ALTER COLUMN unit SET DEFAULT 'ft3';

UPDATE measurement_configs
SET capture_unit_id = 'ft-in',
    updated_at = NOW()
WHERE section_code = 'aggregates'
  AND capture_unit_id = 'ft'
  AND active = true;

UPDATE plant_aggregates_config aggregate_config
SET unit = COALESCE(
      (
        SELECT plant_config.display_unit_id
        FROM measurement_configs plant_config
        WHERE plant_config.section_code = 'aggregates'
          AND plant_config.plant_id = aggregate_config.plant_id
          AND plant_config.active = true
        ORDER BY plant_config.sort_order
        LIMIT 1
      ),
      (
        SELECT default_config.display_unit_id
        FROM measurement_configs default_config
        WHERE default_config.section_code = 'aggregates'
          AND default_config.plant_id IS NULL
          AND default_config.active = true
        ORDER BY default_config.sort_order
        LIMIT 1
      ),
      'ft3'
    ),
    updated_at = NOW()
WHERE aggregate_config.unit = 'CUBIC_YARDS';

UPDATE inventory_aggregates_entries entry
SET unit = COALESCE(
      (
        SELECT plant_config.display_unit_id
        FROM measurement_configs plant_config
        WHERE plant_config.section_code = 'aggregates'
          AND plant_config.plant_id = month.plant_id
          AND plant_config.active = true
        ORDER BY plant_config.sort_order
        LIMIT 1
      ),
      (
        SELECT default_config.display_unit_id
        FROM measurement_configs default_config
        WHERE default_config.section_code = 'aggregates'
          AND default_config.plant_id IS NULL
          AND default_config.active = true
        ORDER BY default_config.sort_order
        LIMIT 1
      ),
      'ft3'
    ),
    updated_at = NOW()
FROM inventory_month month
WHERE entry.inventory_month_id = month.id
  AND entry.unit = 'CUBIC_YARDS';
