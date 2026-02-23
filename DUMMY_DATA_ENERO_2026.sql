-- ============================================================================
-- PROMIX PLANT INVENTORY - DATOS DUMMY ENERO 2026
-- ============================================================================
-- Este script genera datos de prueba para ENERO 2026 en todas las plantas
-- con diferentes estados y escenarios para testing completo del sistema.
-- ============================================================================

-- NOTA: Ejecutar este script en la base de datos de Supabase
-- Genera inventarios con diferentes estados para probar todo el flujo

-- ============================================================================
-- 1. INVENTORY_MONTH - Mes de Enero 2026 para todas las plantas
-- ============================================================================

-- Estados a generar:
-- CAROLINA: APPROVED (completamente aprobado)
-- CEIBA: SUBMITTED (esperando aprobación)
-- GUAYNABO: IN_PROGRESS (parcialmente completado)
-- GURABO: APPROVED (completamente aprobado)
-- VEGA BAJA: SUBMITTED (esperando aprobación con algunas secciones rechazadas antes)
-- HUMACAO: IN_PROGRESS (recién iniciado)

-- CAROLINA - APPROVED
INSERT INTO inventory_month_02205af0 (
  id, plant_id, plant_name, month, year, status,
  started_by, started_at,
  submitted_by, submitted_at,
  approved_by, approved_at,
  created_at, updated_at
) VALUES (
  'inv_carolina_jan_2026',
  'carolina', 'CAROLINA', 'Enero', 2026, 'APPROVED',
  'Juan Pérez', '2026-01-02T08:00:00Z',
  'Juan Pérez', '2026-01-03T17:30:00Z',
  'María González', '2026-01-04T09:15:00Z',
  '2026-01-02T08:00:00Z', '2026-01-04T09:15:00Z'
);

-- CEIBA - SUBMITTED
INSERT INTO inventory_month_02205af0 (
  id, plant_id, plant_name, month, year, status,
  started_by, started_at,
  submitted_by, submitted_at,
  created_at, updated_at
) VALUES (
  'inv_ceiba_jan_2026',
  'ceiba', 'CEIBA', 'Enero', 2026, 'SUBMITTED',
  'Carlos Rodríguez', '2026-01-02T07:45:00Z',
  'Carlos Rodríguez', '2026-01-03T16:45:00Z',
  '2026-01-02T07:45:00Z', '2026-01-03T16:45:00Z'
);

-- GUAYNABO - IN_PROGRESS (parcialmente completado)
INSERT INTO inventory_month_02205af0 (
  id, plant_id, plant_name, month, year, status,
  started_by, started_at,
  created_at, updated_at
) VALUES (
  'inv_guaynabo_jan_2026',
  'guaynabo', 'GUAYNABO', 'Enero', 2026, 'IN_PROGRESS',
  'Ana Martínez', '2026-01-02T08:30:00Z',
  '2026-01-02T08:30:00Z', '2026-01-02T12:00:00Z'
);

-- GURABO - APPROVED
INSERT INTO inventory_month_02205af0 (
  id, plant_id, plant_name, month, year, status,
  started_by, started_at,
  submitted_by, submitted_at,
  approved_by, approved_at,
  created_at, updated_at
) VALUES (
  'inv_gurabo_jan_2026',
  'gurabo', 'GURABO', 'Enero', 2026, 'APPROVED',
  'Luis Torres', '2026-01-02T08:15:00Z',
  'Luis Torres', '2026-01-03T18:00:00Z',
  'Roberto Díaz', '2026-01-04T10:30:00Z',
  '2026-01-02T08:15:00Z', '2026-01-04T10:30:00Z'
);

-- VEGA BAJA - SUBMITTED (rechazado una vez antes)
INSERT INTO inventory_month_02205af0 (
  id, plant_id, plant_name, month, year, status,
  started_by, started_at,
  submitted_by, submitted_at,
  rejected_by, rejected_at, rejection_notes,
  created_at, updated_at
) VALUES (
  'inv_vegabaja_jan_2026',
  'vegabaja', 'VEGA BAJA', 'Enero', 2026, 'SUBMITTED',
  'Sofía Ramírez', '2026-01-02T07:30:00Z',
  'Sofía Ramírez', '2026-01-05T15:00:00Z',
  'María González', '2026-01-04T11:00:00Z', 'Falta completar lecturas de Utilities. Por favor revisar y reenviar.',
  '2026-01-02T07:30:00Z', '2026-01-05T15:00:00Z'
);

