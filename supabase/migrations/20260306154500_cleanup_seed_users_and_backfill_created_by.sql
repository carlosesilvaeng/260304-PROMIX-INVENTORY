BEGIN;

-- Backfill historical inventory authors when old rows were created as "system".
UPDATE public.inventory_month im
SET
  created_by = COALESCE(NULLIF(al.user_name, ''), NULLIF(al.user_email, ''), im.created_by),
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (inventory_month_id)
    inventory_month_id,
    user_name,
    user_email
  FROM public.audit_logs
  WHERE action = 'INVENTORY_STARTED'
    AND inventory_month_id IS NOT NULL
  ORDER BY inventory_month_id, timestamp ASC
) al
WHERE im.id = al.inventory_month_id
  AND COALESCE(NULLIF(im.created_by, ''), 'system') = 'system';

-- Remove known seed users from application table.
DELETE FROM public.users
WHERE email IN (
  'gerente.carolina@promix.com',
  'gerente.ceiba@promix.com',
  'gerente.guaynabo@promix.com',
  'admin@promix.com',
  'superadmin@promix.com'
);

-- Remove matching auth users if they still exist.
DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id
  FROM auth.users
  WHERE email IN (
    'gerente.carolina@promix.com',
    'gerente.ceiba@promix.com',
    'gerente.guaynabo@promix.com',
    'admin@promix.com',
    'superadmin@promix.com'
  )
);

DELETE FROM auth.users
WHERE email IN (
  'gerente.carolina@promix.com',
  'gerente.ceiba@promix.com',
  'gerente.guaynabo@promix.com',
  'admin@promix.com',
  'superadmin@promix.com'
);

COMMIT;
