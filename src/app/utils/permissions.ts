export type UserRole = 'plant_manager' | 'operations_manager' | 'admin' | 'super_admin';

export function isPlantManagerLike(role?: string | null): role is 'plant_manager' | 'operations_manager' {
  return role === 'plant_manager' || role === 'operations_manager';
}

export function hasGlobalPlantAccess(role?: string | null): boolean {
  return role === 'operations_manager' || role === 'admin' || role === 'super_admin';
}

export function canManagePlantManagers(role?: string | null): boolean {
  return role === 'operations_manager' || role === 'admin' || role === 'super_admin';
}

export function canManagePlantConfiguration(role?: string | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function canAccessAudit(role?: string | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function canAccessPhotosReport(role?: string | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function canManageModules(role?: string | null): boolean {
  return role === 'super_admin';
}

export function canApproveInventory(role?: string | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function canDeleteUsers(role?: string | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function getRoleLabelKey(role?: string | null): string {
  if (role === 'super_admin') return 'role.superAdmin';
  if (role === 'admin') return 'role.admin';
  if (role === 'operations_manager') return 'role.operationsManager';
  return 'role.plantManager';
}
