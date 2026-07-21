import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuth } from '../../contexts/AuthContext';
import { exportSettingsWorkbook } from '../../utils/exportSettingsWorkbooks';
import {
  createMaterialConversionFactor,
  createUnit,
  deleteMaterialConversionFactor,
  deleteUnit,
  getMaterialConversionFactors,
  getMateriales,
  getPlantConfig,
  getPlantMeasurementConfigs,
  getUnitCategories,
  getUnits,
  updateMaterialConversionFactor,
  updatePlantMeasurementConfigs,
  updateUnit,
  type MaterialConversionFactor,
  type MaterialCatalogItem,
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

const SECTION_FORMULAS: Record<string, string> = {
  aggregates: 'Volumen = ancho x alto x largo o formula de cono',
  additives: 'Lectura del tanque -> galones por curva de calibracion',
  silos: 'Lectura del silo -> cantidad por curva de calibracion',
  diesel: 'Pulgadas medidas -> galones por tabla tecnica del tanque',
  products: 'Cantidad = conteo directo, unidades por envase o curva si es tanque',
  utilities: 'Consumo = lectura actual - lectura anterior',
};

const CALIBRATION_REQUIRED_SECTIONS = new Set(['additives', 'silos', 'diesel', 'products']);
const SECTION_FORMULA_CROSS_CATEGORY_SECTIONS = new Set(['aggregates']);

const MEASUREMENT_SYSTEM_OPTIONS = [
  { value: 'metric', label: 'Metrico' },
  { value: 'imperial', label: 'Imperial' },
  { value: 'us_customary', label: 'US customary' },
  { value: 'operational', label: 'Operacional' },
];

const EMPTY_UNIT_FORM = {
  id: '',
  category_id: 'length',
  code: '',
  name_es: '',
  name_en: '',
  symbol: '',
  measurement_system: 'metric' as UnitDefinition['measurement_system'],
  factor_to_base: '1',
  decimal_precision: '2',
  sort_order: '0',
};

const EMPTY_FACTOR_FORM = {
  id: '',
  material_id: '',
  plant_id: '',
  from_unit_id: 'm3',
  to_unit_id: 'lb',
  factor: '',
  factor_source: '',
  effective_from: '',
  effective_to: '',
};

function sectionRequiresCalibration(sectionCode?: string | null) {
  return CALIBRATION_REQUIRED_SECTIONS.has(sectionCode || '');
}

function sectionUsesFormulaAcrossCategories(sectionCode?: string | null) {
  return SECTION_FORMULA_CROSS_CATEGORY_SECTIONS.has(sectionCode || '');
}

function getUnitCategory(units: UnitDefinition[], unitId?: string | null) {
  return units.find((unit) => unit.id === unitId)?.category_id || null;
}

function getUnit(units: UnitDefinition[], unitId?: string | null) {
  return units.find((unit) => unit.id === unitId) || null;
}

function getUnitLabel(units: UnitDefinition[], unitId?: string | null) {
  const unit = getUnit(units, unitId);
  return unit ? `${unit.symbol} - ${unit.name_es}` : 'Sin unidad';
}

function getCategoryLabel(categories: UnitCategory[], categoryId?: string | null) {
  return categories.find((category) => category.id === categoryId)?.name_es || categoryId || '-';
}

function getBaseUnitForCategory(categories: UnitCategory[], units: UnitDefinition[], categoryId?: string | null) {
  const category = categories.find((item) => item.id === categoryId);
  return units.find((unit) => unit.id === category?.base_unit_id) || units.find((unit) => unit.category_id === categoryId && Number(unit.factor_to_base) === 1) || null;
}

function formatFactor(value: number) {
  if (!Number.isFinite(value)) return '-';
  return Number(value.toFixed(10)).toLocaleString('en-US', {
    maximumFractionDigits: 10,
  });
}

function describeStandardConversion(units: UnitDefinition[], fromUnitId: string, toUnitId: string) {
  const fromUnit = getUnit(units, fromUnitId);
  const toUnit = getUnit(units, toUnitId);
  if (!fromUnit || !toUnit) return 'Selecciona unidades para ver la conversion.';
  if (fromUnit.category_id !== toUnit.category_id) {
    return `No es conversion estandar: ${fromUnit.symbol} y ${toUnit.symbol} son categorias distintas.`;
  }
  if (fromUnit.id === toUnit.id) return `Sin conversion: se mantiene en ${fromUnit.symbol}.`;

  const factor = Number(fromUnit.factor_to_base) / Number(toUnit.factor_to_base);
  return `1 ${fromUnit.symbol} x ${formatFactor(factor)} = ${toUnit.symbol}`;
}

function getCurveLabel(curves: any[], curveId?: string | null) {
  const curve = curves.find((item) => item.id === curveId);
  if (!curve) return null;
  const firstPoint = curve.points?.[0];
  const sample = firstPoint
    ? ` Ejemplo: ${firstPoint.point_key} -> ${firstPoint.point_value}.`
    : '';
  return `${curve.curve_name}.${sample}`;
}

function getFactorLabel(factors: MaterialConversionFactor[], factorId?: string | null) {
  const factor = factors.find((item) => item.id === factorId);
  if (!factor) return null;
  return `${factor.from_unit_id} x ${formatFactor(Number(factor.factor))} = ${factor.to_unit_id}`;
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
  const [activeSubtab, setActiveSubtab] = useState<'sections' | 'catalog'>('sections');
  const [selectedPlantId, setSelectedPlantId] = useState(allPlants[0]?.id || '');
  const [categories, setCategories] = useState<UnitCategory[]>([]);
  const [units, setUnits] = useState<UnitDefinition[]>([]);
  const [materials, setMaterials] = useState<MaterialCatalogItem[]>([]);
  const [configs, setConfigs] = useState<MeasurementConfig[]>([]);
  const [factors, setFactors] = useState<MaterialConversionFactor[]>([]);
  const [curves, setCurves] = useState<any[]>([]);
  const [unitForm, setUnitForm] = useState(EMPTY_UNIT_FORM);
  const [factorForm, setFactorForm] = useState(EMPTY_FACTOR_FORM);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingFactorId, setEditingFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!selectedPlantId && allPlants.length > 0) setSelectedPlantId(allPlants[0].id);
  }, [allPlants, selectedPlantId]);

  const loadCatalogs = async () => {
      const [categoryResponse, unitResponse, materialsResponse] = await Promise.all([
        getUnitCategories(),
        getUnits(),
        getMateriales(),
      ]);
      if (categoryResponse.success && categoryResponse.data) setCategories(categoryResponse.data);
      if (unitResponse.success && unitResponse.data) setUnits(unitResponse.data);
      if (materialsResponse.success && materialsResponse.data) setMaterials(materialsResponse.data);
  };

  const loadFactors = async () => {
    const response = await getMaterialConversionFactors({ plantId: selectedPlantId || undefined });
    if (response.success && response.data) setFactors(response.data);
  };

  useEffect(() => {
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
        capture_unit_id: 'ft-in',
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
      if (
        captureCategory !== calculationCategory &&
        sectionRequiresCalibration(config.section_code) &&
        !config.calibration_curve_id
      ) {
        return 'Esta seccion requiere curva de calibracion para convertir captura a calculo.';
      }
      if (calculationCategory !== inventoryCategory && !config.material_conversion_factor_id) {
        return 'El inventario que cruza categorias requiere factor por material.';
      }
    }
    return null;
  };

  const getRuleState = (config: MeasurementConfig) => {
    const captureCategory = getUnitCategory(units, config.capture_unit_id);
    const calculationCategory = getUnitCategory(units, config.calculation_unit_id);
    const inventoryCategory = getUnitCategory(units, config.inventory_unit_id);
    const crossesCaptureCategory = captureCategory !== calculationCategory;
    const needsCurve = crossesCaptureCategory && sectionRequiresCalibration(config.section_code);
    const usesSectionFormula = crossesCaptureCategory && sectionUsesFormulaAcrossCategories(config.section_code);
    const needsFactor = calculationCategory !== inventoryCategory;

    if (needsCurve && !config.calibration_curve_id) return { label: 'Falta configurar', tone: 'error' as const };
    if (needsFactor && !config.material_conversion_factor_id) return { label: 'Falta configurar', tone: 'error' as const };
    if (needsCurve) return { label: 'Curva de calibracion', tone: 'warning' as const };
    if (needsFactor) return { label: 'Factor por material', tone: 'warning' as const };
    if (usesSectionFormula) return { label: 'Formula de seccion', tone: 'success' as const };
    return { label: 'Conversion estandar', tone: 'success' as const };
  };

  const renderExplanation = (config: MeasurementConfig) => {
    const captureCategory = getUnitCategory(units, config.capture_unit_id);
    const calculationCategory = getUnitCategory(units, config.calculation_unit_id);
    const displayCategory = getUnitCategory(units, config.display_unit_id);
    const inventoryCategory = getUnitCategory(units, config.inventory_unit_id);
    const crossesCaptureCategory = captureCategory !== calculationCategory;
    const needsCurve = crossesCaptureCategory && sectionRequiresCalibration(config.section_code);
    const usesSectionFormula = crossesCaptureCategory && sectionUsesFormulaAcrossCategories(config.section_code);
    const needsFactor = calculationCategory !== inventoryCategory;
    const curveLabel = getCurveLabel(curves, config.calibration_curve_id);
    const factorLabel = getFactorLabel(factors, config.material_conversion_factor_id);

    const rows = [
      {
        label: 'Formula de calculo',
        text: SECTION_FORMULAS[config.section_code || ''] || 'Formula definida por la seccion operativa.',
        tone: 'neutral',
      },
      {
        label: 'Captura a calculo',
        text: needsCurve
          ? curveLabel
            ? `Usa curva: ${curveLabel}`
            : `Curva requerida para convertir ${getUnitLabel(units, config.capture_unit_id)} a ${getUnitLabel(units, config.calculation_unit_id)}.`
          : usesSectionFormula
            ? `No requiere curva: ${SECTION_FORMULAS[config.section_code || '']} convierte ${getUnitLabel(units, config.capture_unit_id)} a ${getUnitLabel(units, config.calculation_unit_id)}.`
            : describeStandardConversion(units, config.capture_unit_id, config.calculation_unit_id),
        tone: needsCurve && !curveLabel ? 'error' : needsCurve ? 'warning' : 'success',
      },
      {
        label: 'Resultado visible',
        text: displayCategory === calculationCategory
          ? describeStandardConversion(units, config.calculation_unit_id, config.display_unit_id)
          : 'La unidad visible debe pertenecer a la misma categoria que calculo.',
        tone: displayCategory === calculationCategory ? 'success' : 'error',
      },
      {
        label: 'Inventario',
        text: needsFactor
          ? factorLabel
            ? `Usa factor: ${factorLabel}`
            : `Factor por material requerido para convertir ${getUnitLabel(units, config.calculation_unit_id)} a ${getUnitLabel(units, config.inventory_unit_id)}.`
          : describeStandardConversion(units, config.calculation_unit_id, config.inventory_unit_id),
        tone: needsFactor && !factorLabel ? 'error' : needsFactor ? 'warning' : 'success',
      },
    ];

    return (
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`rounded border px-3 py-2 ${
              row.tone === 'error'
                ? 'border-red-300 bg-red-50 text-red-800'
                : row.tone === 'warning'
                  ? 'border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#7a4a05]'
                  : row.tone === 'success'
                    ? 'border-[#2ecc71]/30 bg-[#2ecc71]/10 text-[#17693a]'
                    : 'border-[#D8DADF] bg-[#F8F9FA] text-[#3B3A36]'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide">{row.label}</p>
            <p className="mt-1 text-sm">{row.text}</p>
          </div>
        ))}
      </div>
    );
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

  const selectedUnitBase = getBaseUnitForCategory(categories, units, unitForm.category_id);
  const unitFormulaPreview = `1 ${unitForm.symbol || unitForm.code || '[unidad]'} x ${unitForm.factor_to_base || '[factor]'} = ${selectedUnitBase?.symbol || '[base]'}`;

  const selectedFactorFromUnit = getUnit(units, factorForm.from_unit_id);
  const selectedFactorToUnit = getUnit(units, factorForm.to_unit_id);
  const selectedFactorMaterial = materials.find((material) => material.id === factorForm.material_id);
  const factorFormulaPreview = `1 ${selectedFactorFromUnit?.symbol || factorForm.from_unit_id || '[origen]'}${selectedFactorMaterial ? ` de ${selectedFactorMaterial.nombre}` : ''} x ${factorForm.factor || '[factor]'} = ${selectedFactorToUnit?.symbol || factorForm.to_unit_id || '[destino]'}`;

  const resetUnitForm = () => {
    setEditingUnitId(null);
    setUnitForm(EMPTY_UNIT_FORM);
  };

  const resetFactorForm = () => {
    setEditingFactorId(null);
    setFactorForm(EMPTY_FACTOR_FORM);
  };

  const editUnit = (unit: UnitDefinition) => {
    setEditingUnitId(unit.id);
    setUnitForm({
      id: unit.id,
      category_id: unit.category_id,
      code: unit.code,
      name_es: unit.name_es,
      name_en: unit.name_en,
      symbol: unit.symbol,
      measurement_system: unit.measurement_system,
      factor_to_base: String(unit.factor_to_base),
      decimal_precision: String(unit.decimal_precision),
      sort_order: String(unit.sort_order),
    });
  };

  const saveUnit = async () => {
    if (!canEdit) return;
    const payload = {
      id: unitForm.id.trim() || unitForm.code.trim(),
      category_id: unitForm.category_id,
      code: unitForm.code.trim(),
      name_es: unitForm.name_es.trim(),
      name_en: unitForm.name_en.trim(),
      symbol: unitForm.symbol.trim(),
      measurement_system: unitForm.measurement_system,
      factor_to_base: Number(unitForm.factor_to_base),
      decimal_precision: Number(unitForm.decimal_precision),
      sort_order: Number(unitForm.sort_order),
      active: true,
    };

    setLoading(true);
    setMessage(null);
    const response = editingUnitId
      ? await updateUnit(editingUnitId, payload)
      : await createUnit(payload);
    setLoading(false);

    if (!response.success) {
      setMessage({ type: 'error', text: response.error || 'No se pudo guardar la unidad.' });
      return;
    }

    await loadCatalogs();
    resetUnitForm();
    setMessage({ type: 'success', text: 'Unidad guardada.' });
  };

  const deactivateUnit = async (unit: UnitDefinition) => {
    if (!canEdit) return;
    const confirmed = window.confirm(`¿Desactivar la unidad "${unit.name_es}"?`);
    if (!confirmed) return;
    const response = await deleteUnit(unit.id);
    if (!response.success) {
      setMessage({ type: 'error', text: response.error || 'No se pudo desactivar la unidad.' });
      return;
    }
    await loadCatalogs();
    setMessage({ type: 'success', text: 'Unidad desactivada.' });
  };

  const editFactor = (factor: MaterialConversionFactor) => {
    setEditingFactorId(factor.id);
    setFactorForm({
      id: factor.id,
      material_id: factor.material_id || '',
      plant_id: factor.plant_id || '',
      from_unit_id: factor.from_unit_id,
      to_unit_id: factor.to_unit_id,
      factor: String(factor.factor),
      factor_source: factor.factor_source || '',
      effective_from: factor.effective_from || '',
      effective_to: factor.effective_to || '',
    });
  };

  const saveFactor = async () => {
    if (!canEdit) return;
    const payload = {
      material_id: factorForm.material_id || null,
      plant_id: factorForm.plant_id || null,
      from_unit_id: factorForm.from_unit_id,
      to_unit_id: factorForm.to_unit_id,
      factor: Number(factorForm.factor),
      factor_source: factorForm.factor_source.trim() || null,
      effective_from: factorForm.effective_from || null,
      effective_to: factorForm.effective_to || null,
      active: true,
    };

    setLoading(true);
    setMessage(null);
    const response = editingFactorId
      ? await updateMaterialConversionFactor(editingFactorId, payload)
      : await createMaterialConversionFactor(payload);
    setLoading(false);

    if (!response.success) {
      setMessage({ type: 'error', text: response.error || 'No se pudo guardar el factor.' });
      return;
    }

    await loadFactors();
    resetFactorForm();
    setMessage({ type: 'success', text: 'Factor guardado.' });
  };

  const deactivateFactor = async (factor: MaterialConversionFactor) => {
    if (!canEdit) return;
    const confirmed = window.confirm(`¿Desactivar el factor ${factor.from_unit_id} -> ${factor.to_unit_id}?`);
    if (!confirmed) return;
    const response = await deleteMaterialConversionFactor(factor.id);
    if (!response.success) {
      setMessage({ type: 'error', text: response.error || 'No se pudo desactivar el factor.' });
      return;
    }
    await loadFactors();
    setMessage({ type: 'success', text: 'Factor desactivado.' });
  };

  const handleExportExcel = async () => {
    const selectedPlant = allPlants.find((plant) => plant.id === selectedPlantId);

    setExportingExcel(true);
    setMessage(null);
    try {
      await exportSettingsWorkbook(
        `Unidades por Contexto${selectedPlant ? ` - ${selectedPlant.name}` : ''}`,
        [
          {
            name: 'Configuraciones',
            headers: [
              'Planta',
              'Seccion',
              'Captura',
              'Calculo',
              'Visible',
              'Inventario',
              'Regla',
              'Curva',
              'Factor por material',
              'Activo',
              'Orden',
            ],
            rows: configs.map((config) => ({
              config,
              ruleState: getRuleState(config),
              sectionLabel: SECTION_OPTIONS.find((section) => section.value === config.section_code)?.label || config.section_code || '-',
            })).map(({ config, ruleState, sectionLabel }) => [
              selectedPlant?.name || selectedPlantId,
              sectionLabel,
              getUnitLabel(units, config.capture_unit_id),
              getUnitLabel(units, config.calculation_unit_id),
              getUnitLabel(units, config.display_unit_id),
              getUnitLabel(units, config.inventory_unit_id),
              ruleState.label,
              getCurveLabel(curves, config.calibration_curve_id) || '-',
              getFactorLabel(factors, config.material_conversion_factor_id) || '-',
              config.active,
              config.sort_order,
            ]),
          },
          {
            name: 'Catalogo unidades',
            headers: ['Codigo', 'Nombre ES', 'Nombre EN', 'Simbolo', 'Categoria', 'Sistema', 'Unidad base', 'Factor contra base', 'Precision', 'Activo', 'Orden'],
            rows: units.map((unit) => {
              const baseUnit = getBaseUnitForCategory(categories, units, unit.category_id);
              return [
                unit.code,
                unit.name_es,
                unit.name_en,
                unit.symbol,
                getCategoryLabel(categories, unit.category_id),
                unit.measurement_system,
                baseUnit?.symbol || '-',
                Number(unit.factor_to_base),
                unit.decimal_precision,
                unit.active,
                unit.sort_order,
              ];
            }),
          },
          {
            name: 'Factores conversion',
            headers: ['Origen', 'Destino', 'Material', 'Planta', 'Factor', 'Fuente', 'Vigente desde', 'Vigente hasta', 'Activo'],
            rows: factors.map((factor: any) => [
              getUnitLabel(units, factor.from_unit_id),
              getUnitLabel(units, factor.to_unit_id),
              factor.material?.nombre || materials.find((material) => material.id === factor.material_id)?.nombre || 'Cualquiera',
              allPlants.find((plant) => plant.id === factor.plant_id)?.name || 'Todas',
              Number(factor.factor),
              factor.factor_source || '-',
              factor.effective_from || '-',
              factor.effective_to || '-',
              factor.active,
            ]),
          },
        ],
        'PROMIX-Unidades'
      );
      setMessage({ type: 'success', text: 'Unidades exportadas exitosamente a Excel.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo exportar unidades a Excel.' });
    } finally {
      setExportingExcel(false);
    }
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedPlantId}
            onChange={(event) => setSelectedPlantId(event.target.value)}
            className="rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm"
          >
            {allPlants.map((plant) => (
              <option key={plant.id} value={plant.id}>{plant.name}</option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            loading={exportingExcel}
            disabled={loading}
          >
            {exportingExcel ? 'Exportando...' : 'Exportar Excel'}
          </Button>
        </div>
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

      <div className="flex gap-2 border-b border-[#D8DADF]">
        {[
          { id: 'sections' as const, label: 'Por seccion' },
          { id: 'catalog' as const, label: 'Catalogo y conversiones' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubtab(tab.id)}
            className={`px-4 py-2 text-sm font-medium ${
              activeSubtab === tab.id
                ? 'border-b-2 border-[#2475C7] text-[#2475C7]'
                : 'text-[#5F6773] hover:text-[#2475C7]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubtab === 'sections' ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['Captura', 'Lo que mide el operador en campo.'],
              ['Calculo', 'Unidad usada por formulas internas.'],
              ['Visible', 'Resultado que ve el usuario.'],
              ['Inventario', 'Unidad final para control contable.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded border border-[#D8DADF] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#3B3A36]">{title}</p>
                <p className="mt-1 text-xs text-[#5F6773]">{body}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {configs.map((config, index) => {
              const calculationCategory = getUnitCategory(units, config.calculation_unit_id);
              const needsCurve =
                getUnitCategory(units, config.capture_unit_id) !== calculationCategory &&
                sectionRequiresCalibration(config.section_code);
              const needsFactor = getUnitCategory(units, config.inventory_unit_id) !== calculationCategory;
              const ruleState = getRuleState(config);
              const sectionLabel = SECTION_OPTIONS.find((section) => section.value === config.section_code)?.label || 'Nueva configuracion';

              return (
                <Card key={config.id || index} className="p-5">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-semibold text-[#3B3A36]">{sectionLabel}</h4>
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${
                          ruleState.tone === 'error'
                            ? 'bg-red-100 text-red-700'
                            : ruleState.tone === 'warning'
                              ? 'bg-[#f59e0b]/15 text-[#7a4a05]'
                              : 'bg-[#2ecc71]/15 text-[#17693a]'
                        }`}>
                          {ruleState.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#5F6773]">
                        {getUnit(units, config.capture_unit_id)?.symbol || config.capture_unit_id}
                        {' -> '}
                        {getUnit(units, config.calculation_unit_id)?.symbol || config.calculation_unit_id}
                        {' -> '}
                        {getUnit(units, config.display_unit_id)?.symbol || config.display_unit_id}
                        {' -> '}
                        {getUnit(units, config.inventory_unit_id)?.symbol || config.inventory_unit_id}
                      </p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => removeConfig(index)} disabled={!canEdit}>
                      Quitar
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-5">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Seccion</label>
                      <select
                        value={config.section_code || ''}
                        onChange={(event) => updateConfig(index, { section_code: event.target.value })}
                        disabled={!canEdit}
                        className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm"
                      >
                        {SECTION_OPTIONS.map((section) => (
                          <option key={section.value} value={section.value}>{section.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Captura</label>
                      <UnitSelect units={units} value={config.capture_unit_id} onChange={(value) => updateConfig(index, { capture_unit_id: value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Calculo</label>
                      <UnitSelect units={units} value={config.calculation_unit_id} onChange={(value) => updateConfig(index, { calculation_unit_id: value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Visible</label>
                      <UnitSelect units={units} value={config.display_unit_id} onChange={(value) => updateConfig(index, { display_unit_id: value })} categoryId={calculationCategory} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Inventario</label>
                      <UnitSelect units={units} value={config.inventory_unit_id} onChange={(value) => updateConfig(index, { inventory_unit_id: value })} />
                    </div>
                  </div>

                  {(needsCurve || needsFactor) && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {needsCurve && (
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Curva de calibracion</label>
                          <select
                            value={config.calibration_curve_id || ''}
                            onChange={(event) => updateConfig(index, { calibration_curve_id: event.target.value || null })}
                            className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm"
                          >
                            <option value="">Selecciona curva requerida</option>
                            {curves.map((curve: any) => (
                              <option key={curve.id} value={curve.id}>{curve.curve_name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {needsFactor && (
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Factor por material</label>
                          <select
                            value={config.material_conversion_factor_id || ''}
                            onChange={(event) => updateConfig(index, { material_conversion_factor_id: event.target.value || null })}
                            className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm"
                          >
                            <option value="">Selecciona factor requerido</option>
                            {factors.map((factor) => (
                              <option key={factor.id} value={factor.id}>{`${factor.from_unit_id} -> ${factor.to_unit_id}`}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4">
                    {renderExplanation(config)}
                  </div>
                </Card>
              );
            })}

            {configs.length === 0 && (
              <Card className="p-8 text-center text-sm text-[#5F6773]">
                Esta planta no tiene configuraciones especificas. Se usaran defaults globales hasta que agregues una tarjeta.
              </Card>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-[#5F6773]">
              Categorias disponibles: {unitsByCategory.map((category) => `${category.name_es} (${category.units.length})`).join(', ')}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={addConfig} disabled={!canEdit || loading}>Agregar configuracion</Button>
              <Button variant="success" onClick={handleSave} disabled={!canEdit || loading}>
                {loading ? 'Guardando...' : 'Guardar unidades'}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-4">
              <h4 className="text-base font-semibold text-[#3B3A36]">Crear o editar unidad estandar</h4>
              <p className="mt-1 text-sm text-[#5F6773]">
                Las unidades estandar convierten solo dentro de su categoria usando factor contra la unidad base.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Categoria</label>
                <select
                  value={unitForm.category_id}
                  onChange={(event) => setUnitForm((prev) => ({ ...prev, category_id: event.target.value }))}
                  className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name_es}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Codigo</label>
                <input value={unitForm.code} onChange={(event) => setUnitForm((prev) => ({ ...prev, code: event.target.value, id: editingUnitId ? prev.id : event.target.value }))} className="w-full rounded border border-[#9D9B9A] px-3 py-2 text-sm" placeholder="yd" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Nombre ES</label>
                <input value={unitForm.name_es} onChange={(event) => setUnitForm((prev) => ({ ...prev, name_es: event.target.value }))} className="w-full rounded border border-[#9D9B9A] px-3 py-2 text-sm" placeholder="yarda" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Nombre EN</label>
                <input value={unitForm.name_en} onChange={(event) => setUnitForm((prev) => ({ ...prev, name_en: event.target.value }))} className="w-full rounded border border-[#9D9B9A] px-3 py-2 text-sm" placeholder="yard" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Simbolo</label>
                <input value={unitForm.symbol} onChange={(event) => setUnitForm((prev) => ({ ...prev, symbol: event.target.value }))} className="w-full rounded border border-[#9D9B9A] px-3 py-2 text-sm" placeholder="yd" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Sistema</label>
                <select value={unitForm.measurement_system} onChange={(event) => setUnitForm((prev) => ({ ...prev, measurement_system: event.target.value as UnitDefinition['measurement_system'] }))} className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm">
                  {MEASUREMENT_SYSTEM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Factor contra base</label>
                <input type="number" step="any" value={unitForm.factor_to_base} onChange={(event) => setUnitForm((prev) => ({ ...prev, factor_to_base: event.target.value }))} className="w-full rounded border border-[#9D9B9A] px-3 py-2 text-sm" placeholder="0.9144" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Precision</label>
                <input type="number" min="0" max="10" value={unitForm.decimal_precision} onChange={(event) => setUnitForm((prev) => ({ ...prev, decimal_precision: event.target.value }))} className="w-full rounded border border-[#9D9B9A] px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-4 rounded border border-[#2475C7]/25 bg-[#2475C7]/5 px-4 py-3 text-sm text-[#3B3A36]">
              <span className="font-semibold">Formula:</span> {unitFormulaPreview}
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="success" onClick={saveUnit} disabled={!canEdit || loading}>
                {editingUnitId ? 'Actualizar unidad' : 'Crear unidad'}
              </Button>
              {editingUnitId && <Button variant="dangerOutline" onClick={resetUnitForm}>Cancelar edicion</Button>}
            </div>
          </Card>

          <Card noPadding>
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1.4fr_180px] gap-3 bg-[#3B3A36] px-4 py-3 text-sm font-medium text-white">
              <span>Unidad</span>
              <span>Categoria</span>
              <span>Base</span>
              <span>Factor</span>
              <span>Formula</span>
              <span></span>
            </div>
            <div className="divide-y divide-[#F2F3F5]">
              {units.map((unit) => {
                const baseUnit = getBaseUnitForCategory(categories, units, unit.category_id);
                return (
                  <div key={unit.id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1.4fr_180px] items-center gap-3 px-4 py-3 text-sm">
                    <span className="font-medium text-[#3B3A36]">{unit.symbol} - {unit.name_es}</span>
                    <span>{getCategoryLabel(categories, unit.category_id)}</span>
                    <span>{baseUnit?.symbol || '-'}</span>
                    <span>{formatFactor(Number(unit.factor_to_base))}</span>
                    <span>1 {unit.symbol} x {formatFactor(Number(unit.factor_to_base))} = {baseUnit?.symbol || '-'}</span>
                    <span className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => editUnit(unit)}>Editar</Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => deactivateUnit(unit)}>Desactivar</Button>
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4">
              <h4 className="text-base font-semibold text-[#3B3A36]">Factor por material o planta</h4>
              <p className="mt-1 text-sm text-[#5F6773]">
                Usa factores para conversiones de negocio entre categorias, por ejemplo volumen a peso.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Material opcional</label>
                <select value={factorForm.material_id} onChange={(event) => setFactorForm((prev) => ({ ...prev, material_id: event.target.value }))} className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm">
                  <option value="">Cualquier material</option>
                  {materials.map((material) => <option key={material.id} value={material.id}>{material.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Planta opcional</label>
                <select value={factorForm.plant_id} onChange={(event) => setFactorForm((prev) => ({ ...prev, plant_id: event.target.value }))} className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm">
                  <option value="">Todas las plantas</option>
                  {allPlants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Unidad origen</label>
                <UnitSelect units={units} value={factorForm.from_unit_id} onChange={(value) => setFactorForm((prev) => ({ ...prev, from_unit_id: value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Unidad destino</label>
                <UnitSelect units={units} value={factorForm.to_unit_id} onChange={(value) => setFactorForm((prev) => ({ ...prev, to_unit_id: value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Factor</label>
                <input type="number" step="any" value={factorForm.factor} onChange={(event) => setFactorForm((prev) => ({ ...prev, factor: event.target.value }))} className="w-full rounded border border-[#9D9B9A] px-3 py-2 text-sm" placeholder="3200" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Fuente del factor</label>
                <input value={factorForm.factor_source} onChange={(event) => setFactorForm((prev) => ({ ...prev, factor_source: event.target.value }))} className="w-full rounded border border-[#9D9B9A] px-3 py-2 text-sm" placeholder="Ensayo laboratorio, contabilidad, proveedor..." />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5F6773]">Vigente desde</label>
                <input type="date" value={factorForm.effective_from} onChange={(event) => setFactorForm((prev) => ({ ...prev, effective_from: event.target.value }))} className="w-full rounded border border-[#9D9B9A] px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-4 rounded border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-4 py-3 text-sm text-[#3B3A36]">
              <span className="font-semibold">Formula:</span> {factorFormulaPreview}
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="success" onClick={saveFactor} disabled={!canEdit || loading}>
                {editingFactorId ? 'Actualizar factor' : 'Crear factor'}
              </Button>
              {editingFactorId && <Button variant="dangerOutline" onClick={resetFactorForm}>Cancelar edicion</Button>}
            </div>
          </Card>

          <Card noPadding>
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1.5fr_180px] gap-3 bg-[#3B3A36] px-4 py-3 text-sm font-medium text-white">
              <span>Origen</span>
              <span>Destino</span>
              <span>Material</span>
              <span>Planta</span>
              <span>Formula / fuente</span>
              <span></span>
            </div>
            <div className="divide-y divide-[#F2F3F5]">
              {factors.map((factor: any) => (
                <div key={factor.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_1.5fr_180px] items-center gap-3 px-4 py-3 text-sm">
                  <span>{getUnit(units, factor.from_unit_id)?.symbol || factor.from_unit_id}</span>
                  <span>{getUnit(units, factor.to_unit_id)?.symbol || factor.to_unit_id}</span>
                  <span>{factor.material?.nombre || materials.find((material) => material.id === factor.material_id)?.nombre || 'Cualquiera'}</span>
                  <span>{allPlants.find((plant) => plant.id === factor.plant_id)?.name || 'Todas'}</span>
                  <span>
                    1 {getUnit(units, factor.from_unit_id)?.symbol || factor.from_unit_id} x {formatFactor(Number(factor.factor))} = {getUnit(units, factor.to_unit_id)?.symbol || factor.to_unit_id}
                    {factor.factor_source ? ` · ${factor.factor_source}` : ''}
                  </span>
                  <span className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => editFactor(factor)}>Editar</Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => deactivateFactor(factor)}>Desactivar</Button>
                  </span>
                </div>
              ))}
              {factors.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-[#5F6773]">
                  No hay factores por material configurados.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
