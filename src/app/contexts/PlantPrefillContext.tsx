import React, { createContext, useContext, useState, useCallback } from 'react';
import { 
  getPlantConfig, 
  getInventoryMonth,
  createInventoryMonth,
  PlantConfigPackage,
  InventoryMonth 
} from '../utils/api';
import { getDieselConfig } from '../config/dieselConfig';
import { getPlantProductsConfig } from '../config/productsConfig';
import { getPlantUtilitiesConfig } from '../config/utilitiesConfig';
import { getPettyCashConfig } from '../config/pettyCashConfig';
import { useAuth } from './AuthContext';

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
  loadPlantData: (plantId: string, yearMonth: string) => Promise<void>;
  currentYearMonth: string;
  setSelectedYearMonth: (yearMonth: string) => void;
  getCurrentYearMonth: () => string;
  refreshData: () => Promise<void>;
  updateEntry: (section: string, entryId: string, data: any) => void;
}

const PlantPrefillContext = createContext<PlantPrefillContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function PlantPrefillProvider({ children }: { children: React.ReactNode }) {
  const [prefillData, setPrefillData] = useState<PrefillData>({
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
  });

  const [currentPlantId, setCurrentPlantId] = useState<string | null>(null);
  const [currentYearMonth, setCurrentYearMonth] = useState<string | null>(null);

  const { allPlants, user } = useAuth();

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
    const cajones = currentPlant?.cajones || [];

    // Backward compatibility: some plants only have cajones configured and no
    // plant_aggregates_config rows yet. Build BOX aggregates from those cajones.
    return cajones.map((cajon: any, index: number) => ({
      id: `fallback_cajon_${cajon.id || index}`,
      aggregate_name: cajon.name,
      material_type: cajon.material || 'AGREGADO',
      location_area: cajon.procedencia || cajon.name,
      measurement_method: 'BOX',
      unit: 'CUBIC_YARDS',
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
      allowed_products: silo.allowed_products || [], // Products allowed for this silo
      product_id: null, // To be selected by manager
      product_name: null, // To be selected by manager
      product_in_silo: null,
      previous_reading: 0,
      reading_value: 0, // The actual reading in the configured unit
      reading: 0,
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
      box_length_ft: 0, // To be filled by manager
      // CONE fields
      cone_m1: 0,
      cone_m2: 0,
      cone_m3: 0,
      cone_m4: 0,
      cone_m5: 0,
      cone_m6: 0,
      cone_d1: 0,
      cone_d2: 0,
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
        product_name: aditivo.product_name || aditivo.additive_name,
        brand: aditivo.brand || '',
        uom: aditivo.uom || '',
        requires_photo: aditivo.requires_photo ?? false,
        // Tank-specific fields
        tank_name: aditivo.tank_name || null,
        reading_uom: aditivo.reading_uom || null,
        reading_value: 0,
        reading: 0,
        previous_reading: 0,
        calculated_volume: 0,
        calculated_gallons: 0,
        conversion_table: aditivo.conversion_table || null,
        // Manual-specific fields
        quantity: 0,
        // Common fields
        photo_url: null,
        notes: '',
        _isNew: true,
      });
    });

    // DIESEL: Single entry with LOCAL config (not from API)
    const dieselConfig = getDieselConfig(config.plant_id || '');
    
    if (dieselConfig) {
      entries.diesel = {
        id: `temp_diesel_${Date.now()}`,
        inventory_month_id: inventoryMonthId,
        diesel_config_id: config.diesel?.id,
        plant_id: config.plant_id,
        unit: 'gallons',
        // Calibration data from local config
        reading_uom: dieselConfig.reading_uom,
        calibration_table: dieselConfig.calibration_table,
        tank_capacity_gallons: dieselConfig.tank_capacity_gallons,
        // Reading and calculated fields
        reading_inches: 0, // To be filled by manager
        calculated_gallons: 0, // Calculated from reading_inches using calibration_table
        // Inventory flow: beginning + purchases - ending = consumption
        beginning_inventory: dieselConfig.initial_inventory_gallons || 0, // Will be updated from previous month
        purchases_gallons: 0, // To be filled by manager
        ending_inventory: 0, // Equals calculated_gallons from reading
        consumption_gallons: 0, // Calculated: beginning + purchases - ending
        // Common fields
        photo_url: null,
        notes: '',
        _isNew: true,
      };
    } else {
      console.warn(`[PlantPrefill] No diesel config found for plant ${config.plant_id}`);
      entries.diesel = null;
    }

    // PRODUCTOS: Create entry for each producto in LOCAL config (not from API)
    const localProductsConfig = getPlantProductsConfig(config.plant_id || '');
    
    if (localProductsConfig) {
      entries.productos = localProductsConfig.products.map((producto: any) => ({
        id: `temp_${producto.id}_${Date.now()}_${Math.random()}`,
        inventory_month_id: inventoryMonthId,
        producto_config_id: producto.id,
        product_name: producto.product_name,
        category: producto.category,
        measure_mode: producto.measure_mode,
        uom: producto.uom,
        requires_photo: producto.requires_photo,
        // For TANK_READING mode
        reading_uom: producto.reading_uom || null,
        reading_value: 0, // To be filled by manager (for TANK_READING)
        calculated_quantity: 0, // Calculated from reading using calibration_table
        calibration_table: producto.calibration_table || null,
        tank_capacity: producto.tank_capacity || null,
        // For DRUM/PAIL mode
        unit_count: 0, // Number of drums/pails (to be filled by manager)
        unit_volume: producto.unit_volume || null, // Volume per unit (e.g., 55 gal/drum)
        total_volume: 0, // Calculated: unit_count * unit_volume
        // For COUNT mode
        quantity: 0, // Direct quantity count (to be filled by manager, MUST be 0 if empty, not null)
        // Common fields
        photo_url: null,
        notes: producto.notes || '',
        _isNew: true,
      }));
    } else {
      console.warn(`[PlantPrefill] No local products config found for plant ${config.plant_id}`);
      entries.productos = [];
    }

    // UTILITIES: Create entry for each utility meter in LOCAL config (not from API)
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
        // Reading flow: previous reading comes from previous month
        previous_reading: Number(meter.initial_reading ?? fallbackMeter.initial_reading) || 0, // Will be updated from previous month
        current_reading: 0, // To be filled by manager (MAIN FOCUS)
        consumption: 0, // Calculated: current - previous
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
      receipts: 0, // Total of receipts in USD
      cash: 0, // Cash on hand in USD
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
          (p: any) => p.producto_config_id === entry.producto_config_id
        );
        if (prevProducto) {
          entry.beginning = prevProducto.ending || 0;
        }
      });
    }

    // UTILITIES: previous_reading = previous month's current_reading
    if (previousMonthData.utilities && previousMonthData.utilities.length > 0) {
      entries.utilities.forEach((entry: any) => {
        const entryKey = resolveUtilityConfigKey(entry);
        const prevUtility = previousMonthData.utilities.find(
          (u: any) => resolveUtilityConfigKey(u) === entryKey
        );
        if (prevUtility) {
          entry.previous_reading = prevUtility.current_reading || 0;
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
  
  const loadPlantData = useCallback(async (plantId: string, yearMonth: string) => {
    setPrefillData(prev => ({ ...prev, loading: true, error: null }));
    setCurrentPlantId(plantId);
    setCurrentYearMonth(yearMonth);

    try {
      console.log(`[PlantPrefill] Loading data for plant ${plantId}, month ${yearMonth}`);

      // 1. Load plant configuration
      const configResponse = await getPlantConfig(plantId);
      if (!configResponse.success || !configResponse.data) {
        throw new Error(`Failed to load plant config: ${configResponse.error}`);
      }
      const config = configResponse.data;
      console.log('[PlantPrefill] Config loaded:', config);

      // 2. Try to load current month inventory
      let inventoryMonth: InventoryMonth | null = null;
      const monthResponse = await getInventoryMonth(plantId, yearMonth);
      
      console.log('[PlantPrefill] getInventoryMonth response:', monthResponse);
      
      if (monthResponse.success && monthResponse.data) {
        inventoryMonth = monthResponse.data.month;
        console.log('[PlantPrefill] Current month found:', inventoryMonth);
      } else {
        // Create new month if it doesn't exist
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
          
          inventoryMonth = createResponse.data;
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

      // 3. Try to load previous month for carry-over
      const previousMonthStr = getPreviousMonth(yearMonth);
      console.log('[PlantPrefill] Attempting to load previous month:', previousMonthStr);
      
      const prevMonthResponse = await getInventoryMonth(plantId, previousMonthStr);
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
            };
          });
        }
        
        // If month exists but has no aggregate entries yet, create from config
        const resolvedAggregates = getResolvedAggregatesConfig(config);

        if (entries.agregados.length === 0 && resolvedAggregates.length > 0) {
          const freshEntries = await createEmptyEntriesFromConfig(inventoryMonth.id, config, previousMonth);
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
              // BOX dimensions: use aggConfig → cajón config → existing entry value
              box_width_ft: aggConfig.box_width_ft || matchingCajon?.ancho || entry.box_width_ft,
              box_height_ft: aggConfig.box_height_ft || matchingCajon?.alto || entry.box_height_ft,
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
          const freshEntries = await createEmptyEntriesFromConfig(inventoryMonth.id, config, previousMonth);
          entries.silos = freshEntries.silos;
          console.log('[PlantPrefill] Month exists but no silo entries — created from config');
        }

        const freshEntries = await createEmptyEntriesFromConfig(inventoryMonth.id, config, previousMonth);

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

        if (entries.aditivos.length === 0 && freshEntries.aditivos.length > 0) {
          entries.aditivos = freshEntries.aditivos;
          console.log('[PlantPrefill] Month exists but no additives entries — created from config');
        }

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
              product_name: freshAdditive.product_name || freshAdditive.additive_name || entry.product_name,
              brand: freshAdditive.brand || entry.brand,
              uom: freshAdditive.uom || entry.uom,
              requires_photo: entry.requires_photo ?? freshAdditive.requires_photo,
              tank_name: freshAdditive.tank_name || entry.tank_name,
              reading_uom: freshAdditive.reading_uom || entry.reading_uom,
              conversion_table: freshAdditive.conversion_table || entry.conversion_table,
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
      }

      // 6. Update state
      setPrefillData({
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
      });

      console.log('[PlantPrefill] Data loaded successfully');
    } catch (error) {
      console.error('[PlantPrefill] Error loading plant data:', error);
      setPrefillData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [allPlants, applyCarryOver, createEmptyEntriesFromConfig, getResolvedAggregatesConfig, resolveUtilityConfigKey, user]);

  // ============================================================================
  // REFRESH FUNCTION
  // ============================================================================
  
  const refreshData = useCallback(async () => {
    if (currentPlantId && currentYearMonth) {
      await loadPlantData(currentPlantId, currentYearMonth);
    }
  }, [currentPlantId, currentYearMonth, loadPlantData]);

  // ============================================================================
  // UPDATE ENTRY (local state only)
  // ============================================================================
  
  const updateEntry = useCallback((section: string, entryId: string, data: any) => {
    setPrefillData(prev => {
      const sectionKeyMap: Record<string, keyof PrefillData> = {
        silos: 'silosEntries',
        agregados: 'agregadosEntries',
        aditivos: 'aditivosEntries',
        productos: 'productosEntries',
        utilities: 'utilitiesEntries',
        meters: 'metersEntries',
        diesel: 'dieselEntry',
        pettyCash: 'pettyCashEntry',
      };
      const sectionKey = sectionKeyMap[section];

      if (!sectionKey) {
        return prev;
      }

      const currentEntries = prev[sectionKey];
      
      if (Array.isArray(currentEntries)) {
        return {
          ...prev,
          [sectionKey]: currentEntries.map((entry: any) =>
            entry.id === entryId ? { ...entry, ...data } : entry
          ),
        };
      } else if (currentEntries && typeof currentEntries === 'object') {
        // For single entry sections (diesel, pettyCash)
        return {
          ...prev,
          [sectionKey]: { ...currentEntries, ...data },
        };
      }
      
      return prev;
    });
  }, []);

  return (
    <PlantPrefillContext.Provider
      value={{
        prefillData,
        loadPlantData,
        currentYearMonth: getCurrentYearMonth(),
        setSelectedYearMonth,
        getCurrentYearMonth,
        refreshData,
        updateEntry,
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
