import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuth } from '../../contexts/AuthContext';
import {
  getMaterialConversionFactors,
  getPlantConfig,
  getPlantMeasurementConfigs,
  getUnitCategories,
  getUnits,
  updatePlantMeasurementConfigs,
  type MaterialConversionFactor,
  type MeasurementConfig,
  type UnitCategory,
  type UnitDefinition,
} from '../../utils/api';

const SECTION_OPTIONS = [
  { value: 'aggregates', label: 'Agregados' },
  { value: 'additives', label: 'Aditivos' },
  { value: 'silos', label: 'Silos' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'products', label: 'Productos' },
  { value: 'utilities', label: 'Utilidades' },
];

function getUnitCategory(units: UnitDefinition[], unitId?: string | null) {
  return units.find((unit) => unit.id === unitId)?.category_id || null;
}

function UnitSelect({
  units,
  value,
  onChange,
  categoryId,
}: {
  units: UnitDefinition[];
  value: string;
  onChange: (value: string) => void;
  categoryId?: string | null;
}) {
  const visibleUnits = categoryId ? units.filter((unit) => unit.category_id === categoryId) : units;
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm"
    >
      {visibleUnits.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {unit.symbol} - {unit.name_es}
        </option>
      ))}
    </select>
  );
}

export function UnitsPanel() {
  const { user, allPlants } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'super_admin';
  const [selectedPlantId, setSelectedPlantId] = useState(allPlants[0]?.id || '');
  const [categories, setCategories] = useState<UnitCategory[]>([]);
  const [units, setUnits] = useState<UnitDefinition[]>([]);
  const [configs, setConfigs] = useState<MeasurementConfig[]>([]);
  const [factors, setFactors] = useState<MaterialConversionFactor[]>([]);
  const [curves, setCurves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!selectedPlantId && allPlants.length > 0) setSelectedPlantId(allPlants[0].id);
  }, [allPlants, selectedPlantId]);

  useEffect(() => {
    const loadCatalogs = async () => {
      const [categoryResponse, unitResponse] = await Promise.all([
        getUnitCategories(),
        getUnits(),
      ]);
      if (categoryResponse.success && categoryResponse.data) setCategories(categoryResponse.data);
      if (unitResponse.success && unitResponse.data) setUnits(unitResponse.data);
    };
    loadCatalogs();
  }, []);

  useEffect(() => {
    if (!selectedPlantId) return;

    const loadPlantConfig = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const [configsResponse, plantConfigResponse, factorsResponse] = await Promise.all([
          getPlantMeasurementConfigs(selectedPlantId),
          getPlantConfig(selectedPlantId),
          getMaterialConversionFactors({ plantId: selectedPlantId }),
        ]);

        if (!configsResponse.success) throw new Error(configsResponse.error || 'No se pudieron cargar las configuraciones.');
        const plantSpecificConfigs = (configsResponse.data || []).filter((config) => config.plant_id === selectedPlantId);
        setConfigs(plantSpecificConfigs);
        setCurves(Object.values(plantConfigResponse.data?.calibration_curves || {}));
        setFactors(factorsResponse.data || []);
      } catch (error) {
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error cargando unidades.' });
      } finally {
        setLoading(false);
      }
    };

    loadPlantConfig();
  }, [selectedPlantId]);

  const unitsByCategory = useMemo(() => (
    categories.map((category) => ({
      ...category,
      units: units.filter((unit) => unit.category_id === category.id),
    }))
  ), [categories, units]);

  const addConfig = () => {
    setConfigs((prev) => [
      ...prev,
      {
        plant_id: selectedPlantId,
        section_code: 'aggregates',
        capture_unit_id: 'ft',
        calculation_unit_id: 'ft3',
        display_unit_id: 'ft3',
        inventory_unit_id: 'ft3',
        active: true,
        sort_order: prev.length + 1,
      },
    ]);
  };

  const updateConfig = (index: number, patch: Partial<MeasurementConfig>) => {
    setConfigs((prev) => prev.map((config, configIndex) => (
      configIndex === index ? { ...config, ...patch } : config
    )));
  };

  const removeConfig = (index: number) => {
    setConfigs((prev) => prev.filter((_, configIndex) => configIndex !== index));
  };

  const validateBeforeSave = () => {
    for (const config of configs) {
      const calculationCategory = getUnitCategory(units, config.calculation_unit_id);
      const displayCategory = getUnitCategory(units, config.display_unit_id);
      const inventoryCategory = getUnitCategory(units, config.inventory_unit_id);
      const captureCategory = getUnitCategory(units, config.capture_unit_id);

      if (!config.section_code) return 'Cada configuracion debe tener seccion.';
      if (calculationCategory !== displayCategory) return 'Calculo y visualizacion deben estar en la misma categoria.';
      if (captureCategory !== calculationCategory && !config.calibration_curve_id) {
        return 'Las capturas que cruzan categorias requieren curva de calibracion.';
      }
      if (calculationCategory !== inventoryCategory && !config.material_conversion_factor_id) {
        return 'El inventario que cruza categorias requiere factor por material.';
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!canEdit || !selectedPlantId) return;
    const validationError = validateBeforeSave();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setLoading(true);
    setMessage(null);
    const response = await updatePlantMeasurementConfigs(selectedPlantId, configs);
    setLoading(false);
    if (!response.success) {
      setMessage({ type: 'error', text: response.error || 'No se pudieron guardar las unidades.' });
      return;
    }
    setConfigs(response.data || configs);
    setMessage({ type: 'success', text: 'Configuracion de unidades guardada.' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg text-[#3B3A36]">Unidades por Contexto</h3>
          <p className="mt-1 text-sm text-[#5F6773]">
            Define unidades por planta y seccion. Los defaults globales solo se usan cuando una planta no tiene configuracion especifica.
          </p>
        </div>
        <select
          value={selectedPlantId}
          onChange={(event) => setSelectedPlantId(event.target.value)}
          className="rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm"
        >
          {allPlants.map((plant) => (
            <option key={plant.id} value={plant.id}>{plant.name}</option>
          ))}
        </select>
      </div>

      {message && (
        <div className={`rounded border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'border-[#2ecc71]/30 bg-[#2ecc71]/10 text-[#17693a]'
            : 'border-red-300 bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <Card noPadding>
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_80px] gap-3 bg-[#3B3A36] px-4 py-3 text-sm font-medium text-white">
          <span>Seccion</span>
          <span>Captura</span>
          <span>Calculo</span>
          <span>Visible</span>
          <span>Inventario</span>
          <span>Regla especial</span>
          <span></span>
        </div>

        <div className="divide-y divide-[#F2F3F5]">
          {configs.map((config, index) => {
            const calculationCategory = getUnitCategory(units, config.calculation_unit_id);
            const needsCurve = getUnitCategory(units, config.capture_unit_id) !== calculationCategory;
            const needsFactor = getUnitCategory(units, config.inventory_unit_id) !== calculationCategory;

            return (
              <div key={config.id || index} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_80px] gap-3 px-4 py-4 text-sm">
                <select
                  value={config.section_code || ''}
                  onChange={(event) => updateConfig(index, { section_code: event.target.value })}
                  disabled={!canEdit}
                  className="rounded border border-[#9D9B9A] bg-white px-3 py-2"
                >
                  {SECTION_OPTIONS.map((section) => (
                    <option key={section.value} value={section.value}>{section.label}</option>
                  ))}
                </select>

                <UnitSelect units={units} value={config.capture_unit_id} onChange={(value) => updateConfig(index, { capture_unit_id: value })} />
                <UnitSelect units={units} value={config.calculation_unit_id} onChange={(value) => updateConfig(index, { calculation_unit_id: value })} />
                <UnitSelect units={units} value={config.display_unit_id} onChange={(value) => updateConfig(index, { display_unit_id: value })} categoryId={calculationCategory} />
                <UnitSelect units={units} value={config.inventory_unit_id} onChange={(value) => updateConfig(index, { inventory_unit_id: value })} />

                <div className="space-y-2">
                  {needsCurve && (
                    <select
                      value={config.calibration_curve_id || ''}
                      onChange={(event) => updateConfig(index, { calibration_curve_id: event.target.value || null })}
                      className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2"
                    >
                      <option value="">Curva requerida</option>
                      {curves.map((curve: any) => (
                        <option key={curve.id} value={curve.id}>{curve.curve_name}</option>
                      ))}
                    </select>
                  )}
                  {needsFactor && (
                    <select
                      value={config.material_conversion_factor_id || ''}
                      onChange={(event) => updateConfig(index, { material_conversion_factor_id: event.target.value || null })}
                      className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2"
                    >
                      <option value="">Factor requerido</option>
                      {factors.map((factor) => (
                        <option key={factor.id} value={factor.id}>{`${factor.from_unit_id} -> ${factor.to_unit_id}`}</option>
                      ))}
                    </select>
                  )}
                  {!needsCurve && !needsFactor && <span className="text-[#5F6773]">Estandar</span>}
                </div>

                <Button variant="ghost" size="sm" onClick={() => removeConfig(index)} disabled={!canEdit}>
                  Quitar
                </Button>
              </div>
            );
          })}

          {configs.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[#5F6773]">
              Esta planta no tiene configuraciones especificas. Se usaran defaults globales hasta que agregues una fila.
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-xs text-[#5F6773]">
          Categorias disponibles: {unitsByCategory.map((category) => `${category.name_es} (${category.units.length})`).join(', ')}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={addConfig} disabled={!canEdit || loading}>Agregar configuracion</Button>
          <Button onClick={handleSave} disabled={!canEdit || loading} className="bg-[#2475C7] text-white hover:bg-[#1f66ad]">
            {loading ? 'Guardando...' : 'Guardar unidades'}
          </Button>
        </div>
      </div>
    </div>
  );
}
