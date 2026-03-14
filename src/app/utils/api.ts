import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server`;

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
    const rawResponse = await response.text();

    let data: any;
    try {
      data = rawResponse ? JSON.parse(rawResponse) : {};
    } catch (parseError) {
      console.error(`API Parse Error [${method} ${endpoint}]:`, {
        parseError,
        rawResponse,
      });

      return {
        success: false,
        error: 'El servidor devolvio una respuesta no valida. Si este modulo es nuevo, verifica que la Edge Function este publicada y actualizada.',
      };
    }

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

export async function clearAllConfigurations(): Promise<ApiResponse> {
  return apiRequest('/db/clear', 'POST');
}

// ============================================================================
// DATA CONTROL API
// ============================================================================

export type InventoryStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED';

export interface DataControlPlantSummary {
  plant_id: string;
  plant_name: string;
}

export interface ConfigurationCoverageRow extends DataControlPlantSummary {
  aggregates: number;
  silos: number;
  additives: number;
  diesel: number;
  products: number;
  utilities: number;
  petty_cash: number;
}

export interface InventoryByPlantRow extends DataControlPlantSummary {
  total_months: number;
  by_status: Record<InventoryStatus, number>;
  photos: number;
}

export interface PhotoByPlantRow extends DataControlPlantSummary {
  photos: number;
}

export interface DataControlSummary {
  plants: {
    total: number;
    active: number;
    inactive: number;
  };
  configurationCoverage: ConfigurationCoverageRow[];
  inventorySummary: {
    total_months: number;
    by_status: Record<InventoryStatus, number>;
    by_plant: InventoryByPlantRow[];
  };
  photoSummary: {
    total_photos: number;
    by_plant: PhotoByPlantRow[];
  };
}

export interface DataControlInventoryListItem {
  id: string;
  plant_id: string;
  year_month: string;
  status: InventoryStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
  child_counts: Record<string, number>;
}

export interface DataControlInventoryListResponse {
  items: DataControlInventoryListItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface TransactionalCleanupFilters {
  scope: 'transactional';
  plant_ids?: string[];
  year_month_from?: string;
  year_month_to?: string;
  statuses?: InventoryStatus[];
  include_photos: true;
}

export interface TransactionalCleanupPreview {
  scope: 'transactional';
  filters: TransactionalCleanupFilters;
  inventory_month_ids: string[];
  plants: string[];
  year_months: string[];
  counts_by_table: Record<string, number>;
  deleted_photos_count: number;
  warnings: string[];
  preview_token: string | null;
}

export interface TransactionalCleanupExecuteResult {
  deleted_inventory_months: number;
  deleted_rows_by_table: Record<string, number>;
  deleted_photos: number;
  audit_action_id: string | null;
  warnings: string[];
}

export type ConfigCleanupModule = 'silos' | 'aggregates' | 'additives' | 'diesel' | 'products' | 'utilities' | 'petty_cash';

export interface ConfigCleanupFilters {
  plant_id: string;
  modules: ConfigCleanupModule[];
  include_related_rows?: boolean;
}

export interface ConfigCleanupPreview {
  plant: {
    id: string;
    name: string;
    is_active: boolean;
  };
  modules: ConfigCleanupModule[];
  include_related_rows: boolean;
  counts_by_module: Record<ConfigCleanupModule, number>;
  counts_by_table: Record<string, number>;
  inventory_months_count: number;
  warnings: string[];
  preview_token: string | null;
}

export interface ConfigCleanupExecuteResult {
  deleted_modules: ConfigCleanupModule[];
  deleted_rows_by_table: Record<string, number>;
  deleted_rows_by_module: Record<ConfigCleanupModule, number>;
  inventory_months_count: number;
  audit_action_id: string | null;
  warnings: string[];
}

export async function getDataControlSummary(): Promise<ApiResponse<DataControlSummary>> {
  return apiRequest('/admin/data/summary', 'GET');
}

export async function getDataControlInventories(params?: {
  plantId?: string;
  yearMonthFrom?: string;
  yearMonthTo?: string;
  status?: InventoryStatus | 'ALL';
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<DataControlInventoryListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.plantId) searchParams.set('plant_id', params.plantId);
  if (params?.yearMonthFrom) searchParams.set('year_month_from', params.yearMonthFrom);
  if (params?.yearMonthTo) searchParams.set('year_month_to', params.yearMonthTo);
  if (params?.status && params.status !== 'ALL') searchParams.set('status', params.status);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('page_size', String(params.pageSize));
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return apiRequest(`/admin/data/inventories${suffix}`, 'GET');
}

export async function previewTransactionalCleanup(
  payload: TransactionalCleanupFilters
): Promise<ApiResponse<TransactionalCleanupPreview>> {
  return apiRequest('/admin/data/cleanup/preview', 'POST', payload);
}

export async function executeTransactionalCleanup(
  payload: TransactionalCleanupFilters & {
    preview_token: string;
    confirmation_text: string;
    reason: string;
  }
): Promise<ApiResponse<TransactionalCleanupExecuteResult>> {
  return apiRequest('/admin/data/cleanup/execute', 'POST', payload);
}

export async function previewPlantConfigurationCleanup(
  payload: ConfigCleanupFilters
): Promise<ApiResponse<ConfigCleanupPreview>> {
  return apiRequest('/admin/data/config-cleanup/preview', 'POST', payload);
}

export async function executePlantConfigurationCleanup(
  payload: ConfigCleanupFilters & {
    preview_token: string;
    confirmation_text: string;
    reason: string;
  }
): Promise<ApiResponse<ConfigCleanupExecuteResult>> {
  return apiRequest('/admin/data/config-cleanup/execute', 'POST', payload);
}

// ============================================================================
// PLANT CONFIGURATION API
// ============================================================================

export interface PlantConfigPackage {
  plant_id: string;
  aggregates: any[];
  cajones: any[];
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

export interface ReportSummary {
  id: string;
  plant_id: string;
  year_month: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED';
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

export async function createInventoryMonth(
  data: {
    plant_id: string;
    year_month: string;
    status: string;
    created_by?: string;
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

export async function getReports(params?: {
  plantId?: string;
  yearMonth?: string;
}): Promise<ApiResponse<ReportSummary[]>> {
  const searchParams = new URLSearchParams();
  if (params?.plantId) searchParams.set('plant_id', params.plantId);
  if (params?.yearMonth) searchParams.set('year_month', params.yearMonth);
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return apiRequest(`/reports${suffix}`);
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
// CATALOG ENDPOINTS — Materiales, Procedencias, Aditivos y Curvas
// ============================================================================

export interface AdditiveCatalogItem {
  id: string;
  nombre: string;
  marca?: string | null;
  uom: string;
  sort_order: number;
}

export interface CalibrationCurveCatalogItem {
  id: string;
  plant_id: string;
  curve_name: string;
  measurement_type: string;
  reading_uom?: string | null;
  data_points: Record<string, number>;
}

/** Obtiene la lista de materiales activos */
export async function getMateriales(): Promise<ApiResponse> {
  return apiRequest('/catalogs/materiales', 'GET');
}

/** Crea un nuevo material en el catálogo (admin only) */
export async function createMaterial(nombre: string, clase?: string): Promise<ApiResponse> {
  return apiRequest('/catalogs/materiales', 'POST', { nombre, clase });
}

/** Actualiza un material existente (admin only) */
export async function updateMaterial(
  id: string,
  data: { nombre?: string; clase?: string; sort_order?: number }
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

/** Obtiene la lista de aditivos activos */
export async function getAdditivesCatalog(): Promise<ApiResponse<AdditiveCatalogItem[]>> {
  return apiRequest('/catalogs/additivos', 'GET');
}

/** Crea un nuevo aditivo en el catálogo (admin only) */
export async function createAdditiveCatalogItem(
  nombre: string,
  marca: string,
  uom: string
): Promise<ApiResponse<AdditiveCatalogItem>> {
  return apiRequest('/catalogs/additivos', 'POST', { nombre, marca, uom });
}

/** Actualiza un aditivo existente (admin only) */
export async function updateAdditiveCatalogItem(
  id: string,
  data: { nombre?: string; marca?: string; uom?: string; sort_order?: number }
): Promise<ApiResponse<AdditiveCatalogItem>> {
  return apiRequest(`/catalogs/additivos/${id}`, 'PUT', data);
}

/** Elimina (soft delete) un aditivo del catálogo (admin only) */
export async function deleteAdditiveCatalogItem(id: string): Promise<ApiResponse> {
  return apiRequest(`/catalogs/additivos/${id}`, 'DELETE');
}

/** Obtiene las curvas configuradas para una planta */
export async function getCalibrationCurvesCatalog(
  plantId: string
): Promise<ApiResponse<CalibrationCurveCatalogItem[]>> {
  return apiRequest(`/catalogs/calibration-curves?plant_id=${encodeURIComponent(plantId)}`, 'GET');
}

/** Crea una nueva curva de conversión para una planta */
export async function createCalibrationCurveCatalogItem(data: {
  plant_id: string;
  curve_name: string;
  measurement_type: string;
  reading_uom?: string | null;
  data_points: Record<string, number>;
}): Promise<ApiResponse<CalibrationCurveCatalogItem>> {
  return apiRequest('/catalogs/calibration-curves', 'POST', data);
}

/** Actualiza una curva existente */
export async function updateCalibrationCurveCatalogItem(
  id: string,
  data: {
    curve_name?: string;
    measurement_type?: string;
    reading_uom?: string | null;
    data_points?: Record<string, number>;
  }
): Promise<ApiResponse<CalibrationCurveCatalogItem>> {
  return apiRequest(`/catalogs/calibration-curves/${id}`, 'PUT', data);
}

/** Elimina una curva existente */
export async function deleteCalibrationCurveCatalogItem(id: string): Promise<ApiResponse> {
  return apiRequest(`/catalogs/calibration-curves/${id}`, 'DELETE');
}

// ============================================================================
// AGGREGATES CONFIGURATION API
// ============================================================================

export async function getPlantAggregatesConfigEntries(plantId: string): Promise<ApiResponse> {
  return apiRequest(`/plants/${plantId}/aggregates`, 'GET');
}

export async function updatePlantAggregatesConfigEntries(
  plantId: string,
  aggregates: {
    id?: string;
    aggregate_name: string;
    material_type?: string;
    location_area?: string;
    measurement_method: 'BOX' | 'CONE';
    unit?: string;
    box_width_ft?: number | null;
    box_height_ft?: number | null;
    sort_order?: number;
    is_active?: boolean;
  }[]
): Promise<ApiResponse> {
  return apiRequest(`/plants/${plantId}/aggregates`, 'PUT', { aggregates });
}

export interface AggregatesImportRowPayload {
  row_number: number;
  aggregate_name: string;
  material_type: string;
  location_area: string;
  measurement_method: string;
  unit: string;
  box_width_ft: string;
  box_height_ft: string;
  is_active: string;
}

export interface AggregatesImportPreviewResponse {
  plant: {
    id: string;
    name: string;
  };
  module: 'aggregates';
  template_version: string;
  import_mode: 'upsert';
  summary: {
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    creates: number;
    updates: number;
    legacy_cajones: number;
  };
  errors: Array<{
    row: number;
    column: string;
    message: string;
  }>;
  warnings: string[];
  preview_token: string | null;
}

export interface AggregatesImportExecuteResponse {
  plant: {
    id: string;
    name: string;
  };
  summary: {
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    creates: number;
    updates: number;
    legacy_cajones: number;
  };
  created: number;
  updated: number;
  legacy_cajones_cleared: number;
  warnings: string[];
  audit_action_id: string | null;
}

export async function previewPlantAggregatesImport(
  plantId: string,
  payload: {
    module: 'aggregates';
    template_version: string;
    import_mode: 'upsert';
    rows: AggregatesImportRowPayload[];
  }
): Promise<ApiResponse<AggregatesImportPreviewResponse>> {
  return apiRequest(`/plants/${plantId}/config-import/aggregates/preview`, 'POST', payload);
}

export async function executePlantAggregatesImport(
  plantId: string,
  payload: {
    module: 'aggregates';
    template_version: string;
    import_mode: 'upsert';
    rows: AggregatesImportRowPayload[];
    preview_token: string;
    reason: string;
  }
): Promise<ApiResponse<AggregatesImportExecuteResponse>> {
  return apiRequest(`/plants/${plantId}/config-import/aggregates/execute`, 'POST', payload);
}

// ============================================================================
// SILO CONFIGURATION API
// ============================================================================

/** Obtiene los silos configurados para una planta (admin/super_admin only) */
export async function getPlantSilos(plantId: string): Promise<ApiResponse> {
  return apiRequest(`/plants/${plantId}/silos`, 'GET');
}

/** Reemplaza todos los silos de una planta (admin/super_admin only) */
export async function updatePlantSilos(
  plantId: string,
  silos: {
    id?: string;
    silo_name: string;
    is_active: boolean;
    measurement_method?: string;
    allowed_products?: string[];
  }[]
): Promise<ApiResponse> {
  return apiRequest(`/plants/${plantId}/silos`, 'PUT', { silos });
}

// ============================================================================
// ADDITIVES CONFIGURATION API
// ============================================================================

export async function getPlantAdditivesConfigEntries(plantId: string): Promise<ApiResponse> {
  return apiRequest(`/plants/${plantId}/additives`, 'GET');
}

export async function updatePlantAdditivesConfigEntries(
  plantId: string,
  additives: {
    id?: string;
    catalog_additive_id?: string | null;
    additive_name: string;
    additive_type: 'TANK' | 'MANUAL';
    measurement_method?: string;
    calibration_curve_name?: string | null;
    brand?: string;
    uom?: string;
    requires_photo?: boolean;
    tank_name?: string | null;
    reading_uom?: string | null;
    conversion_table?: Record<string, number> | null;
    sort_order?: number;
    is_active?: boolean;
  }[]
): Promise<ApiResponse> {
  return apiRequest(`/plants/${plantId}/additives`, 'PUT', { additives });
}

// ============================================================================
// DIESEL CONFIGURATION API
// ============================================================================

export async function getPlantDieselConfigEntry(plantId: string): Promise<ApiResponse> {
  return apiRequest(`/plants/${plantId}/diesel`, 'GET');
}

export async function updatePlantDieselConfigEntry(
  plantId: string,
  diesel: {
    id?: string;
    measurement_method?: string;
    calibration_curve_name?: string | null;
    reading_uom?: string;
    tank_capacity_gallons?: number;
    initial_inventory_gallons?: number;
    calibration_table?: Record<string, number> | null;
    is_active?: boolean;
  } | null
): Promise<ApiResponse> {
  return apiRequest(`/plants/${plantId}/diesel`, 'PUT', { diesel });
}

// ============================================================================
// PRODUCTS CONFIGURATION API
// ============================================================================

export async function getPlantProductsConfigEntries(plantId: string): Promise<ApiResponse> {
  return apiRequest(`/plants/${plantId}/products`, 'GET');
}

export async function updatePlantProductsConfigEntries(
  plantId: string,
  products: {
    id?: string;
    product_name: string;
    category?: string;
    measure_mode?: string;
    uom?: string;
    requires_photo?: boolean;
    reading_uom?: string | null;
    calibration_table?: Record<string, number> | null;
    tank_capacity?: number | null;
    unit_volume?: number | null;
    notes?: string;
    sort_order?: number;
    is_active?: boolean;
  }[]
): Promise<ApiResponse> {
  return apiRequest(`/plants/${plantId}/products`, 'PUT', { products });
}

export interface ProductsImportRowPayload {
  row_number: number;
  product_name: string;
  category: string;
  measure_mode: string;
  uom: string;
  requires_photo: string;
  reading_uom: string;
  tank_capacity: string;
  unit_volume: string;
  calibration_table_json: string;
  notes: string;
  is_active: string;
}

export interface ProductsImportPreviewResponse {
  plant: {
    id: string;
    name: string;
  };
  module: 'products';
  template_version: string;
  import_mode: 'upsert';
  summary: {
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    creates: number;
    updates: number;
  };
  errors: Array<{
    row: number;
    column: string;
    message: string;
  }>;
  warnings: string[];
  preview_token: string | null;
}

export interface ProductsImportExecuteResponse {
  plant: {
    id: string;
    name: string;
  };
  summary: {
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    creates: number;
    updates: number;
  };
  created: number;
  updated: number;
  warnings: string[];
  audit_action_id: string | null;
}

export async function previewPlantProductsImport(
  plantId: string,
  payload: {
    module: 'products';
    template_version: string;
    import_mode: 'upsert';
    rows: ProductsImportRowPayload[];
  }
): Promise<ApiResponse<ProductsImportPreviewResponse>> {
  return apiRequest(`/plants/${plantId}/config-import/products/preview`, 'POST', payload);
}

export async function executePlantProductsImport(
  plantId: string,
  payload: {
    module: 'products';
    template_version: string;
    import_mode: 'upsert';
    rows: ProductsImportRowPayload[];
    preview_token: string;
    reason: string;
  }
): Promise<ApiResponse<ProductsImportExecuteResponse>> {
  return apiRequest(`/plants/${plantId}/config-import/products/execute`, 'POST', payload);
}
