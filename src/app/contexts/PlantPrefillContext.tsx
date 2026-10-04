import { recordInventoryCaptureStarted, acceptInventorySnapshot, syncInventorySection, uploadPendingInventoryPhotos } from '../utils/api';
import { appendConfiguredEntries } from '../utils/appendConfiguredEntries';
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { 
  getPlantConfig, 
  getInventoryMonth,
  createInventoryMonth,
  PlantConfigPackage,
  InventoryMonth 
} from '../utils/api';
import { getPlantUtilitiesConfig } from '../config/utilitiesConfig';
import { getPettyCashConfig } from '../config/pettyCashConfig';
import { resolveMeasurementConfig } from '../utils/unitConversion';
import { useAuth } from './AuthContext';
import { InventorySync, type SyncState } from '../utils/inventorySync';
import { inventoryDraftStore, inventoryScopeKey } from '../utils/inventoryDraftStore';
import { projectId } from '/utils/supabase/info';

const sectionFields: Record<string, keyof PrefillData> = { aggregates: 'agregadosEntries', silos: 'silosEntries', additives: 'aditivosEntries', diesel: 'dieselEntry', products: 'productosEntries', utilities: 'utilitiesEntries', 'petty-cash': 'pettyCashEntry' };
const toServerSection = (section: string) => ({ agregados: 'aggregates', aditivos: 'additives', productos: 'products', aceites: 'products', utilidades: 'utilities', pettyCash: 'petty-cash' } as Record<string,string>)[section] || section;
const rowsFor = (data: PrefillData, section: string): any[] => { const value = data[sectionFields[section]]; return Array.isArray(value) ? value : value ? [value] : []; };
const installRows = (data: PrefillData, section: string, rows: any[]) => ({ ...data, [sectionFields[section]]: ['diesel','petty-cash'].includes(section) ? rows[0] || null : rows });

// ============================================================================
// TYPES
// ============================================================================

export interface PrefillData {
  // Month metadata
  inventoryMonth: InventoryMonth | null;
  previousMonth: InventoryMonth | null;
  
  // Configuration (read-only data from plant_*_config)
  config: PlantConfigPackage | null;
  
  // Entries for current month (editable data from inventory_*)
  silosEntries: any[];
  agregadosEntries: any[];
  aditivosEntries: any[];
  dieselEntry: any | null;
  productosEntries: any[];
  utilitiesEntries: any[];
  metersEntries: any[];
  pettyCashEntry: any | null;
  
  // Loading states
  loading: boolean;
  error: string | null;
}

interface PlantPrefillContextType {
  prefillData: PrefillData;
  syncStates: Record<string, SyncState>;
  saveSection: (section: string) => Promise<any>;
  flushDrafts: () => Promise<boolean>;
  resolveDraft: (section: string, keepLocal: boolean, reviewedRevision?: number) => Promise<void>;
  exportDrafts: () => void;
  hasUnprotectedChanges: boolean;
  hasPendingChanges: boolean;
  hasPendingChangesForSection: (section: string | null | undefined) => boolean;
  loadPlantData: (plantId: string, yearMonth: string) => Promise<void>;
  currentYearMonth: string;
  setSelectedYearMonth: (yearMonth: string) => void;
  getCurrentYearMonth: () => string;
  refreshData: () => Promise<void>;
  updateEntry: (section: string, entryId: string, data: any) => void;
  getSectionRevision: (section: string) => number;
  markChangesSaved: (section: string, savedRevision: number) => void;
}

const PlantPrefillContext = createContext<PlantPrefillContextType | undefined>(undefined);

const emptyPrefill: PrefillData = {
    inventoryMonth: null,
    previousMonth: null,
    config: null,
    silosEntries: [],
    agregadosEntries: [],
    aditivosEntries: [],
    dieselEntry: null,
    productosEntries: [],
    utilitiesEntries: [],
    metersEntries: [],
    pettyCashEntry: null,
    loading: false,
    error: null,
  };

// ============================================================================
// PROVIDER
// ============================================================================

