-- ============================================================================
-- SCRIPT DE VERIFICACIÓN - DATOS DUMMY ENERO 2026
-- ============================================================================
-- Ejecutar después de cargar DUMMY_DATA_ENERO_2026.sql para verificar
-- que todos los datos se insertaron correctamente
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR INVENTORY_MONTH
-- ============================================================================

SELECT 
  plant_name,
  status,
  started_by,
  submitted_at::text as submitted_at,
  COALESCE(approved_by, 'N/A') as approved_by
FROM inventory_month_02205af0 
WHERE year = 2026 AND month = 'Enero'
ORDER BY plant_name;

-- ============================================================================
-- 2. CONTEO POR TABLA
-- ============================================================================

SELECT 
  'inventory_month_02205af0' as tabla,
  COUNT(*)::text as total
FROM inventory_month_02205af0 
WHERE year = 2026 AND month = 'Enero'
UNION ALL
SELECT 
  'aggregates_entries_02205af0',
  COUNT(*)::text
FROM aggregates_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026'
UNION ALL
SELECT 
  'silos_entries_02205af0',
  COUNT(*)::text
FROM silos_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026'
UNION ALL
SELECT 
  'additives_entries_02205af0',
  COUNT(*)::text
FROM additives_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026'
UNION ALL
SELECT 
  'diesel_entries_02205af0',
  COUNT(*)::text
FROM diesel_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026'
UNION ALL
SELECT 
  'products_entries_02205af0',
  COUNT(*)::text
FROM products_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026'
UNION ALL
SELECT 
  'utilities_entries_02205af0',
  COUNT(*)::text
FROM utilities_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026'
UNION ALL
SELECT 
  'petty_cash_entries_02205af0',
  COUNT(*)::text
FROM petty_cash_entries_02205af0 
WHERE inventory_month_id LIKE 'inv_%_jan_2026';

-- ============================================================================
-- 3. DETALLE POR PLANTA
-- ============================================================================

SELECT 
  im.plant_name as plant,
  COALESCE((SELECT COUNT(*)::text FROM aggregates_entries_02205af0 WHERE inventory_month_id = im.id), '0') as aggregates,
  COALESCE((SELECT COUNT(*)::text FROM silos_entries_02205af0 WHERE inventory_month_id = im.id), '0') as silos,
  COALESCE((SELECT COUNT(*)::text FROM additives_entries_02205af0 WHERE inventory_month_id = im.id), '0') as additives,
  COALESCE((SELECT COUNT(*)::text FROM diesel_entries_02205af0 WHERE inventory_month_id = im.id), '0') as diesel,
  COALESCE((SELECT COUNT(*)::text FROM products_entries_02205af0 WHERE inventory_month_id = im.id), '0') as products,
  COALESCE((SELECT COUNT(*)::text FROM utilities_entries_02205af0 WHERE inventory_month_id = im.id), '0') as utilities,
  COALESCE((SELECT COUNT(*)::text FROM petty_cash_entries_02205af0 WHERE inventory_month_id = im.id), '0') as petty_cash,
  im.status
FROM inventory_month_02205af0 im
WHERE im.year = 2026 AND im.month = 'Enero'
ORDER BY im.plant_name;

-- ============================================================================
-- 4. VERIFICAR INVENTARIOS APROBADOS
-- ============================================================================

SELECT 
  plant_name,
  COALESCE(approved_by, 'N/A') as approved_by,
  COALESCE(approved_at::text, 'N/A') as approved_at
FROM inventory_month_02205af0 
WHERE year = 2026 AND month = 'Enero' AND status = 'APPROVED'
ORDER BY plant_name;

-- ============================================================================
-- 5. VERIFICAR INVENTARIOS SUBMITTED (Esperando aprobación)
-- ============================================================================

SELECT 
  plant_name,
  submitted_by,
  submitted_at::text as submitted_at,
  COALESCE(rejection_notes, 'N/A') as notes
FROM inventory_month_02205af0 
WHERE year = 2026 AND month = 'Enero' AND status = 'SUBMITTED'
ORDER BY plant_name;

-- ============================================================================
-- 6. VERIFICAR INVENTARIOS IN_PROGRESS
-- ============================================================================

SELECT 
  plant_name,
  started_by,
  started_at::text as started_at
FROM inventory_month_02205af0 
WHERE year = 2026 AND month = 'Enero' AND status = 'IN_PROGRESS'
ORDER BY plant_name;

-- ============================================================================
-- 7. VERIFICAR CASO DE RECHAZO (Vega Baja)
-- ============================================================================

SELECT 
  'Status' as field,
  status as value
FROM inventory_month_02205af0 
WHERE plant_id = 'vegabaja' AND year = 2026 AND month = 'Enero'
UNION ALL
SELECT 
  'Rejected By',
  COALESCE(rejected_by, 'N/A')
FROM inventory_month_02205af0 
WHERE plant_id = 'vegabaja' AND year = 2026 AND month = 'Enero'
UNION ALL
SELECT 
  'Rejected At',
  COALESCE(rejected_at::text, 'N/A')
FROM inventory_month_02205af0 
WHERE plant_id = 'vegabaja' AND year = 2026 AND month = 'Enero'
UNION ALL
SELECT 
  'Rejection Notes',
  COALESCE(rejection_notes, 'N/A')
FROM inventory_month_02205af0 
WHERE plant_id = 'vegabaja' AND year = 2026 AND month = 'Enero'
UNION ALL
SELECT 
  'Re-submitted At',
  COALESCE(submitted_at::text, 'N/A')
FROM inventory_month_02205af0 
WHERE plant_id = 'vegabaja' AND year = 2026 AND month = 'Enero';