-- HUMACAO - IN_PROGRESS (recién iniciado)
INSERT INTO inventory_month_02205af0 (
  id, plant_id, plant_name, month, year, status,
  started_by, started_at,
  created_at, updated_at
) VALUES (
  'inv_humacao_jan_2026',
  'humacao', 'HUMACAO', 'Enero', 2026, 'IN_PROGRESS',
  'Miguel Ortiz', '2026-01-02T09:00:00Z',
  '2026-01-02T09:00:00Z', '2026-01-02T09:30:00Z'
);

-- ============================================================================
-- 2. AGGREGATES_ENTRIES - Agregados
-- ============================================================================

-- CAROLINA - Completo (APPROVED)
INSERT INTO aggregates_entries_02205af0 (inventory_month_id, item_name, quantity_tons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_carolina_jan_2026', 'Arena Manufacturada', 850.5, 18.50, 'photo_carolina_arena_jan.jpg', 'Inventario verificado', 'Juan Pérez', '2026-01-02T09:30:00Z'),
('inv_carolina_jan_2026', 'Piedra #8', 620.0, 22.75, 'photo_carolina_piedra8_jan.jpg', 'Stock normal', 'Juan Pérez', '2026-01-02T09:45:00Z'),
('inv_carolina_jan_2026', 'Piedra #67', 480.25, 24.00, 'photo_carolina_piedra67_jan.jpg', 'Recién recibido lote nuevo', 'Juan Pérez', '2026-01-02T10:00:00Z'),
('inv_carolina_jan_2026', 'Arena Natural', 310.0, 16.25, 'photo_carolina_arena_nat_jan.jpg', NULL, 'Juan Pérez', '2026-01-02T10:15:00Z');

-- CEIBA - Completo (SUBMITTED)
INSERT INTO aggregates_entries_02205af0 (inventory_month_id, item_name, quantity_tons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_ceiba_jan_2026', 'Arena Manufacturada', 720.75, 18.50, 'photo_ceiba_arena_jan.jpg', NULL, 'Carlos Rodríguez', '2026-01-02T08:30:00Z'),
('inv_ceiba_jan_2026', 'Piedra #8', 550.0, 22.75, 'photo_ceiba_piedra8_jan.jpg', 'Verificado con pala mecánica', 'Carlos Rodríguez', '2026-01-02T08:45:00Z'),
('inv_ceiba_jan_2026', 'Piedra #67', 390.5, 24.00, 'photo_ceiba_piedra67_jan.jpg', NULL, 'Carlos Rodríguez', '2026-01-02T09:00:00Z');

-- GUAYNABO - Parcial (IN_PROGRESS)
INSERT INTO aggregates_entries_02205af0 (inventory_month_id, item_name, quantity_tons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_guaynabo_jan_2026', 'Arena Manufacturada', 890.0, 18.50, 'photo_guaynabo_arena_jan.jpg', 'Primer conteo', 'Ana Martínez', '2026-01-02T09:00:00Z'),
('inv_guaynabo_jan_2026', 'Piedra #8', 640.25, 22.75, 'photo_guaynabo_piedra8_jan.jpg', NULL, 'Ana Martínez', '2026-01-02T09:20:00Z');

-- GURABO - Completo (APPROVED)
INSERT INTO aggregates_entries_02205af0 (inventory_month_id, item_name, quantity_tons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_gurabo_jan_2026', 'Arena Manufacturada', 960.5, 18.50, 'photo_gurabo_arena_jan.jpg', 'Inventario completo', 'Luis Torres', '2026-01-02T09:30:00Z'),
('inv_gurabo_jan_2026', 'Piedra #8', 710.0, 22.75, 'photo_gurabo_piedra8_jan.jpg', NULL, 'Luis Torres', '2026-01-02T09:50:00Z'),
('inv_gurabo_jan_2026', 'Piedra #67', 580.75, 24.00, 'photo_gurabo_piedra67_jan.jpg', 'Stock alto este mes', 'Luis Torres', '2026-01-02T10:10:00Z'),
('inv_gurabo_jan_2026', 'Arena Natural', 420.0, 16.25, 'photo_gurabo_arena_nat_jan.jpg', NULL, 'Luis Torres', '2026-01-02T10:30:00Z');

-- VEGA BAJA - Completo (SUBMITTED, rechazado antes)
INSERT INTO aggregates_entries_02205af0 (inventory_month_id, item_name, quantity_tons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_vegabaja_jan_2026', 'Arena Manufacturada', 780.25, 18.50, 'photo_vegabaja_arena_jan.jpg', 'Revisado tras rechazo', 'Sofía Ramírez', '2026-01-02T08:15:00Z'),
('inv_vegabaja_jan_2026', 'Piedra #8', 590.0, 22.75, 'photo_vegabaja_piedra8_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T08:35:00Z'),
('inv_vegabaja_jan_2026', 'Piedra #67', 450.5, 24.00, 'photo_vegabaja_piedra67_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T08:55:00Z');

-- HUMACAO - Solo una entrada (recién iniciado)
INSERT INTO aggregates_entries_02205af0 (inventory_month_id, item_name, quantity_tons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_humacao_jan_2026', 'Arena Manufacturada', 680.0, 18.50, 'photo_humacao_arena_jan.jpg', 'Primer conteo del mes', 'Miguel Ortiz', '2026-01-02T09:30:00Z');

-- ============================================================================
-- 3. SILOS_ENTRIES - Silos
-- ============================================================================

-- CAROLINA - Completo (4 silos) - APPROVED
INSERT INTO silos_entries_02205af0 (inventory_month_id, silo_name, cement_type, quantity_tons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_carolina_jan_2026', 'Silo A', 'Tipo I', 145.5, 125.00, 'photo_carolina_siloA_jan.jpg', 'Nivel 75%', 'Juan Pérez', '2026-01-02T10:30:00Z'),
('inv_carolina_jan_2026', 'Silo B', 'Tipo II', 132.0, 128.50, 'photo_carolina_siloB_jan.jpg', 'Nivel 68%', 'Juan Pérez', '2026-01-02T10:45:00Z'),
('inv_carolina_jan_2026', 'Silo C', 'Tipo III', 118.75, 132.00, 'photo_carolina_siloC_jan.jpg', 'Nivel 62%', 'Juan Pérez', '2026-01-02T11:00:00Z'),
('inv_carolina_jan_2026', 'Silo D', 'Tipo I', 156.25, 125.00, 'photo_carolina_siloD_jan.jpg', 'Nivel 81%', 'Juan Pérez', '2026-01-02T11:15:00Z');

-- CEIBA - Completo (3 silos) - SUBMITTED
INSERT INTO silos_entries_02205af0 (inventory_month_id, silo_name, cement_type, quantity_tons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_ceiba_jan_2026', 'Silo Norte', 'Tipo I', 138.0, 125.00, 'photo_ceiba_siloN_jan.jpg', 'Recién recargado', 'Carlos Rodríguez', '2026-01-02T09:30:00Z'),
('inv_ceiba_jan_2026', 'Silo Sur', 'Tipo II', 124.5, 128.50, 'photo_ceiba_siloS_jan.jpg', NULL, 'Carlos Rodríguez', '2026-01-02T09:45:00Z'),
('inv_ceiba_jan_2026', 'Silo Este', 'Tipo I', 142.75, 125.00, 'photo_ceiba_siloE_jan.jpg', NULL, 'Carlos Rodríguez', '2026-01-02T10:00:00Z');

-- GUAYNABO - Parcial (solo 2 de 3) - IN_PROGRESS
INSERT INTO silos_entries_02205af0 (inventory_month_id, silo_name, cement_type, quantity_tons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_guaynabo_jan_2026', 'Silo 1', 'Tipo I', 150.0, 125.00, 'photo_guaynabo_silo1_jan.jpg', NULL, 'Ana Martínez', '2026-01-02T10:00:00Z'),
('inv_guaynabo_jan_2026', 'Silo 2', 'Tipo II', 135.25, 128.50, 'photo_guaynabo_silo2_jan.jpg', NULL, 'Ana Martínez', '2026-01-02T10:20:00Z');

-- GURABO - Completo (5 silos) - APPROVED
INSERT INTO silos_entries_02205af0 (inventory_month_id, silo_name, cement_type, quantity_tons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_gurabo_jan_2026', 'Silo Alpha', 'Tipo I', 165.5, 125.00, 'photo_gurabo_siloA_jan.jpg', 'Máxima capacidad', 'Luis Torres', '2026-01-02T11:00:00Z'),
('inv_gurabo_jan_2026', 'Silo Beta', 'Tipo II', 148.0, 128.50, 'photo_gurabo_siloB_jan.jpg', NULL, 'Luis Torres', '2026-01-02T11:15:00Z'),
('inv_gurabo_jan_2026', 'Silo Gamma', 'Tipo III', 128.75, 132.00, 'photo_gurabo_siloG_jan.jpg', NULL, 'Luis Torres', '2026-01-02T11:30:00Z'),
('inv_gurabo_jan_2026', 'Silo Delta', 'Tipo I', 172.0, 125.00, 'photo_gurabo_siloD_jan.jpg', 'Nuevo récord', 'Luis Torres', '2026-01-02T11:45:00Z'),
('inv_gurabo_jan_2026', 'Silo Epsilon', 'Tipo II', 155.25, 128.50, 'photo_gurabo_siloE_jan.jpg', NULL, 'Luis Torres', '2026-01-02T12:00:00Z');

-- VEGA BAJA - Completo (4 silos) - SUBMITTED
INSERT INTO silos_entries_02205af0 (inventory_month_id, silo_name, cement_type, quantity_tons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_vegabaja_jan_2026', 'Silo Principal', 'Tipo I', 158.5, 125.00, 'photo_vegabaja_siloP_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T09:30:00Z'),
('inv_vegabaja_jan_2026', 'Silo Secundario', 'Tipo II', 142.0, 128.50, 'photo_vegabaja_siloS_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T09:50:00Z'),
('inv_vegabaja_jan_2026', 'Silo Auxiliar 1', 'Tipo I', 135.75, 125.00, 'photo_vegabaja_siloA1_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T10:10:00Z'),
('inv_vegabaja_jan_2026', 'Silo Auxiliar 2', 'Tipo III', 122.0, 132.00, 'photo_vegabaja_siloA2_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T10:30:00Z');

-- HUMACAO - Sin datos aún (recién iniciado)

-- ============================================================================
-- 4. ADDITIVES_ENTRIES - Aditivos
-- ============================================================================

-- CAROLINA - Completo - APPROVED
INSERT INTO additives_entries_02205af0 (inventory_month_id, product_name, quantity_gallons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_carolina_jan_2026', 'Plastificante WR-91', 450.5, 8.75, 'photo_carolina_plast_jan.jpg', NULL, 'Juan Pérez', '2026-01-02T11:30:00Z'),
('inv_carolina_jan_2026', 'Retardante RT-55', 280.0, 12.50, 'photo_carolina_retard_jan.jpg', 'Stock normal', 'Juan Pérez', '2026-01-02T11:45:00Z'),
('inv_carolina_jan_2026', 'Acelerante AC-33', 185.25, 15.00, 'photo_carolina_aceler_jan.jpg', NULL, 'Juan Pérez', '2026-01-02T12:00:00Z'),
('inv_carolina_jan_2026', 'Reductor de Agua HE-200', 520.0, 10.25, 'photo_carolina_reductor_jan.jpg', 'Recién recibido', 'Juan Pérez', '2026-01-02T12:15:00Z');

-- CEIBA - Completo - SUBMITTED
INSERT INTO additives_entries_02205af0 (inventory_month_id, product_name, quantity_gallons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_ceiba_jan_2026', 'Plastificante WR-91', 380.75, 8.75, 'photo_ceiba_plast_jan.jpg', NULL, 'Carlos Rodríguez', '2026-01-02T10:30:00Z'),
('inv_ceiba_jan_2026', 'Retardante RT-55', 245.0, 12.50, 'photo_ceiba_retard_jan.jpg', NULL, 'Carlos Rodríguez', '2026-01-02T10:45:00Z'),
('inv_ceiba_jan_2026', 'Acelerante AC-33', 165.5, 15.00, 'photo_ceiba_aceler_jan.jpg', NULL, 'Carlos Rodríguez', '2026-01-02T11:00:00Z');

-- GUAYNABO - Parcial - IN_PROGRESS
INSERT INTO additives_entries_02205af0 (inventory_month_id, product_name, quantity_gallons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_guaynabo_jan_2026', 'Plastificante WR-91', 420.0, 8.75, 'photo_guaynabo_plast_jan.jpg', NULL, 'Ana Martínez', '2026-01-02T10:45:00Z');

-- GURABO - Completo - APPROVED
INSERT INTO additives_entries_02205af0 (inventory_month_id, product_name, quantity_gallons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_gurabo_jan_2026', 'Plastificante WR-91', 495.25, 8.75, 'photo_gurabo_plast_jan.jpg', NULL, 'Luis Torres', '2026-01-02T12:30:00Z'),
('inv_gurabo_jan_2026', 'Retardante RT-55', 310.5, 12.50, 'photo_gurabo_retard_jan.jpg', 'Nivel óptimo', 'Luis Torres', '2026-01-02T12:45:00Z'),
('inv_gurabo_jan_2026', 'Acelerante AC-33', 220.0, 15.00, 'photo_gurabo_aceler_jan.jpg', NULL, 'Luis Torres', '2026-01-02T13:00:00Z'),
('inv_gurabo_jan_2026', 'Reductor de Agua HE-200', 580.75, 10.25, 'photo_gurabo_reductor_jan.jpg', 'Stock alto', 'Luis Torres', '2026-01-02T13:15:00Z'),
('inv_gurabo_jan_2026', 'Impermeabilizante IM-77', 155.0, 18.00, 'photo_gurabo_imper_jan.jpg', NULL, 'Luis Torres', '2026-01-02T13:30:00Z');

-- VEGA BAJA - Completo - SUBMITTED
INSERT INTO additives_entries_02205af0 (inventory_month_id, product_name, quantity_gallons, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_vegabaja_jan_2026', 'Plastificante WR-91', 410.0, 8.75, 'photo_vegabaja_plast_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T11:00:00Z'),
('inv_vegabaja_jan_2026', 'Retardante RT-55', 265.25, 12.50, 'photo_vegabaja_retard_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T11:20:00Z'),
('inv_vegabaja_jan_2026', 'Acelerante AC-33', 175.5, 15.00, 'photo_vegabaja_aceler_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T11:40:00Z');

-- HUMACAO - Sin datos aún

-- ============================================================================
-- 5. DIESEL_ENTRIES - Diesel
-- ============================================================================

-- CAROLINA - Completo - APPROVED
INSERT INTO diesel_entries_02205af0 (
  inventory_month_id, initial_reading, final_reading, total_gallons_consumed,
  receipts_gallons, unit_price_per_gallon, evidence_photo, notes,
  captured_by, captured_at
) VALUES (
  'inv_carolina_jan_2026', 8500.50, 12850.75, 4350.25,
  4500, 3.45, 'photo_carolina_diesel_jan.jpg', 'Consumo normal del mes',
  'Juan Pérez', '2026-01-02T12:30:00Z'
);

-- CEIBA - Completo - SUBMITTED
INSERT INTO diesel_entries_02205af0 (
  inventory_month_id, initial_reading, final_reading, total_gallons_consumed,
  receipts_gallons, unit_price_per_gallon, evidence_photo, notes,
  captured_by, captured_at
) VALUES (
  'inv_ceiba_jan_2026', 6780.25, 10420.50, 3640.25,
  3700, 3.45, 'photo_ceiba_diesel_jan.jpg', 'Verificado con recibos',
  'Carlos Rodríguez', '2026-01-02T11:30:00Z'
);

-- GUAYNABO - Sin datos aún - IN_PROGRESS

-- GURABO - Completo - APPROVED
INSERT INTO diesel_entries_02205af0 (
  inventory_month_id, initial_reading, final_reading, total_gallons_consumed,
  receipts_gallons, unit_price_per_gallon, evidence_photo, notes,
  captured_by, captured_at
) VALUES (
  'inv_gurabo_jan_2026', 9200.00, 14125.75, 4925.75,
  5000, 3.45, 'photo_gurabo_diesel_jan.jpg', 'Mes de alta producción',
  'Luis Torres', '2026-01-02T13:45:00Z'
);

-- VEGA BAJA - Completo - SUBMITTED
INSERT INTO diesel_entries_02205af0 (
  inventory_month_id, initial_reading, final_reading, total_gallons_consumed,
  receipts_gallons, unit_price_per_gallon, evidence_photo, notes,
  captured_by, captured_at
) VALUES (
  'inv_vegabaja_jan_2026', 7350.50, 11080.25, 3729.75,
  3800, 3.45, 'photo_vegabaja_diesel_jan.jpg', 'Consumo dentro de rango',
  'Sofía Ramírez', '2026-01-02T12:00:00Z'
);

-- HUMACAO - Sin datos aún

-- ============================================================================
-- 6. PRODUCTS_ENTRIES - Productos Terminados
-- ============================================================================

-- CAROLINA - Completo - APPROVED
INSERT INTO products_entries_02205af0 (inventory_month_id, product_name, quantity_units, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_carolina_jan_2026', 'Concreto 3000 PSI', 1850.5, 95.00, 'photo_carolina_3000_jan.jpg', 'Producción estándar', 'Juan Pérez', '2026-01-02T13:00:00Z'),
('inv_carolina_jan_2026', 'Concreto 4000 PSI', 1420.0, 105.00, 'photo_carolina_4000_jan.jpg', NULL, 'Juan Pérez', '2026-01-02T13:15:00Z'),
('inv_carolina_jan_2026', 'Concreto 5000 PSI', 980.25, 125.00, 'photo_carolina_5000_jan.jpg', 'Alta demanda', 'Juan Pérez', '2026-01-02T13:30:00Z'),
('inv_carolina_jan_2026', 'Bloques 6"', 5600, 1.25, 'photo_carolina_bloq6_jan.jpg', NULL, 'Juan Pérez', '2026-01-02T13:45:00Z'),
('inv_carolina_jan_2026', 'Bloques 8"', 4200, 1.50, 'photo_carolina_bloq8_jan.jpg', NULL, 'Juan Pérez', '2026-01-02T14:00:00Z');

-- CEIBA - Completo - SUBMITTED
INSERT INTO products_entries_02205af0 (inventory_month_id, product_name, quantity_units, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_ceiba_jan_2026', 'Concreto 3000 PSI', 1620.75, 95.00, 'photo_ceiba_3000_jan.jpg', NULL, 'Carlos Rodríguez', '2026-01-02T12:00:00Z'),
('inv_ceiba_jan_2026', 'Concreto 4000 PSI', 1280.0, 105.00, 'photo_ceiba_4000_jan.jpg', NULL, 'Carlos Rodríguez', '2026-01-02T12:15:00Z'),
('inv_ceiba_jan_2026', 'Bloques 6"', 4800, 1.25, 'photo_ceiba_bloq6_jan.jpg', NULL, 'Carlos Rodríguez', '2026-01-02T12:30:00Z');

-- GUAYNABO - Sin datos aún - IN_PROGRESS

-- GURABO - Completo - APPROVED
INSERT INTO products_entries_02205af0 (inventory_month_id, product_name, quantity_units, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_gurabo_jan_2026', 'Concreto 3000 PSI', 2100.5, 95.00, 'photo_gurabo_3000_jan.jpg', 'Récord mensual', 'Luis Torres', '2026-01-02T14:00:00Z'),
('inv_gurabo_jan_2026', 'Concreto 4000 PSI', 1680.25, 105.00, 'photo_gurabo_4000_jan.jpg', NULL, 'Luis Torres', '2026-01-02T14:15:00Z'),
('inv_gurabo_jan_2026', 'Concreto 5000 PSI', 1250.0, 125.00, 'photo_gurabo_5000_jan.jpg', 'Buena producción', 'Luis Torres', '2026-01-02T14:30:00Z'),
('inv_gurabo_jan_2026', 'Bloques 6"', 6200, 1.25, 'photo_gurabo_bloq6_jan.jpg', NULL, 'Luis Torres', '2026-01-02T14:45:00Z'),
('inv_gurabo_jan_2026', 'Bloques 8"', 4800, 1.50, 'photo_gurabo_bloq8_jan.jpg', NULL, 'Luis Torres', '2026-01-02T15:00:00Z'),
('inv_gurabo_jan_2026', 'Adoquines', 3500, 2.00, 'photo_gurabo_adoq_jan.jpg', 'Nuevo producto', 'Luis Torres', '2026-01-02T15:15:00Z');

-- VEGA BAJA - Completo - SUBMITTED
INSERT INTO products_entries_02205af0 (inventory_month_id, product_name, quantity_units, unit_price, evidence_photo, notes, captured_by, captured_at) VALUES
('inv_vegabaja_jan_2026', 'Concreto 3000 PSI', 1750.0, 95.00, 'photo_vegabaja_3000_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T12:30:00Z'),
('inv_vegabaja_jan_2026', 'Concreto 4000 PSI', 1350.75, 105.00, 'photo_vegabaja_4000_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T12:45:00Z'),
('inv_vegabaja_jan_2026', 'Bloques 6"', 5000, 1.25, 'photo_vegabaja_bloq6_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T13:00:00Z'),
('inv_vegabaja_jan_2026', 'Bloques 8"', 3800, 1.50, 'photo_vegabaja_bloq8_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T13:15:00Z');

-- HUMACAO - Sin datos aún

-- ============================================================================
-- 7. UTILITIES_ENTRIES - Servicios (Agua y Electricidad)
-- ============================================================================

-- CAROLINA - Completo - APPROVED
INSERT INTO utilities_entries_02205af0 (
  inventory_month_id, utility_type, meter_number, previous_reading, current_reading,
  consumption, unit_price, evidence_photo, notes, captured_by, captured_at
) VALUES
('inv_carolina_jan_2026', 'AGUA', 'WAT-CAR-001', 45820.5, 48950.25, 3129.75, 4.25, 'photo_carolina_agua_jan.jpg', 'Lectura verificada', 'Juan Pérez', '2026-01-02T14:15:00Z'),
('inv_carolina_jan_2026', 'ELECTRICIDAD', 'ELC-CAR-001', 128450.0, 136780.5, 8330.5, 0.18, 'photo_carolina_elec_jan.jpg', 'Consumo normal', 'Juan Pérez', '2026-01-02T14:30:00Z');

-- CEIBA - Completo - SUBMITTED
INSERT INTO utilities_entries_02205af0 (
  inventory_month_id, utility_type, meter_number, previous_reading, current_reading,
  consumption, unit_price, evidence_photo, notes, captured_by, captured_at
) VALUES
('inv_ceiba_jan_2026', 'AGUA', 'WAT-CEI-001', 38560.25, 41280.75, 2720.5, 4.25, 'photo_ceiba_agua_jan.jpg', NULL, 'Carlos Rodríguez', '2026-01-02T13:00:00Z'),
('inv_ceiba_jan_2026', 'ELECTRICIDAD', 'ELC-CEI-001', 105280.0, 112450.75, 7170.75, 0.18, 'photo_ceiba_elec_jan.jpg', NULL, 'Carlos Rodríguez', '2026-01-02T13:15:00Z');

-- GUAYNABO - Sin datos aún - IN_PROGRESS

-- GURABO - Completo - APPROVED
INSERT INTO utilities_entries_02205af0 (
  inventory_month_id, utility_type, meter_number, previous_reading, current_reading,
  consumption, unit_price, evidence_photo, notes, captured_by, captured_at
) VALUES
('inv_gurabo_jan_2026', 'AGUA', 'WAT-GUR-001', 52180.0, 55680.5, 3500.5, 4.25, 'photo_gurabo_agua_jan.jpg', 'Mayor consumo por producción', 'Luis Torres', '2026-01-02T15:30:00Z'),
('inv_gurabo_jan_2026', 'ELECTRICIDAD', 'ELC-GUR-001', 145620.5, 155280.25, 9659.75, 0.18, 'photo_gurabo_elec_jan.jpg', 'Mes de alta demanda', 'Luis Torres', '2026-01-02T15:45:00Z');

-- VEGA BAJA - INCOMPLETO (sin electricidad) - SUBMITTED (rechazado antes por esto)
INSERT INTO utilities_entries_02205af0 (
  inventory_month_id, utility_type, meter_number, previous_reading, current_reading,
  consumption, unit_price, evidence_photo, notes, captured_by, captured_at
) VALUES
('inv_vegabaja_jan_2026', 'AGUA', 'WAT-VB-001', 41250.75, 43980.5, 2729.75, 4.25, 'photo_vegabaja_agua_jan.jpg', NULL, 'Sofía Ramírez', '2026-01-02T13:45:00Z'),
('inv_vegabaja_jan_2026', 'ELECTRICIDAD', 'ELC-VB-001', 118950.0, 126780.25, 7830.25, 0.18, 'photo_vegabaja_elec_jan.jpg', 'Completado tras rechazo', 'Sofía Ramírez', '2026-01-05T14:30:00Z');

-- HUMACAO - Sin datos aún

-- ============================================================================
-- 8. PETTY_CASH_ENTRIES - Petty Cash
-- ============================================================================

-- Montos de Petty Cash por planta (según configuración):
-- CAROLINA: $1,200.00
-- CEIBA: $1,000.00
-- GUAYNABO: $1,500.00
-- GURABO: $1,800.00
-- VEGA BAJA: $1,100.00
-- HUMACAO: $900.00

-- CAROLINA - Completo - APPROVED
INSERT INTO petty_cash_entries_02205af0 (
  inventory_month_id, initial_balance, receipts_total, expenses_total, final_balance,
  discrepancy, evidence_photo, notes, captured_by, captured_at
) VALUES (
  'inv_carolina_jan_2026', 1200.00, 850.50, 875.25, 1175.25,
  -24.75, 'photo_carolina_petty_jan.jpg', 'Pequeña diferencia en cambio de efectivo',
  'Juan Pérez', '2026-01-02T14:45:00Z'
);

-- CEIBA - Completo - SUBMITTED
INSERT INTO petty_cash_entries_02205af0 (
  inventory_month_id, initial_balance, receipts_total, expenses_total, final_balance,
  discrepancy, evidence_photo, notes, captured_by, captured_at
) VALUES (
  'inv_ceiba_jan_2026', 1000.00, 720.00, 695.50, 1024.50,
  24.50, 'photo_ceiba_petty_jan.jpg', 'Cuadre perfecto',
  'Carlos Rodríguez', '2026-01-02T13:30:00Z'
);

-- GUAYNABO - Sin datos aún - IN_PROGRESS

-- GURABO - Completo - APPROVED
INSERT INTO petty_cash_entries_02205af0 (
  inventory_month_id, initial_balance, receipts_total, expenses_total, final_balance,
  discrepancy, evidence_photo, notes, captured_by, captured_at
) VALUES (
  'inv_gurabo_jan_2026', 1800.00, 1250.75, 1280.50, 1770.25,
  -29.75, 'photo_gurabo_petty_jan.jpg', 'Ajuste menor por redondeo',
  'Luis Torres', '2026-01-02T16:00:00Z'
);

-- VEGA BAJA - Completo - SUBMITTED
INSERT INTO petty_cash_entries_02205af0 (
  inventory_month_id, initial_balance, receipts_total, expenses_total, final_balance,
  discrepancy, evidence_photo, notes, captured_by, captured_at
) VALUES (
  'inv_vegabaja_jan_2026', 1100.00, 890.25, 910.50, 1079.75,
  -20.25, 'photo_vegabaja_petty_jan.jpg', 'Diferencia mínima aceptable',
  'Sofía Ramírez', '2026-01-02T14:00:00Z'
);

-- HUMACAO - Sin datos aún

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

-- RESUMEN DE DATOS GENERADOS:
-- ================================
-- CAROLINA (APPROVED):
--   ✅ Aggregates: 4 entries
--   ✅ Silos: 4 entries
--   ✅ Additives: 4 entries
--   ✅ Diesel: Completo
--   ✅ Products: 5 entries
--   ✅ Utilities: 2 entries (Agua + Electricidad)
--   ✅ Petty Cash: Completo
--   STATUS: APPROVED por María González

-- CEIBA (SUBMITTED):
--   ✅ Aggregates: 3 entries
--   ✅ Silos: 3 entries
--   ✅ Additives: 3 entries
--   ✅ Diesel: Completo
--   ✅ Products: 3 entries
--   ✅ Utilities: 2 entries
--   ✅ Petty Cash: Completo
--   STATUS: SUBMITTED - Esperando aprobación

-- GUAYNABO (IN_PROGRESS - Parcialmente completado):
--   ✅ Aggregates: 2 entries (parcial)
--   ✅ Silos: 2 entries (parcial)
--   ✅ Additives: 1 entry (parcial)
--   ❌ Diesel: Sin datos
--   ❌ Products: Sin datos
--   ❌ Utilities: Sin datos
--   ❌ Petty Cash: Sin datos
--   STATUS: IN_PROGRESS - Ana trabajando en ello

-- GURABO (APPROVED):
--   ✅ Aggregates: 4 entries
--   ✅ Silos: 5 entries
--   ✅ Additives: 5 entries
--   ✅ Diesel: Completo
--   ✅ Products: 6 entries
--   ✅ Utilities: 2 entries
--   ✅ Petty Cash: Completo
--   STATUS: APPROVED por Roberto Díaz

-- VEGA BAJA (SUBMITTED - Rechazado una vez antes):
--   ✅ Aggregates: 3 entries
--   ✅ Silos: 4 entries
--   ✅ Additives: 3 entries
--   ✅ Diesel: Completo
--   ✅ Products: 4 entries
--   ✅ Utilities: 2 entries (completado tras rechazo)
--   ✅ Petty Cash: Completo
--   STATUS: SUBMITTED - Re-enviado tras completar Utilities
--   NOTA: Fue rechazado el 04/01 por falta de Utilities, completado el 05/01

-- HUMACAO (IN_PROGRESS - Recién iniciado):
--   ✅ Aggregates: 1 entry
--   ❌ Silos: Sin datos
--   ❌ Additives: Sin datos
--   ❌ Diesel: Sin datos
--   ❌ Products: Sin datos
--   ❌ Utilities: Sin datos
--   ❌ Petty Cash: Sin datos
--   STATUS: IN_PROGRESS - Miguel recién comenzó

-- ================================
-- CASOS DE USO CUBIERTOS:
-- ================================
-- ✅ Inventarios APROBADOS (Carolina, Gurabo)
-- ✅ Inventarios ENVIADOS esperando aprobación (Ceiba, Vega Baja)
-- ✅ Inventarios EN PROGRESO con distintos niveles de completitud (Guaynabo, Humacao)
-- ✅ Caso de RECHAZO y re-envío (Vega Baja)
-- ✅ Trazabilidad completa (quién, cuándo, notas)
-- ✅ Evidencia fotográfica en todos los campos
-- ✅ Datos realistas según configuración de cada planta
-- ✅ Discrepancias en Petty Cash (positivas y negativas)
-- ✅ Diferencias en consumo de Diesel
-- ✅ Variedad de productos y cantidades

-- ================================
-- INSTRUCCIONES DE EJECUCIÓN:
-- ================================
-- 1. Ir a Supabase Dashboard
-- 2. Seleccionar tu proyecto
-- 3. Ir a SQL Editor
-- 4. Copiar y pegar este script completo
-- 5. Click en "Run" o "Execute"
-- 6. Verificar que todas las inserciones fueron exitosas
-- 7. Refrescar la aplicación PROMIX para ver los datos

-- ================================
-- VERIFICACIÓN POST-EJECUCIÓN:
-- ================================
-- SELECT * FROM inventory_month_02205af0 WHERE year = 2026 AND month = 'Enero';
-- SELECT COUNT(*) FROM aggregates_entries_02205af0;
-- SELECT COUNT(*) FROM silos_entries_02205af0;
-- SELECT COUNT(*) FROM additives_entries_02205af0;
-- SELECT COUNT(*) FROM diesel_entries_02205af0;
-- SELECT COUNT(*) FROM products_entries_02205af0;
-- SELECT COUNT(*) FROM utilities_entries_02205af0;
-- SELECT COUNT(*) FROM petty_cash_entries_02205af0;