export function PlantPrefillProvider({ children }: { children: React.ReactNode }) {
  const [prefillData, setPrefillData] = useState<PrefillData>(emptyPrefill);

  const prefillRef = useRef(prefillData);
  prefillRef.current = prefillData;
  const syncRef = useRef<InventorySync | null>(null);
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});
  const [currentPlantId, setCurrentPlantId] = useState<string | null>(null);
  const [currentYearMonth, setCurrentYearMonth] = useState<string | null>(null);
  const [dirtySectionRevisions, setDirtySectionRevisions] = useState<Record<string, number>>({});
  const dirtySectionRevisionsRef = useRef<Record<string, number>>({});
  const activityMonthRef = useRef<string | null>(null);
  const loadSequenceRef = useRef(0);
  const loadedByRef = useRef<string | undefined>();
  const reportedCaptureRef = useRef(new Set<string>());
  const inFlightLoadRef = useRef<Promise<void> | null>(null);
  const inFlightLoadKeyRef = useRef<string | null>(null);

  const { allPlants, user } = useAuth();
  const currentUserRef = useRef(user?.id);
  currentUserRef.current = user?.id;
  const currentActorRef = useRef(user);
  currentActorRef.current = user;

  const installDrafts = useCallback(async (loaded: PrefillData, revisions: Record<string, number>, fresh = true, compatible = true) => {
    syncRef.current?.stop();
    syncRef.current = null;
    if (!user || currentUserRef.current !== user.id || !loaded.inventoryMonth || !['plant_manager','operations_manager'].includes(user.role)) return loaded;
    const month = loaded.inventoryMonth;
    const scope = inventoryScopeKey(projectId, user.id, month.plant_id, month.year_month);
    setSyncStates({});
    const engine = new InventorySync(scope, {
      store: inventoryDraftStore,
      unavailableReason: compatible ? undefined : 'El servidor debe actualizarse antes de sincronizar. El borrador permanece en este dispositivo.',
      ready: () => {
        const token = localStorage.getItem('promix_access_token');
        if (!compatible || !token || !currentActorRef.current?.is_active || !['plant_manager','operations_manager'].includes(currentActorRef.current?.role || '') || currentUserRef.current !== user.id) return false;
        try { const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); return payload.exp * 1000 > Date.now(); } catch { return false; }
      },
      online: () => navigator.onLine,
      preparePhotos: (rows, draft) => uploadPendingInventoryPhotos(rows, month.plant_id, month.id, draft.section),
      send: (draft, operation) => syncInventorySection(draft.monthId, draft.section, operation.rows, operation.id, operation.expected, {client_occurred_at:operation.occurredAt,client_capture_started_at:draft.captureStartedAt}),
      notify: (section, state, rows) => {
        if (syncRef.current !== engine || currentUserRef.current !== user.id) return;
        setSyncStates(previous => ({ ...previous, [section]: state }));
        if (rows) {
          setPrefillData(previous => {
            if (previous.inventoryMonth?.id !== month.id) return previous;
            const next = installRows(previous, section, rows);
            prefillRef.current = next; return next;
          });
          if (state.state === 'server') {
            const alias = ({aggregates:'agregados',additives:'aditivos',products:'productos','petty-cash':'pettyCash'} as Record<string,string>)[section] || section;
            delete dirtySectionRevisionsRef.current[alias];
            setDirtySectionRevisions({ ...dirtySectionRevisionsRef.current });
          }
        }
      },
    });
    syncRef.current = engine;
    let restored = loaded;
    for (const section of Object.keys(sectionFields)) {
      if (syncRef.current !== engine || currentUserRef.current !== user.id) return loaded;
      try {
        const rows = await engine.restore(month.id, section, rowsFor(loaded, section), revisions[section] || 0, month.status, fresh);
        restored = installRows(restored, section, rows);
      } catch (error: any) {
        if (syncRef.current !== engine || currentUserRef.current !== user.id) return loaded;
        setSyncStates(previous => ({ ...previous, [section]: { state: 'attention', localSaved: false, message: error.message || 'No se pudo abrir el almacenamiento local.' } }));
      }
    }
    return restored;
  }, [user]);

  useEffect(() => {
    const resume = () => syncRef.current?.resume();
    const hidden = () => { if (document.visibilityState === 'hidden') void syncRef.current?.flushAll(); else resume(); };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('online',resume); document.removeEventListener('visibilitychange',hidden); };
  }, []);
  useEffect(() => {
    syncRef.current?.stop(); syncRef.current = null;
    activityMonthRef.current = null;
    loadedByRef.current = undefined;
    prefillRef.current = emptyPrefill; setPrefillData(emptyPrefill);
    dirtySectionRevisionsRef.current = {}; setDirtySectionRevisions({});
    setSyncStates({});
    return () => { syncRef.current?.stop(); };
  }, [user?.id]);

  const getYearMonthFromDate = (date: Date): string => (
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  );

  const getCurrentYearMonth = useCallback((): string => {
    return currentYearMonth || getYearMonthFromDate(new Date());
  }, [currentYearMonth]);

  const setSelectedYearMonth = useCallback((yearMonth: string) => {
    setCurrentYearMonth(yearMonth);
  }, []);

  // ============================================================================
  // HELPER: Calculate previous month
  // ============================================================================
  
  const getPreviousMonth = (yearMonth: string): string => {
    const [year, month] = yearMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() - 1);
    const prevYear = date.getFullYear();
    const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
    return `${prevYear}-${prevMonth}`;
  };

  const resolveUtilityConfigKey = useCallback((entry: any): string | null => {
    return (
      entry?.utility_meter_config_id ||
      entry?.utility_config_id ||
      entry?.id ||
      entry?.meter_name ||
      null
    );
  }, []);

  const resolveProductConfigKey = useCallback((entry: any): string | null => {
    return (
      entry?.product_config_id ||
      entry?.producto_config_id ||
      entry?.id ||
      entry?.product_name ||
      null
    );
  }, []);

  const normalizeUtilityType = useCallback((rawType: string | null | undefined): string => {
    const normalized = String(rawType || '').trim().toUpperCase();

    if (['WATER_AAA', 'WATER_WELL', 'ELECTRICITY', 'GAS', 'OTHER'].includes(normalized)) {
      return normalized;
    }

    if (normalized.includes('WELL') || normalized.includes('POZO')) return 'WATER_WELL';
    if (normalized.includes('WATER') || normalized.includes('AGUA') || normalized.includes('AAA')) return 'WATER_AAA';
    if (normalized.includes('ELEC') || normalized.includes('POWER') || normalized.includes('LUMA')) return 'ELECTRICITY';
    if (normalized.includes('GAS')) return 'GAS';

    return 'OTHER';
  }, []);

  const getResolvedAggregatesConfig = useCallback((config: PlantConfigPackage) => {
    if (config.aggregates?.length > 0) {
      return config.aggregates;
    }

    const currentPlant = allPlants.find((p: any) => p.id === config.plant_id);
    const cajones = config.cajones?.length ? config.cajones : currentPlant?.cajones || [];
    const aggregateMeasurementConfig = resolveMeasurementConfig(config.measurement_configs || [], {
      plantId: config.plant_id,
      sectionCode: 'aggregates',
    });
    const displayUnit = aggregateMeasurementConfig?.display_unit_id || aggregateMeasurementConfig?.calculation_unit_id || 'ft3';

    // Backward compatibility: some plants only have cajones configured and no
    // plant_aggregates_config rows yet. Build BOX aggregates from those cajones.
    return cajones.map((cajon: any, index: number) => ({
      id: cajon.id,
      aggregate_name: cajon.name,
      material_type: cajon.material || 'AGREGADO',
      location_area: cajon.procedencia || cajon.name,
      measurement_method: 'BOX',
      unit: displayUnit,
      box_width_ft: cajon.ancho || 0,
      box_height_ft: cajon.alto || 0,
    }));
  }, [allPlants]);

  // ============================================================================
  // HELPER: Create empty entries from config
  // ============================================================================
  
  const createEmptyEntriesFromConfig = useCallback(async (
    inventoryMonthId: string,
    config: PlantConfigPackage,
    previousMonth: InventoryMonth | null
  ) => {
    const entries: any = {
      silos: [],
      agregados: [],
      aditivos: [],
      diesel: null,
      productos: [],
      utilities: [],
      meters: [],
      pettyCash: null,
    };

    // SILOS: Create entry for each silo in config
    entries.silos = config.silos.map((silo: any) => ({
      id: `temp_${silo.id}_${Date.now()}_${Math.random()}`,
      inventory_month_id: inventoryMonthId,
      silo_config_id: silo.id,
      silo_name: silo.silo_name,
      measurement_method: silo.measurement_method,
      calibration_curve_name: silo.calibration_curve_name || null,
      reading_uom: silo.reading_uom || null,
      conversion_table: silo.conversion_table || null,
      calculation_method: silo.calculation_method || 'CALIBRATION_CURVE',
      diameter_in: silo.diameter_in ?? null,
      total_height_in: silo.total_height_in ?? null,
      cone_height_in: silo.cone_height_in ?? null,
      bottom_diameter_in: silo.bottom_diameter_in ?? null,
      cylinder_height_mode: silo.cylinder_height_mode || 'FULL_H',
      slope_divisor_mode: silo.slope_divisor_mode || 'SLOPE_DIVISOR_EFFECTIVE',
      reading_reference: silo.reading_reference || 'EMPTY_HEIGHT_INCHES',
      geometry_model: silo.geometry_model || 'LEGACY_LINEAR',
      capacity_fraction: Number(silo.capacity_fraction ?? 1),
      calculation_unit_id: silo.calculation_unit_id || 'ft3',
      inventory_unit_id: silo.inventory_unit_id || null,
      material_conversion_factor_id: silo.material_conversion_factor_id || null,
      requires_photo: silo.requires_photo ?? true,
      allowed_products: silo.allowed_products || [], // Products allowed for this silo
      product_id: null, // To be selected by manager
      product_name: null, // To be selected by manager
      product_in_silo: null,
      previous_reading: 0,
      reading_value: null, // The actual reading in the configured unit
      reading: null,
      calculated_result_cy: 0, // Result in cubic yards (or tons if conversion exists)
      calculated_volume: 0,
      photo_url: null,
      notes: '',
      _isNew: true,
    }));

    // AGREGADOS: Create entry for each agregado in config
    // Look up cajones from the current plant to use as dimension fallback for BOX method
    const currentPlantForAgg = allPlants.find((p: any) => p.id === config.plant_id);
    const cajonesForAgg = currentPlantForAgg?.cajones || [];

    const resolvedAggregates = getResolvedAggregatesConfig(config);

    entries.agregados = resolvedAggregates.map((agg: any) => {
      // Find matching cajón by name for dimension fallback (e.g. "Cajón 1" ↔ aggregate_name "Cajón 1")
      const matchingCajon = cajonesForAgg.find((c: any) => c.name === agg.aggregate_name);
      return {
      id: `temp_${agg.id}_${Date.now()}`,
      inventory_month_id: inventoryMonthId,
      aggregate_config_id: agg.id,
      aggregate_name: agg.aggregate_name,
      material_type: agg.material_type,
      location_area: agg.location_area,
      measurement_method: agg.measurement_method,
      unit: agg.unit,
      // BOX fields — use cajón config dimensions as fallback when plant_aggregates_config has no value
      box_width_ft: agg.box_width_ft || matchingCajon?.ancho || 0,
      box_height_ft: agg.box_height_ft || matchingCajon?.alto || 0,
      box_length_ft: null, // To be filled by manager
      // CONE fields
      cone_m1: null,
      cone_m2: null,
      cone_m3: null,
      cone_m4: null,
      cone_m5: null,
      cone_m6: null,
      cone_d1: null,
      cone_d2: null,
      calculated_volume_cy: 0,
      photo_url: null,
      notes: '',
      _isNew: true,
      };
    });

    // ADITIVOS: Create entry for each additive configured in the backend
    entries.aditivos = (config.additives || []).map((aditivo: any) => {
      const additiveType = String(aditivo.additive_type || 'MANUAL').toUpperCase();

      return ({
        id: `temp_${aditivo.id}_${Date.now()}_${Math.random()}`,
        inventory_month_id: inventoryMonthId,
        additive_config_id: aditivo.id,
        additive_type: additiveType,
        measurement_method: aditivo.measurement_method || (additiveType === 'TANK' ? 'CURVE' : 'MANUAL'),
        product_name: aditivo.product_name || aditivo.additive_name,
        brand: aditivo.brand || '',
        uom: aditivo.uom || '',
        requires_photo: aditivo.requires_photo ?? false,
        // Tank-specific fields
        tank_name: aditivo.tank_name || null,
        calibration_curve_name: aditivo.calibration_curve_name || null,
        calibration_points: aditivo.calibration_curve_name
          ? config.calibration_curves?.[aditivo.calibration_curve_name]?.points || null
          : null,
        reading_uom: aditivo.reading_uom || null,
        reading_value: null,
        reading: null,
        previous_reading: 0,
        calculated_volume: 0,
        calculated_gallons: 0,
        conversion_table: aditivo.conversion_table || null,
        diameter: aditivo.diameter ?? null,
        length: aditivo.length ?? null,
        width: aditivo.width ?? null,
        total_height: aditivo.total_height ?? null,
        capacity: aditivo.capacity ?? null,
        dimension_unit_id: aditivo.dimension_unit_id || null,
        capacity_unit_id: aditivo.capacity_unit_id || null,
        // Manual-specific fields
        quantity: null,
        // Common fields
        photo_url: null,
        notes: '',
        _isNew: true,
      });
    });

    // DIESEL: Single entry from backend config
    const dieselConfig = config.diesel;

    if (dieselConfig) {
      entries.diesel = {
        id: `temp_diesel_${Date.now()}`,
        inventory_month_id: inventoryMonthId,
        diesel_config_id: dieselConfig.id,
        plant_id: config.plant_id,
        unit: dieselConfig.unit || 'gallons',
        reading_uom: dieselConfig.reading_uom || 'inches',
        calibration_table: dieselConfig.calibration_table || null,
        tank_capacity_gallons: Number(dieselConfig.tank_capacity_gallons) || 0,
        // Reading and calculated fields
        reading_inches: null, // To be filled by manager
        reading: null,
        calculated_gallons: 0, // Calculated from reading_inches using calibration_table
        // Inventory flow: beginning + purchases - ending = consumption
        beginning_inventory: Number(dieselConfig.initial_inventory_gallons) || 0, // Will be updated from previous month
        purchases_gallons: null, // To be filled by manager
        ending_inventory: 0, // Equals calculated_gallons from reading
        consumption_gallons: 0, // Calculated: beginning + purchases - ending
        // Common fields
        photo_url: null,
        notes: '',
        _isNew: true,
      };
    } else {
      console.warn(`[PlantPrefill] No diesel config found in backend for plant ${config.plant_id}`);
      entries.diesel = null;
    }

    // PRODUCTOS: Create entry for each product configured in the backend
    if ((config.products || []).length > 0) {
      entries.productos = (config.products || []).map((producto: any) => ({
        id: `temp_${producto.id}_${Date.now()}_${Math.random()}`,
        inventory_month_id: inventoryMonthId,
        product_config_id: producto.id,
        producto_config_id: producto.id,
        product_name: producto.product_name,
        category: producto.category || 'OTHER',
        measure_mode: producto.measure_mode || 'COUNT',
        uom: producto.uom || producto.unit || '',
        requires_photo: producto.requires_photo ?? false,
        // For TANK_READING mode
        reading_uom: producto.reading_uom || null,
        reading_value: null, // To be filled by manager (for TANK_READING)
        calculated_quantity: 0, // Calculated from reading using calibration_table
        calibration_table: producto.calibration_table || null,
        tank_capacity: producto.tank_capacity || null,
        // For DRUM/PAIL mode
        unit_count: null, // Number of drums/pails (to be filled by manager)
        unit_volume: producto.unit_volume || null, // Volume per unit (e.g., 55 gal/drum)
        total_volume: 0, // Calculated: unit_count * unit_volume
        // For COUNT mode
        quantity: null, // Direct quantity count (to be filled by manager)
        // Common fields
        photo_url: null,
        notes: producto.notes || '',
        _isNew: true,
      }));
    } else {
      console.warn(`[PlantPrefill] No products config found in backend for plant ${config.plant_id}`);
      entries.productos = [];
    }

    // UTILITIES: Use backend config first; local config is only a legacy fallback.
    const localUtilitiesConfig = getPlantUtilitiesConfig(config.plant_id || '');
    const localMetersById = new Map((localUtilitiesConfig?.meters || []).map((meter: any) => [meter.id, meter]));
    const localMetersByName = new Map((localUtilitiesConfig?.meters || []).map((meter: any) => [meter.meter_name, meter]));
    const utilitySourceMeters = config.utilities_meters?.length > 0
      ? config.utilities_meters
      : (localUtilitiesConfig?.meters || []);
    
    if (utilitySourceMeters.length > 0) {
      entries.utilities = utilitySourceMeters.map((meter: any, index: number) => {
        const fallbackMeter =
          localMetersById.get(meter.id) ||
          localMetersByName.get(meter.meter_name) ||
          {};
        const configId = meter.id || fallbackMeter.id || `utility_${index + 1}`;

        return ({
        id: `temp_${configId}_${Date.now()}_${Math.random()}`,
        inventory_month_id: inventoryMonthId,
        utility_config_id: configId,
        utility_meter_config_id: configId,
        meter_name: meter.meter_name || fallbackMeter.meter_name || `Medidor ${index + 1}`,
        meter_number: meter.meter_number || fallbackMeter.meter_number || '',
        utility_type: normalizeUtilityType(meter.utility_type || meter.meter_type || fallbackMeter.utility_type),
        uom: meter.uom || meter.unit || fallbackMeter.uom || fallbackMeter.unit || '',
        provider: meter.provider || fallbackMeter.provider || '',
        requires_photo: meter.requires_photo ?? fallbackMeter.requires_photo ?? true,
        // Without historical data, the first real reading becomes the baseline.
        previous_reading: null,
        current_reading: null, // To be filled by manager (MAIN FOCUS)
        consumption: null, // Calculated only when a previous reading exists
        // Common fields
        photo_url: null,
        notes: meter.notes || fallbackMeter.notes || '',
        _isNew: true,
      })});
    } else {
      console.warn(`[PlantPrefill] No local utilities config found for plant ${config.plant_id}`);
      entries.utilities = [];
    }

    // METERS: Create entry for each other meter in config
    entries.meters = config.utilities_meters
      .filter((meter: any) => meter.meter_type !== 'utility')
      .map((meter: any) => ({
        id: `temp_${meter.id}_${Date.now()}`,
        inventory_month_id: inventoryMonthId,
        meter_config_id: meter.id,
        meter_name: meter.meter_name,
        meter_type: meter.meter_type,
        unit: meter.unit,
        previous_reading: 0,
        current_reading: 0,
        notes: '',
        _isNew: true,
      }));

    // PETTY CASH: Single entry — use DB value (plants.petty_cash_established)
    // Fallback to local pettyCashConfig.ts if plant not yet loaded
    const plantFromDB = allPlants.find(p => p.id === config.plant_id);
    const localPettyCashConfig = getPettyCashConfig(config.plant_id || '');
    const dbPettyCashConfig = config.petty_cash;
    const establishedAmount = Number(
      dbPettyCashConfig?.monthly_amount ??
      dbPettyCashConfig?.initial_amount ??
      dbPettyCashConfig?.established_amount ??
      plantFromDB?.pettyCashEstablished ??
      localPettyCashConfig?.established_amount ??
      0
    ) || 0;

    entries.pettyCash = {
      id: `temp_pettycash_${Date.now()}`,
      inventory_month_id: inventoryMonthId,
      petty_cash_config_id: dbPettyCashConfig?.id || null,
      plant_id: config.plant_id,
      // Configuration fields (READ-ONLY)
      established_amount: establishedAmount,
      currency: 'USD',
      // Manager input fields (EDITABLE)
      receipts: null, // Total of receipts in USD
      cash: null, // Cash on hand in USD
      // Calculated fields
      total: 0, // receipts + cash
      difference: establishedAmount, // established - total (positive = short, negative = over)
      beginning_balance: Number(dbPettyCashConfig?.initial_amount) || 0,
      ending_balance: Number(dbPettyCashConfig?.initial_amount) || 0,
      amount: establishedAmount,
      // Evidence and notes
      photo_url: null,
      notes: '',
      _isNew: true,
    };

    return entries;
  }, [allPlants, getResolvedAggregatesConfig, normalizeUtilityType]);

  // ============================================================================
  // HELPER: Apply carry-over from previous month
  // ============================================================================
  
  const applyCarryOver = useCallback((entries: any, previousMonthData: any) => {
    // SILOS: previous_reading = previous month's current_reading
    if (previousMonthData.silos && previousMonthData.silos.length > 0) {
      entries.silos.forEach((entry: any) => {
        const prevSilo = previousMonthData.silos.find(
          (s: any) => s.silo_config_id === entry.silo_config_id
        );
        if (prevSilo) {
          entry.previous_reading = prevSilo.reading_value ?? prevSilo.reading ?? prevSilo.current_reading ?? 0;
        }
      });
    }

    // AGREGADOS: previous_reading = previous month's current_reading
    if (previousMonthData.agregados && previousMonthData.agregados.length > 0) {
      entries.agregados.forEach((entry: any) => {
        const prevAgg = previousMonthData.agregados.find(
          (a: any) => a.aggregate_config_id === entry.aggregate_config_id
        );
        if (prevAgg) {
          entry.previous_reading = prevAgg.current_reading || 0;
        }
      });
    }

    // ADITIVOS: beginning = previous month's ending
    if (previousMonthData.aditivos && previousMonthData.aditivos.length > 0) {
      entries.aditivos.forEach((entry: any) => {
        const prevAditivo = previousMonthData.aditivos.find(
          (a: any) =>
            (a.additive_config_id || a.aditivo_config_id) ===
            (entry.additive_config_id || entry.aditivo_config_id)
        );
        if (prevAditivo) {
          entry.previous_reading = prevAditivo.reading_value ?? prevAditivo.reading ?? 0;
        }
      });
    }

    // DIESEL: beginning = previous month's ending
    if (previousMonthData.diesel) {
      entries.diesel.beginning_inventory = previousMonthData.diesel.ending_inventory || 0;
    }

    // PRODUCTOS: beginning = previous month's ending
    if (previousMonthData.productos && previousMonthData.productos.length > 0) {
      entries.productos.forEach((entry: any) => {
        const prevProducto = previousMonthData.productos.find(
          (p: any) =>
            (p.product_config_id || p.producto_config_id) ===
              (entry.product_config_id || entry.producto_config_id) ||
            p.product_name === entry.product_name
        );
        if (prevProducto) {
          entry.beginning = prevProducto.ending || 0;
        }
      });
    }

    // UTILITIES: previous_reading = previous month's current_reading
    if (entries.utilities && entries.utilities.length > 0) {
      const previousUtilities = previousMonthData.utilities || [];
      entries.utilities.forEach((entry: any) => {
        entry.previous_reading = null;
        entry.consumption = null;
        const entryKey = resolveUtilityConfigKey(entry);
        const prevUtility = previousUtilities.find(
          (u: any) => resolveUtilityConfigKey(u) === entryKey
        );
        if (prevUtility) {
          entry.previous_reading = prevUtility.current_reading ?? null;
        }
      });
    }

    // METERS: previous_reading = previous month's current_reading
    if (previousMonthData.meters && previousMonthData.meters.length > 0) {
      entries.meters.forEach((entry: any) => {
        const prevMeter = previousMonthData.meters.find(
          (m: any) => m.meter_config_id === entry.meter_config_id
        );
        if (prevMeter) {
          entry.previous_reading = prevMeter.current_reading || 0;
        }
      });
    }

    // PETTY CASH: beginning_balance = previous month's ending_balance
    if (previousMonthData.pettyCash && entries.pettyCash) {
      entries.pettyCash.beginning_balance = previousMonthData.pettyCash.ending_balance || 0;
      entries.pettyCash.ending_balance = previousMonthData.pettyCash.ending_balance || 0;
    }

    return entries;
  }, [resolveUtilityConfigKey]);

  // ============================================================================
  // MAIN LOAD FUNCTION
  // ============================================================================
  
  const loadPlantDataInternal = useCallback(async (plantId: string, yearMonth: string, options?: { force?: boolean }) => {
    const force = options?.force === true;
    const requestKey = `${plantId}:${yearMonth}`;

    if (!force && inFlightLoadKeyRef.current === requestKey && inFlightLoadRef.current) {
      return inFlightLoadRef.current;
    }

    if (
      !force &&
      loadedByRef.current === user?.id &&
      currentPlantId === plantId &&
      currentYearMonth === yearMonth &&
      prefillData.inventoryMonth &&
      !prefillData.loading &&
      !prefillData.error
    ) {
      return;
    }

    const loadSequence = ++loadSequenceRef.current;
    syncRef.current?.stop(); syncRef.current = null; setSyncStates({});
    activityMonthRef.current = null;
    setPrefillData(prev => ({ ...prev, loading: true, error: null }));
    setCurrentPlantId(plantId);
    setCurrentYearMonth(yearMonth);

    let canRecoverOffline = !navigator.onLine;
    const loadPromise = (async () => {
      try {
        console.log(`[PlantPrefill] Loading data for plant ${plantId}, month ${yearMonth}`);

        const previousMonthStr = getPreviousMonth(yearMonth);
        console.log('[PlantPrefill] Attempting to load previous month:', previousMonthStr);

        let [configResponse, monthResponse, prevMonthResponse] = await Promise.all([
          getPlantConfig(plantId),
          getInventoryMonth(plantId, yearMonth),
          getInventoryMonth(plantId, previousMonthStr),
        ]);

        canRecoverOffline = [configResponse, monthResponse, prevMonthResponse].some(response => !response.success && (!response.status || response.status >= 500));
        if ([configResponse, monthResponse, prevMonthResponse].some(response => [401,403].includes(response.status || 0))) canRecoverOffline = false;
        if (!configResponse.success || !configResponse.data) {
          throw new Error(`Failed to load plant config: ${configResponse.error}`);
        }

        if (!prevMonthResponse.success && prevMonthResponse.error !== 'Month not found') {
          throw new Error(prevMonthResponse.error || 'No se pudo consultar el inventario anterior.');
        }

        const config = configResponse.data;
        console.log('[PlantPrefill] Config loaded:', config);
        console.log('[PlantPrefill] getInventoryMonth response:', monthResponse);

        let inventoryMonth: InventoryMonth | null = null;

        if (monthResponse.success && monthResponse.data) {
          inventoryMonth = monthResponse.data.month;
          console.log('[PlantPrefill] Current month found:', inventoryMonth);
        } else {
          if (monthResponse.error !== 'Month not found') throw new Error(monthResponse.error || 'No se pudo consultar el inventario.');
          console.log('[PlantPrefill] Month not found, creating new month...');

          try {
            const createResponse = await createInventoryMonth({
              plant_id: plantId,
              year_month: yearMonth,
              status: 'IN_PROGRESS',
              created_by: user?.name || user?.email || 'unknown',
            });

            console.log('[PlantPrefill] createInventoryMonth response:', createResponse);

            if (!createResponse.success || !createResponse.data) {
              throw new Error(`Failed to create month: ${createResponse.error || 'Unknown error'}`);
            }

            // Re-read a consistent snapshot, including section revisions. Another
            // session may have created or saved the month in the meantime.
            monthResponse = await getInventoryMonth(plantId, yearMonth);
            if (!monthResponse.success || !monthResponse.data) {
              throw new Error(monthResponse.error || 'No se pudo confirmar el inventario creado.');
            }
            inventoryMonth = monthResponse.data.month;
            console.log('[PlantPrefill] New month created:', inventoryMonth);
          } catch (createError) {
            console.error('[PlantPrefill] Error creating month:', createError);
            throw new Error(
              `No se pudo crear el inventario para ${yearMonth}. ` +
              `Verifica que la base de datos esté configurada correctamente. ` +
              `Error: ${createError instanceof Error ? createError.message : 'Unknown error'}`
            );
          }
        }

        if (!inventoryMonth) {
          throw new Error('No inventory month available');
        }

        let previousMonth: InventoryMonth | null = null;
        let previousMonthData: any = null;

        if (prevMonthResponse.success && prevMonthResponse.data) {
          previousMonth = prevMonthResponse.data.month;
          previousMonthData = prevMonthResponse.data;
          console.log('[PlantPrefill] ✓ Previous month found:', previousMonth);
        } else {
          console.log('[PlantPrefill] ℹ️ No previous month found (this is normal for the first month)');
        }

        // 4. Load or create entries for current month
        let entries: any;

        if (monthResponse.success && monthResponse.data) {
        // Month exists, use its entries
          entries = {
            silos: monthResponse.data.silos || [],
            agregados: monthResponse.data.agregados || [],
            aditivos: monthResponse.data.aditivos || [],
            diesel: monthResponse.data.diesel || null,
            productos: monthResponse.data.productos || [],
            utilities: monthResponse.data.utilities || [],
            meters: monthResponse.data.meters || [],
            pettyCash: monthResponse.data.pettyCash || null,
          };
        
          // Enrich silos entries with allowed_products from config
          if (entries.silos && entries.silos.length > 0) {
            entries.silos = entries.silos.map((entry: any) => {
              const siloConfig = config.silos.find((s: any) => s.id === entry.silo_config_id);
              return {
                ...entry,
                allowed_products: siloConfig?.allowed_products || [],
                silo_name: siloConfig?.silo_name || entry.silo_name,
                measurement_method: siloConfig?.measurement_method || entry.measurement_method,
                calibration_curve_name: siloConfig?.calibration_curve_name || entry.calibration_curve_name,
                reading_uom: siloConfig?.reading_uom || entry.reading_uom,
                conversion_table: siloConfig?.conversion_table || entry.conversion_table,
              };
            });
          }
        
          // If month exists but has no aggregate entries yet, create from config
          const resolvedAggregates = getResolvedAggregatesConfig(config);
          const freshEntries = await createEmptyEntriesFromConfig(inventoryMonth.id, config, previousMonth);

          if (entries.agregados.length === 0 && resolvedAggregates.length > 0) {
            entries.agregados = freshEntries.agregados;
            console.log('[PlantPrefill] Month exists but no aggregate entries — created from config');
          }

          // Enrich aggregate entries with current config values
          // Handles cases where config was updated after entries were saved (e.g. DRAWER→BOX/CONE)
          if (entries.agregados.length > 0 && resolvedAggregates.length > 0) {
            // Look up cajones from the current plant for dimension fallback
            const currentPlantForEnrich = allPlants.find((p: any) => p.id === config.plant_id);
            const cajonesForEnrich = currentPlantForEnrich?.cajones || [];

            entries.agregados = entries.agregados.map((entry: any) => {
              const aggConfig = resolvedAggregates.find((a: any) => a.id === entry.aggregate_config_id);
              if (!aggConfig) return entry;
              // Find matching cajón by name for dimension fallback
              const matchingCajon = cajonesForEnrich.find(
                (c: any) => c.name === (aggConfig.aggregate_name || entry.aggregate_name)
              );
              return {
                ...entry,
                measurement_method: aggConfig.measurement_method,
                // BOX width stays fixed from config; height can be adjusted per inventory entry.
                box_width_ft: aggConfig.box_width_ft || matchingCajon?.ancho || entry.box_width_ft,
                box_height_ft: entry.box_height_ft ?? aggConfig.box_height_ft ?? matchingCajon?.alto ?? 0,
                aggregate_name: aggConfig.aggregate_name || entry.aggregate_name,
                material_type: aggConfig.material_type || entry.material_type,
                location_area: aggConfig.location_area || entry.location_area,
                unit: aggConfig.unit || entry.unit,
              };
            });
            console.log('[PlantPrefill] Enriched aggregate entries with current config values');
          }

          // If month exists but has no silo entries yet, create from config
          if (entries.silos.length === 0 && config.silos?.length > 0) {
            entries.silos = freshEntries.silos;
            console.log('[PlantPrefill] Month exists but no silo entries — created from config');
          }

          if (entries.silos.length > 0 && freshEntries.silos.length > 0) {
            const freshSilosByConfigId = new Map(
              freshEntries.silos.map((entry: any) => [entry.silo_config_id, entry])
            );

            entries.silos = entries.silos.map((entry: any) => {
              const freshSilo = freshSilosByConfigId.get(entry.silo_config_id);
              if (!freshSilo) return entry;

              return {
                ...freshSilo,
                ...entry,
                silo_name: freshSilo.silo_name || entry.silo_name,
                measurement_method: freshSilo.measurement_method || entry.measurement_method,
                calibration_curve_name: freshSilo.calibration_curve_name || entry.calibration_curve_name,
                reading_uom: freshSilo.reading_uom || entry.reading_uom,
                conversion_table: freshSilo.conversion_table || entry.conversion_table,
                allowed_products: freshSilo.allowed_products || entry.allowed_products || [],
                product_in_silo: entry.product_in_silo || entry.product_name || freshSilo.product_in_silo,
              };
            });
            console.log('[PlantPrefill] Enriched silo entries with current config values');
          }

        if (entries.utilities.length === 0 && freshEntries.utilities.length > 0) {
          entries.utilities = freshEntries.utilities;
          console.log('[PlantPrefill] Month exists but no utilities entries — created from config');
        }

        if (entries.utilities.length > 0 && freshEntries.utilities.length > 0) {
          const freshUtilitiesByKey = new Map(
            freshEntries.utilities.map((entry: any) => [resolveUtilityConfigKey(entry), entry])
          );

          entries.utilities = entries.utilities.map((entry: any) => {
            const freshUtility = freshUtilitiesByKey.get(resolveUtilityConfigKey(entry));
            if (!freshUtility) return entry;

            return {
              ...freshUtility,
              ...entry,
              utility_config_id: entry.utility_config_id || freshUtility.utility_config_id,
              utility_meter_config_id: entry.utility_meter_config_id || freshUtility.utility_meter_config_id,
              meter_name: freshUtility.meter_name || entry.meter_name,
              meter_number: freshUtility.meter_number || entry.meter_number,
              utility_type: freshUtility.utility_type || entry.utility_type,
              uom: freshUtility.uom || entry.uom,
              provider: freshUtility.provider || entry.provider,
              requires_photo: entry.requires_photo ?? freshUtility.requires_photo,
            };
          });
          console.log('[PlantPrefill] Enriched utilities entries with current config values');
        }

        if (!entries.diesel && freshEntries.diesel) {
          entries.diesel = freshEntries.diesel;
          console.log('[PlantPrefill] Month exists but no diesel entry — created from config');
        }

        if (entries.diesel && freshEntries.diesel) {
          entries.diesel = {
            ...freshEntries.diesel,
            ...entries.diesel,
            diesel_config_id: entries.diesel.diesel_config_id || freshEntries.diesel.diesel_config_id,
            plant_id: entries.diesel.plant_id || freshEntries.diesel.plant_id,
            unit: freshEntries.diesel.unit || entries.diesel.unit,
            reading_uom: freshEntries.diesel.reading_uom || entries.diesel.reading_uom,
            calibration_table: freshEntries.diesel.calibration_table || entries.diesel.calibration_table,
            tank_capacity_gallons: Number(freshEntries.diesel.tank_capacity_gallons ?? entries.diesel.tank_capacity_gallons) || 0,
            beginning_inventory: Number(entries.diesel.beginning_inventory ?? freshEntries.diesel.beginning_inventory) || 0,
          };
          console.log('[PlantPrefill] Enriched diesel entry with current config values');
        }

        if (entries.productos.length === 0 && freshEntries.productos.length > 0) {
          entries.productos = freshEntries.productos;
          console.log('[PlantPrefill] Month exists but no products entries — created from config');
        }

        if (entries.productos.length > 0 && freshEntries.productos.length > 0) {
          const freshProductsByKey = new Map(
            freshEntries.productos.map((entry: any) => [resolveProductConfigKey(entry), entry])
          );

          entries.productos = entries.productos.map((entry: any) => {
            const configKey = resolveProductConfigKey(entry);
            const freshProduct =
              freshProductsByKey.get(configKey) ||
              freshEntries.productos.find((freshEntry: any) => freshEntry.product_name === entry.product_name);
            if (!freshProduct) return entry;

            return {
              ...freshProduct,
              ...entry,
              product_config_id: configKey || freshProduct.product_config_id,
              producto_config_id: configKey || freshProduct.producto_config_id,
              product_name: freshProduct.product_name || entry.product_name,
              category: freshProduct.category || entry.category,
              measure_mode: freshProduct.measure_mode || entry.measure_mode,
              uom: freshProduct.uom || entry.uom,
              requires_photo: entry.requires_photo ?? freshProduct.requires_photo,
              reading_uom: freshProduct.reading_uom || entry.reading_uom,
              calibration_table: freshProduct.calibration_table || entry.calibration_table,
              tank_capacity: freshProduct.tank_capacity ?? entry.tank_capacity,
              unit_volume: freshProduct.unit_volume ?? entry.unit_volume,
              notes: entry.notes || freshProduct.notes,
            };
          });
          console.log('[PlantPrefill] Enriched products entries with current config values');
        }

        entries.aditivos = appendConfiguredEntries(
          entries.aditivos,
          freshEntries.aditivos,
          (entry: any) => entry.additive_config_id || entry.aditivo_config_id,
          inventoryMonth.status,
        );

        if (entries.aditivos.length > 0 && freshEntries.aditivos.length > 0) {
          const freshAdditivesByKey = new Map(
            freshEntries.aditivos.map((entry: any) => [entry.additive_config_id, entry])
          );

          entries.aditivos = entries.aditivos.map((entry: any) => {
            const configKey = entry.additive_config_id || entry.aditivo_config_id;
            const freshAdditive = freshAdditivesByKey.get(configKey);
            if (!freshAdditive) return entry;

            return {
              ...freshAdditive,
              ...entry,
              additive_config_id: configKey || freshAdditive.additive_config_id,
              additive_type: entry.additive_type || freshAdditive.additive_type,
              measurement_method: freshAdditive.measurement_method || entry.measurement_method,
              product_name: freshAdditive.product_name || freshAdditive.additive_name || entry.product_name,
              brand: freshAdditive.brand || entry.brand,
              uom: freshAdditive.uom || entry.uom,
              requires_photo: entry.requires_photo ?? freshAdditive.requires_photo,
              tank_name: freshAdditive.tank_name || entry.tank_name,
              calibration_curve_name: freshAdditive.calibration_curve_name || entry.calibration_curve_name,
              calibration_points: freshAdditive.calibration_points || entry.calibration_points,
              reading_uom: freshAdditive.reading_uom || entry.reading_uom,
              conversion_table: freshAdditive.conversion_table || entry.conversion_table,
              diameter: freshAdditive.diameter ?? entry.diameter,
              length: freshAdditive.length ?? entry.length,
              width: freshAdditive.width ?? entry.width,
              total_height: freshAdditive.total_height ?? entry.total_height,
              capacity: freshAdditive.capacity ?? entry.capacity,
              dimension_unit_id: freshAdditive.dimension_unit_id || entry.dimension_unit_id,
              capacity_unit_id: freshAdditive.capacity_unit_id || entry.capacity_unit_id,
            };
          });
          console.log('[PlantPrefill] Enriched additives entries with current config values');
        }

        if (!entries.pettyCash && freshEntries.pettyCash) {
          entries.pettyCash = freshEntries.pettyCash;
          console.log('[PlantPrefill] Month exists but no petty cash entry — created from config');
        }

        if (entries.pettyCash && freshEntries.pettyCash) {
          entries.pettyCash = {
            ...freshEntries.pettyCash,
            ...entries.pettyCash,
            petty_cash_config_id: entries.pettyCash.petty_cash_config_id || freshEntries.pettyCash.petty_cash_config_id,
            established_amount: Number(entries.pettyCash.established_amount ?? freshEntries.pettyCash.established_amount) || 0,
            currency: entries.pettyCash.currency || freshEntries.pettyCash.currency,
          };
          console.log('[PlantPrefill] Enriched petty cash entry with current config values');
        }

          console.log('[PlantPrefill] Using existing entries');
        } else {
          // Create empty entries from config
          entries = await createEmptyEntriesFromConfig(
            inventoryMonth.id,
            config,
            previousMonth
          );
          console.log('[PlantPrefill] Created empty entries from config');
        }

        // 5. Apply carry-over from previous month if available
        if (previousMonthData) {
          entries = applyCarryOver(entries, previousMonthData);
          console.log('[PlantPrefill] Applied carry-over from previous month');
        } else if (entries.utilities && entries.utilities.length > 0) {
          // Existing rows from the first inventory month may still contain legacy
          // placeholder readings. With no history, the current reading is the baseline.
          entries.utilities = entries.utilities.map((entry: any) => ({
            ...entry,
            previous_reading: null,
            consumption: null,
          }));
        }

        if (loadSequence !== loadSequenceRef.current || currentUserRef.current !== user?.id) return;
        acceptInventorySnapshot(monthResponse.data!);
        loadedByRef.current = user?.id;
        activityMonthRef.current = inventoryMonth?.id || null;
        // 6. Update state
        let loaded: PrefillData = {
          inventoryMonth,
          previousMonth,
          config,
          silosEntries: entries.silos,
          agregadosEntries: entries.agregados,
          aditivosEntries: entries.aditivos,
          dieselEntry: entries.diesel,
          productosEntries: entries.productos,
          utilitiesEntries: entries.utilities,
          metersEntries: entries.meters,
          pettyCashEntry: entries.pettyCash,
          loading: false,
          error: null,
        };
        const scope = inventoryScopeKey(projectId, user!.id, plantId, yearMonth);
        try { await inventoryDraftStore.put(`view:${scope}`, { data: loaded, revisions: monthResponse.data?.section_revisions || {}, protocol: monthResponse.data?.sync_protocol }); }
        catch { /* The engine exposes a storage failure for every editable section. */ }
        loaded = await installDrafts(loaded, monthResponse.data?.section_revisions || {}, true, monthResponse.data?.sync_protocol === 2);
        if (loadSequence !== loadSequenceRef.current || currentUserRef.current !== user?.id) return;
        prefillRef.current = loaded;
        setPrefillData(loaded);
        dirtySectionRevisionsRef.current = {};
        setDirtySectionRevisions({});

        console.log('[PlantPrefill] Data loaded successfully');
      } catch (error) {
        console.error('[PlantPrefill] Error loading plant data:', error);
        if (loadSequence !== loadSequenceRef.current || currentUserRef.current !== user?.id) return;
        if (canRecoverOffline && user && ['plant_manager','operations_manager'].includes(user.role)) {
          try {
            const scope = inventoryScopeKey(projectId, user.id, plantId, yearMonth);
            const cached = await inventoryDraftStore.get(`view:${scope}`);
            if (cached?.data && loadSequence === loadSequenceRef.current && currentUserRef.current === user.id) {
              const restored = await installDrafts({ ...cached.data, loading: false, error: null }, cached.revisions || {}, false, cached.protocol === 2);
              if (loadSequence !== loadSequenceRef.current || currentUserRef.current !== user.id) return;
              prefillRef.current = restored; activityMonthRef.current = restored.inventoryMonth?.id || null;
              loadedByRef.current = user.id;
              setPrefillData(restored); return;
            }
          } catch { /* No offline snapshot; keep the actionable load error. */ }
        }
        setPrefillData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      } finally {
        if (inFlightLoadKeyRef.current === requestKey) {
          inFlightLoadKeyRef.current = null;
          inFlightLoadRef.current = null;
        }
      }
    })();

    inFlightLoadKeyRef.current = requestKey;
    inFlightLoadRef.current = loadPromise;
    return loadPromise;
  }, [allPlants, applyCarryOver, createEmptyEntriesFromConfig, currentPlantId, currentYearMonth, getResolvedAggregatesConfig, prefillData.error, prefillData.inventoryMonth, prefillData.loading, resolveProductConfigKey, resolveUtilityConfigKey, installDrafts, user]);

  const loadPlantData = useCallback(async (plantId: string, yearMonth: string) => {
    await loadPlantDataInternal(plantId, yearMonth);
  }, [loadPlantDataInternal]);

  // ============================================================================
  // REFRESH FUNCTION
  // ============================================================================
  
  const refreshData = useCallback(async () => {
    if (currentPlantId && currentYearMonth) {
      await loadPlantDataInternal(currentPlantId, currentYearMonth, { force: true });
    }
  }, [currentPlantId, currentYearMonth, loadPlantDataInternal]);

  // ============================================================================
  // UPDATE ENTRY (local state only)
  // ============================================================================
  
  const updateEntry = useCallback((section: string, entryId: string, data: any) => {
    const server = toServerSection(section);
    const field = sectionFields[server];
    if (!field || prefillRef.current.loading || loadedByRef.current !== user?.id || prefillRef.current.inventoryMonth?.status !== 'IN_PROGRESS') return;
    const previous = prefillRef.current;
    const current = previous[field];
    // Ignore delayed photo callbacks from an entry that is no longer open.
    if (Array.isArray(current) ? !current.some((entry: any) => entry.id === entryId) : current?.id !== entryId) return;
    const monthId = activityMonthRef.current;
    const captureKey = `${user?.id}:${monthId}:${server}`;
    if (monthId && !reportedCaptureRef.current.has(captureKey)) {
      reportedCaptureRef.current.add(captureKey);
      void recordInventoryCaptureStarted(monthId, server).then(response => {
        if (!response.success) reportedCaptureRef.current.delete(captureKey);
      }).catch(() => reportedCaptureRef.current.delete(captureKey));
    }
    const nextRevision = (dirtySectionRevisionsRef.current[section] || 0) + 1;
    dirtySectionRevisionsRef.current = { ...dirtySectionRevisionsRef.current, [section]: nextRevision };
    setDirtySectionRevisions(dirtySectionRevisionsRef.current);
    const updated = Array.isArray(current)
      ? current.map((entry: any) => entry.id === entryId ? { ...entry, ...data } : entry)
      : { ...current, ...data };
    const next = { ...previous, [field]: updated };
    prefillRef.current = next;
    setPrefillData(next);
    syncRef.current?.change(server, rowsFor(next, server));
  }, [user?.id]);

  const saveSection = useCallback(async (section: string) => {
    const server = toServerSection(section); const engine = syncRef.current;
    if (!engine || prefillRef.current.inventoryMonth?.status !== 'IN_PROGRESS') return { success:false, error:'Este inventario no permite guardar. Vuelve a cargarlo.' };
    if (!engine.drafts.has(server)) return { success:false, error:'No se pudo conservar el borrador en este dispositivo. Exporta tus cambios.' };
    const draft = engine.drafts.get(server)!;
    if (draft.generation === draft.acknowledged && !draft.operation) engine.change(server, rowsFor(prefillRef.current,server), false);
    return engine.flush(server);
  }, []);
  const flushDrafts = useCallback(async () => {
    return syncRef.current ? syncRef.current.flushAll() : false;
  }, []);
  const resolveDraft = useCallback(async (section: string, keepLocal: boolean, reviewedRevision?: number) => {
    const engine = syncRef.current; const month = prefillRef.current.inventoryMonth;
    if (!engine || !month) throw new Error('Selecciona el inventario.');
    const snapshot = await getInventoryMonth(month.plant_id,month.year_month);
    if (syncRef.current !== engine || prefillRef.current.inventoryMonth?.id !== month.id) throw new Error('El inventario abierto cambió.');
    if (!snapshot.success || !snapshot.data) throw new Error(snapshot.error || 'No se pudo consultar el servidor.');
    if (snapshot.data.month.status !== 'IN_PROGRESS') throw new Error('El inventario fue enviado o aprobado; el borrador sigue conservado y no se enviará.');
    if (keepLocal && snapshot.data.section_revisions?.[section] !== reviewedRevision) throw new Error('El servidor volvió a cambiar. Consulta las diferencias otra vez.');
    const property = ({aggregates:'agregados',additives:'aditivos',products:'productos','petty-cash':'pettyCash'} as Record<string,string>)[section] || section;
    const value = (snapshot.data as any)[property];
    await engine.resolve(section, Array.isArray(value) ? value : value ? [value] : [], snapshot.data.section_revisions?.[section] || 0, keepLocal);
    if (!keepLocal) await loadPlantDataInternal(month.plant_id,month.year_month,{force:true});
  }, [loadPlantDataInternal]);
  const exportDrafts = useCallback(() => {
    const data = { environment: projectId, userId: currentUserRef.current, inventory: prefillRef.current.inventoryMonth, data: prefillRef.current, drafts: [...(syncRef.current?.drafts.values() || [])] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = `borrador-promix-${data.inventory?.year_month || 'pendiente'}.json`; link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }, []);

  const getSectionRevision = useCallback((section: string) => (
    dirtySectionRevisionsRef.current[section] || 0
  ), []);

  const markChangesSaved = useCallback((section: string, savedRevision: number) => {
    if ((dirtySectionRevisionsRef.current[section] || 0) !== savedRevision) return;

    const nextRevisions = { ...dirtySectionRevisionsRef.current };
    delete nextRevisions[section];
    dirtySectionRevisionsRef.current = nextRevisions;
    setDirtySectionRevisions(nextRevisions);
  }, []);

  const sectionAliases: Record<string, string> = {
    aceites: 'productos',
    utilidades: 'utilities',
    'petty-cash': 'pettyCash',
  };
  const hasPendingChangesForSection = useCallback((section: string | null | undefined) => {
    if (!section) return false;
    const normalizedSection = sectionAliases[section] || section;
    const draft = syncRef.current?.drafts.get(toServerSection(normalizedSection));
    return Object.prototype.hasOwnProperty.call(dirtySectionRevisionsRef.current, normalizedSection) || !!(draft && (draft.operation || draft.generation > draft.acknowledged));
  }, []);
  const hasPendingChanges = Object.keys(dirtySectionRevisions).length > 0 || !!syncRef.current?.hasPending();

  return (
    <PlantPrefillContext.Provider
      value={{
        prefillData,
        syncStates, saveSection, flushDrafts, resolveDraft, exportDrafts,
        hasUnprotectedChanges: Object.values(syncStates).some(state => !state.localSaved && state.state !== 'server'),
        hasPendingChanges,
        hasPendingChangesForSection,
        loadPlantData,
        currentYearMonth: getCurrentYearMonth(),
        setSelectedYearMonth,
        getCurrentYearMonth,
        refreshData,
        updateEntry,
        getSectionRevision,
        markChangesSaved,
      }}
    >
      {children}
    </PlantPrefillContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function usePlantPrefill() {
  const context = useContext(PlantPrefillContext);
  if (!context) {
    throw new Error('usePlantPrefill must be used within PlantPrefillProvider');
  }
  return context;
}
