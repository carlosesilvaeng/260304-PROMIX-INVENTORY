// Shared capability rules. Global read access does not grant inventory writes.
export interface InventoryActor {
  id?: string;
  role?: string;
  is_active?: boolean;
  can_capture_inventory?: boolean;
  assigned_plants?: string[];
}
export function canCaptureInventory(user?: InventoryActor | null): boolean {
  return !!user?.is_active && (['plant_manager', 'operations_manager'].includes(user.role || '') ||
    (['admin', 'super_admin'].includes(user.role || '') && user.can_capture_inventory === true));
}
export function canCapturePlantInventory(user: InventoryActor | null | undefined, plantId?: string | null, active = true): boolean {
  return !!plantId && active && canCaptureInventory(user) &&
    (user?.role === 'operations_manager' || !!user?.assigned_plants?.includes(plantId));
}
export function inventoryApprovalBlock(userId: string | undefined, month: {status?: string; submitted_by_user_id?: string | null}): string | null {
  if (month.status !== 'SUBMITTED') return null;
  if (!month.submitted_by_user_id) return 'No se pudo identificar quién envió este inventario. Debe resolverse antes de aprobarlo.';
  if (userId === month.submitted_by_user_id) return 'Otra persona debe aprobar el inventario que tú enviaste.';
  return null;
}