-- ============================================================================
-- 8. VERIFICAR EJEMPLOS DE DATOS (Carolina - Completo)
-- ============================================================================

SELECT 
  item_name,
  quantity_tons::text as quantity_tons,
  unit_price::text as unit_price
FROM aggregates_entries_02205af0 
WHERE inventory_month_id = 'inv_carolina_jan_2026'
ORDER BY captured_at;

-- ============================================================================
-- 9. VERIFICAR SILOS - GURABO (5 silos)
-- ============================================================================

SELECT 
  silo_name,
  cement_type,
  quantity_tons::text as quantity_tons
FROM silos_entries_02205af0 
WHERE inventory_month_id = 'inv_gurabo_jan_2026'
ORDER BY captured_at;

-- ============================================================================
-- 10. VERIFICAR DIESEL - Todas las plantas completas
-- ============================================================================

SELECT 
  im.plant_name as plant,
  d.initial_reading::text as initial_reading,
  d.final_reading::text as final_reading,
  d.total_gallons_consumed::text as consumed,
  d.receipts_gallons::text as receipts,
  (d.receipts_gallons - d.total_gallons_consumed)::text as discrepancy
FROM diesel_entries_02205af0 d
JOIN inventory_month_02205af0 im ON d.inventory_month_id = im.id
WHERE im.year = 2026 AND im.month = 'Enero'
ORDER BY im.plant_name;

-- ============================================================================
-- 11. VERIFICAR PETTY CASH - Discrepancias
-- ============================================================================

SELECT 
  im.plant_name as plant,
  pc.initial_balance::text as initial_balance,
  pc.receipts_total::text as receipts,
  pc.expenses_total::text as expenses,
  pc.final_balance::text as final_balance,
  pc.discrepancy::text as discrepancy
FROM petty_cash_entries_02205af0 pc
JOIN inventory_month_02205af0 im ON pc.inventory_month_id = im.id
WHERE im.year = 2026 AND im.month = 'Enero'
ORDER BY im.plant_name;

-- ============================================================================
-- 12. RESUMEN FINAL
-- ============================================================================

SELECT 
  'Total Inventarios' as category,
  COUNT(*)::text as count,
  '100%' as percentage
FROM inventory_month_02205af0 
WHERE year = 2026 AND month = 'Enero'
UNION ALL
SELECT 
  'APPROVED',
  COUNT(*)::text,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM inventory_month_02205af0 WHERE year = 2026 AND month = 'Enero'))::text || '%'
FROM inventory_month_02205af0 
WHERE year = 2026 AND month = 'Enero' AND status = 'APPROVED'
UNION ALL
SELECT 
  'SUBMITTED',
  COUNT(*)::text,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM inventory_month_02205af0 WHERE year = 2026 AND month = 'Enero'))::text || '%'
FROM inventory_month_02205af0 
WHERE year = 2026 AND month = 'Enero' AND status = 'SUBMITTED'
UNION ALL
SELECT 
  'IN_PROGRESS',
  COUNT(*)::text,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM inventory_month_02205af0 WHERE year = 2026 AND month = 'Enero'))::text || '%'
FROM inventory_month_02205af0 
WHERE year = 2026 AND month = 'Enero' AND status = 'IN_PROGRESS';

-- ============================================================================
-- 13. VERIFICAR INTEGRIDAD REFERENCIAL
-- ============================================================================

SELECT 
  'aggregates_entries' as table_name,
  COUNT(*)::text as orphaned_count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ ERROR' END as status
FROM aggregates_entries_02205af0 a
WHERE a.inventory_month_id LIKE 'inv_%_jan_2026'
  AND NOT EXISTS (
    SELECT 1 FROM inventory_month_02205af0 im 
    WHERE im.id = a.inventory_month_id
  )
UNION ALL
SELECT 
  'silos_entries',
  COUNT(*)::text,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ ERROR' END
FROM silos_entries_02205af0 s
WHERE s.inventory_month_id LIKE 'inv_%_jan_2026'
  AND NOT EXISTS (
    SELECT 1 FROM inventory_month_02205af0 im 
    WHERE im.id = s.inventory_month_id
  )
UNION ALL
SELECT 
  'additives_entries',
  COUNT(*)::text,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ ERROR' END
FROM additives_entries_02205af0 ad
WHERE ad.inventory_month_id LIKE 'inv_%_jan_2026'
  AND NOT EXISTS (
    SELECT 1 FROM inventory_month_02205af0 im 
    WHERE im.id = ad.inventory_month_id
  );

-- ============================================================================
-- FIN DE VERIFICACIÓN
-- ============================================================================

SELECT 
  '✅ VERIFICACIÓN COMPLETADA' as status,
  NOW() as executed_at,
  'Si todos los queries devolvieron datos, la carga fue exitosa' as message;

-- ============================================================================
-- RESULTADOS ESPERADOS:
-- ============================================================================
-- Query 1: 6 inventarios (una fila por planta)
-- Query 2: Conteos por tabla (~98 registros totales)
-- Query 3: Detalle por planta con conteos individuales
-- Query 4: 2 inventarios APPROVED (Carolina, Gurabo)
-- Query 5: 2 inventarios SUBMITTED (Ceiba, Vega Baja)
-- Query 6: 2 inventarios IN_PROGRESS (Guaynabo, Humacao)
-- Query 7: Datos de rechazo de Vega Baja
-- Query 8: 4 agregados de Carolina
-- Query 9: 5 silos de Gurabo
-- Query 10: 4 diesel entries
-- Query 11: 4 petty cash entries
-- Query 12: Resumen estadístico (33% cada estado)
-- Query 13: Integridad OK (0 huérfanos)
-- ============================================================================
