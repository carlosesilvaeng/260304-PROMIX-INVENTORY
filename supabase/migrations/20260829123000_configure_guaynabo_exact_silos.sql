BEGIN;

SELECT public.replace_plant_silos_config_atomic(
  'GUAYNABO',
  $$[
    {
      "id": "guaynabo-cemento-linea-1",
      "silo_name": "Cemento Línea 1",
      "measurement_method": "SILO_LEVEL",
      "reading_uom": "in",
      "calculation_method": "GEOMETRIC_CYLINDER_CONE",
      "diameter_in": 144,
      "total_height_in": 468,
      "cone_height_in": 80.1499,
      "bottom_diameter_in": 42,
      "cylinder_height_mode": "FULL_H",
      "slope_divisor_mode": "SLOPE_DIVISOR_EFFECTIVE",
      "reading_reference": "EMPTY_HEIGHT_INCHES",
      "geometry_model": "EXACT_PIECEWISE",
      "capacity_fraction": 0.5,
      "calculation_unit_id": "ft3",
      "inventory_unit_id": "ft3",
      "requires_photo": true,
      "sort_order": 1,
      "is_active": true
    },
    {
      "id": "guaynabo-slag-linea-1",
      "silo_name": "Slag Línea 1",
      "measurement_method": "SILO_LEVEL",
      "reading_uom": "in",
      "calculation_method": "GEOMETRIC_CYLINDER_CONE",
      "diameter_in": 144,
      "total_height_in": 468,
      "cone_height_in": 80.1499,
      "bottom_diameter_in": 42,
      "cylinder_height_mode": "FULL_H",
      "slope_divisor_mode": "SLOPE_DIVISOR_EFFECTIVE",
      "reading_reference": "EMPTY_HEIGHT_INCHES",
      "geometry_model": "EXACT_PIECEWISE",
      "capacity_fraction": 0.5,
      "calculation_unit_id": "ft3",
      "inventory_unit_id": "ft3",
      "requires_photo": true,
      "sort_order": 2,
      "is_active": true
    },
    {
      "id": "guaynabo-cemento-linea-2",
      "silo_name": "Cemento Línea 2",
      "measurement_method": "SILO_LEVEL",
      "reading_uom": "in",
      "calculation_method": "GEOMETRIC_CYLINDER_CONE",
      "diameter_in": 144,
      "total_height_in": 144,
      "cone_height_in": 107.3732,
      "bottom_diameter_in": 16,
      "cylinder_height_mode": "FULL_H",
      "slope_divisor_mode": "SLOPE_DIVISOR_EFFECTIVE",
      "reading_reference": "EMPTY_HEIGHT_INCHES",
      "geometry_model": "EXACT_PIECEWISE",
      "capacity_fraction": 1,
      "calculation_unit_id": "ft3",
      "inventory_unit_id": "ft3",
      "requires_photo": true,
      "sort_order": 3,
      "is_active": true
    },
    {
      "id": "guaynabo-slag-linea-2",
      "silo_name": "Slag Línea 2",
      "measurement_method": "SILO_LEVEL",
      "reading_uom": "in",
      "calculation_method": "GEOMETRIC_CYLINDER_CONE",
      "diameter_in": 96,
      "total_height_in": 300,
      "cone_height_in": 131.6121,
      "bottom_diameter_in": 13,
      "cylinder_height_mode": "FULL_H",
      "slope_divisor_mode": "SLOPE_DIVISOR_EFFECTIVE",
      "reading_reference": "EMPTY_HEIGHT_INCHES",
      "geometry_model": "EXACT_PIECEWISE",
      "capacity_fraction": 1,
      "calculation_unit_id": "ft3",
      "inventory_unit_id": "ft3",
      "requires_photo": true,
      "sort_order": 4,
      "is_active": true
    }
  ]$$::jsonb,
  $$[
    {"silo_config_id":"guaynabo-cemento-linea-1","product_name":"Cemento"},
    {"silo_config_id":"guaynabo-slag-linea-1","product_name":"Slag"},
    {"silo_config_id":"guaynabo-cemento-linea-2","product_name":"Cemento"},
    {"silo_config_id":"guaynabo-slag-linea-2","product_name":"Slag"}
  ]$$::jsonb
);

COMMIT;
