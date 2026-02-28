import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-02205af0`;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================================================
// API CLIENT UTILITIES
// ============================================================================

async function apiRequest<T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<ApiResponse<T>> {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('promix_access_token') || publicAnonKey}`
      }
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();

    // Only log errors that are NOT "Month not found" (which is expected)
    if (!response.ok && data.error !== 'Month not found') {
      console.error(`API Error [${method} ${endpoint}]:`, data);
    } else if (!response.ok && data.error === 'Month not found') {
      console.log(`API Info [${method} ${endpoint}]: Month not found (expected for first-time access)`);
    }

    return data;
  } catch (error) {
    console.error(`Network error calling ${method} ${endpoint}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

// ============================================================================
// DATABASE SETUP FUNCTIONS
// ============================================================================

export async function initializeDatabase(): Promise<ApiResponse> {
  return apiRequest('/db/initialize', 'POST');
}

export async function reloadSchemaCache(): Promise<ApiResponse> {
  return apiRequest('/db/reload-cache', 'POST');
}

export async function seedPlantConfigurations(): Promise<ApiResponse> {
  return apiRequest('/db/seed', 'POST');
}

export async function clearAllConfigurations(): Promise<ApiResponse> {
  return apiRequest('/db/clear', 'POST');
}

// ============================================================================
// PLANT CONFIGURATION API
// ============================================================================

export interface PlantConfigPackage {
  plant_id: string;
  aggregates: any[];
  silos: any[];
  additives: any[];
  diesel: any;
  products: any[];
  utilities_meters: any[];
  petty_cash: any;
  calibration_curves: Record<string, any>;
}

export async function getPlantConfig(plantId: string): Promise<ApiResponse<PlantConfigPackage>> {
  return apiRequest(`/plants/${plantId}/config`);
}

// ============================================================================
// INVENTORY MONTH API
// ============================================================================

export interface InventoryMonth {
  id: string;
  plant_id: string;
  year_month: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED';
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryMonthData {
  month: InventoryMonth;
  silos: any[];
  agregados: any[];
  aditivos: any[];
  diesel: any | null;
  productos: any[];
  utilities: any[];
  meters: any[];
  pettyCash: any | null;
}

export async function createInventoryMonth(
  data: {
    plant_id: string;
    year_month: string;
    status: string;
    created_by: string;
  }
): Promise<ApiResponse<InventoryMonth>> {
  return apiRequest('/inventory/month', 'POST', data);
}

export async function getInventoryMonth(
  plantId: string,
  yearMonth: string
): Promise<ApiResponse<InventoryMonthData>> {
  return apiRequest(`/inventory/month/${plantId}/${yearMonth}`);
}

// ============================================================================
// SAVE SECTION ENTRIES API
// ============================================================================

export async function saveAggregatesEntries(
  inventoryMonthId: string,
  entries: any[]
): Promise<ApiResponse> {
  return apiRequest('/inventory/aggregates', 'POST', {
    inventory_month_id: inventoryMonthId,
    entries
  });
}

export async function saveSilosEntries(
  inventoryMonthId: string,
  entries: any[]
): Promise<ApiResponse> {
  return apiRequest('/inventory/silos', 'POST', {
    inventory_month_id: inventoryMonthId,
    entries
  });
}

export async function saveAdditivesEntries(
  inventoryMonthId: string,
  entries: any[]
): Promise<ApiResponse> {
  return apiRequest('/inventory/additives', 'POST', {
    inventory_month_id: inventoryMonthId,
    entries
  });
}

export async function saveDieselEntry(
  inventoryMonthId: string,
  entry: any
): Promise<ApiResponse> {
  return apiRequest('/inventory/diesel', 'POST', {
    inventory_month_id: inventoryMonthId,
    entry
  });
}

export async function saveProductsEntries(
  inventoryMonthId: string,
  entries: any[]
): Promise<ApiResponse> {
  return apiRequest('/inventory/products', 'POST', {
    inventory_month_id: inventoryMonthId,
    entries
  });
}

export async function saveUtilitiesEntries(
  inventoryMonthId: string,
  entries: any[]
): Promise<ApiResponse> {
  return apiRequest('/inventory/utilities', 'POST', {
    inventory_month_id: inventoryMonthId,
    entries
  });
}

export async function savePettyCashEntry(
  inventoryMonthId: string,
  entry: any
): Promise<ApiResponse> {
  return apiRequest('/inventory/petty-cash', 'POST', {
    inventory_month_id: inventoryMonthId,
    entry
  });
}

// ============================================================================
// INVENTORY SUBMISSION AND APPROVAL API
// ============================================================================

/**
 * Submits an inventory month for approval
 * Changes status from IN_PROGRESS to SUBMITTED
 * Blocks further editing
 */
export async function submitInventoryForApproval(
  inventoryMonthId: string,
  submittedBy: string
): Promise<ApiResponse<InventoryMonth>> {
  return apiRequest('/inventory/submit', 'POST', {
    inventory_month_id: inventoryMonthId,
    submitted_by: submittedBy
  });
}

/**
 * Approves a submitted inventory month
 * Changes status from SUBMITTED to APPROVED
 * Records who approved and when
 */
export async function approveInventory(
  inventoryMonthId: string,
  approvedBy: string,
  notes?: string
): Promise<ApiResponse<InventoryMonth>> {
  return apiRequest('/inventory/approve', 'POST', {
    inventory_month_id: inventoryMonthId,
    approved_by: approvedBy,
    notes
  });
}

/**
 * Rejects a submitted inventory and returns it to IN_PROGRESS
 * Allows manager to edit again
 */
export async function rejectInventory(
  inventoryMonthId: string,
  rejectedBy: string,
  rejectionNotes: string
): Promise<ApiResponse<InventoryMonth>> {
  return apiRequest('/inventory/reject', 'POST', {
    inventory_month_id: inventoryMonthId,
    rejected_by: rejectedBy,
    rejection_notes: rejectionNotes
  });
}

/**
 * Saves inventory as draft (keeps IN_PROGRESS status)
 */
export async function saveInventoryDraft(
  inventoryMonthId: string
): Promise<ApiResponse> {
  return apiRequest('/inventory/save-draft', 'POST', {
    inventory_month_id: inventoryMonthId
  });
}

// ============================================================================
// MODULE CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * Get module configuration (which modules are enabled/disabled)
 */
export async function getModuleSettings(): Promise<ApiResponse> {
  return apiRequest('/modules/config', 'GET');
}

/**
 * Update module configuration (Super Admin only)
 */
export async function updateModuleSettings(settings: any): Promise<ApiResponse> {
  return apiRequest('/modules/config', 'POST', settings);
}

// ============================================================================
// CATALOG ENDPOINTS — Materiales y Procedencias
// ============================================================================

/** Obtiene la lista de materiales activos */
export async function getMateriales(): Promise<ApiResponse> {
  return apiRequest('/catalogs/materiales', 'GET');
}

/** Crea un nuevo material en el catálogo (admin only) */
export async function createMaterial(nombre: string): Promise<ApiResponse> {
  return apiRequest('/catalogs/materiales', 'POST', { nombre });
}

/** Actualiza un material existente (admin only) */
export async function updateMaterial(
  id: string,
  data: { nombre?: string; sort_order?: number }
): Promise<ApiResponse> {
  return apiRequest(`/catalogs/materiales/${id}`, 'PUT', data);
}

/** Elimina (soft delete) un material del catálogo (admin only) */
export async function deleteMaterial(id: string): Promise<ApiResponse> {
  return apiRequest(`/catalogs/materiales/${id}`, 'DELETE');
}

/** Obtiene la lista de procedencias activas */
export async function getProcedencias(): Promise<ApiResponse> {
  return apiRequest('/catalogs/procedencias', 'GET');
}

/** Crea una nueva procedencia en el catálogo (admin only) */
export async function createProcedencia(nombre: string): Promise<ApiResponse> {
  return apiRequest('/catalogs/procedencias', 'POST', { nombre });
}

/** Actualiza una procedencia existente (admin only) */
export async function updateProcedencia(
  id: string,
  data: { nombre?: string; sort_order?: number }
): Promise<ApiResponse> {
  return apiRequest(`/catalogs/procedencias/${id}`, 'PUT', data);
}

/** Elimina (soft delete) una procedencia del catálogo (admin only) */
export async function deleteProcedencia(id: string): Promise<ApiResponse> {
  return apiRequest(`/catalogs/procedencias/${id}`, 'DELETE');
}