import React, { useEffect, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { DeleteIconButton } from './DeleteIconButton';
import { Input } from './Input';
import { Select } from './Select';
import {
  getAdditivesCatalog,
  getCalibrationCurvesCatalog,
  getPlantAdditivesConfigEntries,
  getUnits,
  updatePlantAdditivesConfigEntries,
} from '../utils/api';
import type { Plant } from '../contexts/AuthContext';

type AdditiveType = 'TANK' | 'MANUAL';
type MeasurementMethod = 'MANUAL' | 'CURVE' | 'CYLINDER_VERTICAL' | 'RECTANGULAR_IBC';

interface UnitItem {
  id: string;
  category_id: string;
  name_es: string;
  symbol: string;
}

interface AdditiveCatalogItem {
  id: string;
  nombre: string;
  marca?: string | null;
  uom: string;
}

interface CalibrationCurveItem {
  id: string;
  curve_name: string;
  measurement_type: string;
  reading_uom?: string | null;
  points?: Array<{
    point_key: number;
    point_value: number;
    available_gallons?: number | null;
    consumed_gallons?: number | null;
    percentage?: number | null;
    status?: string | null;
  }>;
  data_points: Record<string, number>;
}

interface AdditiveConfigRow {
  id?: string;
  catalog_additive_id?: string | null;
  additive_name: string;
  additive_type: AdditiveType;
  measurement_method: MeasurementMethod;
  calibration_curve_name?: string | null;
  brand: string;
  uom: string;
  requires_photo: boolean;
  tank_name?: string | null;
  reading_uom?: string | null;
  conversion_table: Record<string, number>;
  diameter?: number | null;
  length?: number | null;
  width?: number | null;
  total_height?: number | null;
  capacity?: number | null;
  dimension_unit_id?: string | null;
  capacity_unit_id?: string | null;
  is_active: boolean;
}

function createEmptyRow(): AdditiveConfigRow {
  return {
    catalog_additive_id: null,
    additive_name: '',
    additive_type: 'TANK',
    measurement_method: 'CURVE',
    calibration_curve_name: null,
    brand: '',
    uom: '',
    requires_photo: true,
    tank_name: null,
    reading_uom: 'inches',
    conversion_table: {},
    diameter: null,
    length: null,
    width: null,
    total_height: null,
    capacity: null,
    dimension_unit_id: 'in',
    capacity_unit_id: 'gal_us',
    is_active: true,
  };
}

function buildAdditiveLabel(item: AdditiveCatalogItem) {
  return item.marca?.trim() ? `${item.nombre} — ${item.marca}` : item.nombre;
}

function isTankLevelCurve(curve: CalibrationCurveItem) {
  return String(curve.measurement_type || '').trim().toUpperCase() === 'TANK_LEVEL';
}

function getCurvePreviewPoints(curve: CalibrationCurveItem | null | undefined) {
  if (!curve) return [];
  if (curve.points?.length) {
    return [...curve.points].sort((left, right) => left.point_key - right.point_key);
  }
  return Object.entries(curve.data_points || {})
    .map(([point_key, point_value]) => ({
      point_key: Number(point_key),
      point_value: Number(point_value),
      available_gallons: Number(point_value),
      consumed_gallons: null,
      percentage: null,
      status: null,
    }))
    .filter((point) => Number.isFinite(point.point_key) && Number.isFinite(point.point_value))
    .sort((left, right) => left.point_key - right.point_key);
}

function CurvePreviewTable({ curve }: { curve: CalibrationCurveItem | null | undefined }) {
  const points = getCurvePreviewPoints(curve);
  if (!curve) {
    return (
      <div className="rounded border border-[#D7D9DE] bg-white px-3 py-4 text-sm text-[#5F6773]">
        Selecciona una curva para ver sus puntos.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-[#D7D9DE] bg-white">
      <div className="flex items-center justify-between border-b border-[#E4E4E4] px-3 py-2">
        <span className="text-sm font-medium text-[#3B3A36]">Tabla de conversión</span>
        <span className="rounded-full bg-[#EEF4FB] px-2 py-1 text-xs font-medium text-[#2475C7]">
          {points.length} punto{points.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="max-h-64 overflow-auto">
        <table className="w-full min-w-[680px]">
          <thead className="bg-[#F2F3F5]">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#5F6773]">Nivel</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#5F6773]">Galones disponibles</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#5F6773]">Galones consumidos</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#5F6773]">%</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#5F6773]">Status</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={`${point.point_key}-${point.point_value}`} className="border-t border-[#F2F3F5]">
                <td className="px-3 py-2 text-sm text-[#3B3A36]">{point.point_key}</td>
                <td className="px-3 py-2 text-sm text-[#3B3A36]">{point.available_gallons ?? point.point_value}</td>
                <td className="px-3 py-2 text-sm text-[#5F6773]">{point.consumed_gallons ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-[#5F6773]">{point.percentage ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-[#5F6773]">{point.status || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[#E4E4E4] px-3 py-2 text-xs text-[#5F6773]">
        Para modificar estos puntos, actualiza la curva en Catálogos.
      </p>
    </div>
  );
}

export function AdditivesConfigModal({
  plant,
  onSaved,
  onClose,
}: {
  plant: Plant;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<AdditiveConfigRow[]>([]);
  const [catalogItems, setCatalogItems] = useState<AdditiveCatalogItem[]>([]);
  const [curveItems, setCurveItems] = useState<CalibrationCurveItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    Promise.all([
      getPlantAdditivesConfigEntries(plant.id),
      getAdditivesCatalog(),
      getCalibrationCurvesCatalog(plant.id),
      getUnits(),
    ])
      .then(([configResponse, catalogResponse, curvesResponse, unitsResponse]) => {
        if (!configResponse.success) {
          setError(configResponse.error ?? 'Error cargando aditivos');
          return;
        }

        const catalogData = (catalogResponse.success ? catalogResponse.data : []) || [];
        const curveData = (curvesResponse.success ? curvesResponse.data : []) || [];
        setCatalogItems(catalogData);
        setCurveItems(curveData);
        setUnits((unitsResponse.success ? unitsResponse.data : []) || []);

        const catalogById = new Map(catalogData.map((item: AdditiveCatalogItem) => [item.id, item]));
        const catalogByName = new Map(
          catalogData.map((item: AdditiveCatalogItem) => [item.nombre.trim().toUpperCase(), item])
        );
        const tankCurveData = curveData.filter(isTankLevelCurve);
        const curvesByName = new Map(
          tankCurveData.map((item: CalibrationCurveItem) => [item.curve_name.trim().toUpperCase(), item])
        );

        const loadedRows = (configResponse.data ?? []).map((entry: any) => {
          const matchedCatalog =
            (entry.catalog_additive_id && catalogById.get(entry.catalog_additive_id)) ||
            catalogByName.get(String(entry.additive_name || '').trim().toUpperCase()) ||
            null;
          const matchedCurve = entry.calibration_curve_name
            ? curvesByName.get(String(entry.calibration_curve_name).trim().toUpperCase()) || null
            : null;

          const rawMethod = String(entry.measurement_method || '').toUpperCase();
          const method: MeasurementMethod = ['TANK', 'TANK_LEVEL', 'CALIBRATION_CURVE', 'CURVE'].includes(rawMethod)
            ? 'CURVE'
            : rawMethod === 'CYLINDER_VERTICAL' || rawMethod === 'RECTANGULAR_IBC'
              ? rawMethod
              : 'MANUAL';
          return {
            id: entry.id,
            catalog_additive_id: entry.catalog_additive_id || matchedCatalog?.id || null,
            additive_name: entry.additive_name || matchedCatalog?.nombre || '',
            additive_type: method === 'MANUAL' ? 'MANUAL' : 'TANK',
            measurement_method: method,
            calibration_curve_name: matchedCurve ? entry.calibration_curve_name || null : null,
            brand: entry.brand || matchedCatalog?.marca || '',
            uom: entry.uom || matchedCatalog?.uom || '',
            requires_photo: entry.requires_photo ?? true,
            tank_name: entry.tank_name || '',
            reading_uom: entry.reading_uom || matchedCurve?.reading_uom || null,
            conversion_table: entry.conversion_table || matchedCurve?.data_points || {},
            diameter: entry.diameter ?? null,
            length: entry.length ?? null,
            width: entry.width ?? null,
            total_height: entry.total_height ?? null,
            capacity: entry.capacity ?? null,
            dimension_unit_id: entry.dimension_unit_id || 'in',
            capacity_unit_id: entry.capacity_unit_id || 'gal_us',
            is_active: entry.is_active ?? true,
          } as AdditiveConfigRow;
        });

        setRows(loadedRows);
      })
      .catch(() => setError('Error de conexión cargando aditivos'))
      .finally(() => setLoading(false));
  }, [plant.id]);

  const updateRow = (index: number, updates: Partial<AdditiveConfigRow>) => {
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...updates } : row)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleCatalogAdditiveChange = (index: number, catalogId: string) => {
    const selected = catalogItems.find((item) => item.id === catalogId);
    updateRow(index, {
      catalog_additive_id: selected?.id || null,
      additive_name: selected?.nombre || '',
      additive_type: rows[index].measurement_method === 'MANUAL' ? 'MANUAL' : 'TANK',
      brand: selected?.marca || '',
      uom: selected?.uom || '',
    });
  };

  const handleCurveChange = (index: number, curveName: string) => {
    const selectedCurve = tankCurveItems.find((curve) => curve.curve_name === curveName);

    updateRow(index, {
      calibration_curve_name: curveName || null,
      reading_uom: selectedCurve?.reading_uom || rows[index].reading_uom || 'inches',
      conversion_table: selectedCurve ? selectedCurve.data_points : {},
    });
  };

  const additiveOptions = [
    { value: '', label: '-- Selecciona un aditivo --' },
    ...catalogItems.map((item) => ({
      value: item.id,
      label: buildAdditiveLabel(item),
    })),
  ];

  const tankCurveItems = curveItems.filter(isTankLevelCurve);
  const methodOptions = [
    { value: 'MANUAL', label: 'Manual' },
    { value: 'CURVE', label: 'Curva de calibración' },
    { value: 'CYLINDER_VERTICAL', label: 'Cilindro vertical' },
    { value: 'RECTANGULAR_IBC', label: 'IBC rectangular' },
  ];
  const dimensionUnitOptions = units
    .filter((unit) => unit.category_id === 'length')
    .map((unit) => ({ value: unit.id, label: `${unit.name_es} (${unit.symbol})` }));
  const capacityUnitOptions = units
    .filter((unit) => unit.category_id === 'capacity' || unit.category_id === 'volume')
    .map((unit) => ({ value: unit.id, label: `${unit.name_es} (${unit.symbol})` }));
  const curveOptions = [
    { value: '', label: '-- Selecciona una curva --' },
    ...tankCurveItems.map((curve) => ({
      value: curve.curve_name,
      label: curve.curve_name,
    })),
  ];

  const validateRows = () => {
    for (const [index, row] of rows.entries()) {
      const label = row.additive_name || `Fila ${index + 1}`;

      if (!row.catalog_additive_id) {
        return `El aditivo en la fila ${index + 1} debe seleccionarse desde el catálogo`;
      }
      if (!catalogItems.some((item) => item.id === row.catalog_additive_id)) {
        return `${label}: el aditivo seleccionado ya no existe en el catálogo maestro`;
      }

      if (!row.additive_name.trim()) {
        return `El aditivo en la fila ${index + 1} debe tener nombre`;
      }

      if (!row.uom.trim()) {
        return `${label}: la unidad es requerida`;
      }

      if (row.measurement_method !== 'MANUAL') {
        if (!row.tank_name?.trim()) {
          return `${label}: el nombre del tanque es requerido`;
        }
      }

      if (row.measurement_method === 'CURVE') {
        if (!row.calibration_curve_name?.trim()) {
          return `${label}: debes seleccionar una curva de conversión`;
        }

        if (!tankCurveItems.some((curve) => curve.curve_name === row.calibration_curve_name)) {
          return `${label}: la curva seleccionada ya no existe en esta planta`;
        }

        if (!row.reading_uom?.trim()) {
          return `${label}: la unidad de lectura es requerida`;
        }

        const selectedCurve = tankCurveItems.find((curve) => curve.curve_name === row.calibration_curve_name);
        if (!selectedCurve || Object.keys(selectedCurve.data_points || {}).length === 0) {
          return `${label}: la curva seleccionada no tiene puntos de conversión`;
        }
      }

      if (row.measurement_method === 'CYLINDER_VERTICAL' || row.measurement_method === 'RECTANGULAR_IBC') {
        if (!(Number(row.total_height) > 0)) return `${label}: la altura total debe ser mayor que cero`;
        if (!(Number(row.capacity) > 0)) return `${label}: la capacidad nominal debe ser mayor que cero`;
        if (!row.dimension_unit_id) return `${label}: selecciona la unidad dimensional`;
        if (!row.capacity_unit_id) return `${label}: selecciona la unidad de capacidad`;
      }
      if (row.measurement_method === 'CYLINDER_VERTICAL' && !(Number(row.diameter) > 0)) {
        return `${label}: el diámetro debe ser mayor que cero`;
      }
      if (row.measurement_method === 'RECTANGULAR_IBC') {
        if (!(Number(row.length) > 0)) return `${label}: el largo debe ser mayor que cero`;
        if (!(Number(row.width) > 0)) return `${label}: el ancho debe ser mayor que cero`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateRows();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = rows.map((row, index) => ({
        ...(row.id ? { id: row.id } : {}),
        catalog_additive_id: row.catalog_additive_id || null,
        additive_name: row.additive_name.trim(),
        additive_type: row.measurement_method === 'MANUAL' ? 'MANUAL' : 'TANK',
        measurement_method: row.measurement_method,
        calibration_curve_name: row.measurement_method === 'CURVE' ? row.calibration_curve_name || null : null,
        brand: row.brand.trim(),
        uom: row.uom.trim(),
        requires_photo: row.requires_photo,
        tank_name: row.measurement_method === 'MANUAL' ? null : row.tank_name?.trim() || null,
        reading_uom: row.measurement_method === 'CURVE' ? row.reading_uom?.trim() || null : null,
        conversion_table: row.measurement_method === 'CURVE'
          ? tankCurveItems.find((curve) => curve.curve_name === row.calibration_curve_name)?.data_points || row.conversion_table
          : null,
        diameter: row.measurement_method === 'CYLINDER_VERTICAL' ? row.diameter : null,
        length: row.measurement_method === 'RECTANGULAR_IBC' ? row.length : null,
        width: row.measurement_method === 'RECTANGULAR_IBC' ? row.width : null,
        total_height: ['CYLINDER_VERTICAL', 'RECTANGULAR_IBC'].includes(row.measurement_method) ? row.total_height : null,
        capacity: ['CYLINDER_VERTICAL', 'RECTANGULAR_IBC'].includes(row.measurement_method) ? row.capacity : null,
        dimension_unit_id: ['CYLINDER_VERTICAL', 'RECTANGULAR_IBC'].includes(row.measurement_method) ? row.dimension_unit_id : null,
        capacity_unit_id: ['CYLINDER_VERTICAL', 'RECTANGULAR_IBC'].includes(row.measurement_method) ? row.capacity_unit_id : null,
        sort_order: index,
        is_active: row.is_active,
      }));

      const response = await updatePlantAdditivesConfigEntries(plant.id, payload);
      if (!response.success) {
        setError(response.error ?? 'Error guardando aditivos');
        return;
      }

      onSaved();
    } catch {
      setError('Error de conexión guardando aditivos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white">
        <div className="border-b border-[#9D9B9A] p-6">
          <h3 className="text-xl font-medium text-[#3B3A36]">
            Configuración de Aditivos — {plant.name}
          </h3>
          <p className="mt-1 text-sm text-[#5F6773]">
            Selecciona el método de medición y configura únicamente los parámetros físicos que le corresponden.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} />
            </div>
          )}

          {!loading && catalogItems.length === 0 && (
            <div className="mb-4">
              <Alert type="warning" message="No hay aditivos en catálogo. Crea primero los aditivos en la pestaña Catálogos." />
            </div>
          )}

          {!loading && tankCurveItems.length === 0 && (
            <div className="mb-4">
              <Alert type="warning" message="No hay curvas TANK_LEVEL. El método CURVE no estará disponible hasta crear una en Catálogos." />
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-[#5F6773]">Cargando aditivos...</div>
          ) : (
            <div className="space-y-4">
              {rows.length === 0 ? (
                <div className="rounded-lg bg-[#F2F3F5] py-8 text-center">
                  <p className="mb-2 text-[#5F6773]">No hay aditivos configurados</p>
                  <p className="text-sm text-[#5F6773]">Agrega la primera fila para esta planta</p>
                </div>
              ) : (
                rows.map((row, index) => (
                  <div key={row.id || `new-${index}`} className="rounded-lg border border-[#9D9B9A] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-[#3B3A36]">Aditivo #{index + 1}</h4>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-[#5F6773]">
                          Activo
                          <input
                            type="checkbox"
                            checked={row.is_active}
                            onChange={(e) => updateRow(index, { is_active: e.target.checked })}
                          />
                        </label>
                        <DeleteIconButton onClick={() => removeRow(index)} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <Select
                        label="Aditivo"
                        value={row.catalog_additive_id || ''}
                        onChange={(e) => handleCatalogAdditiveChange(index, e.target.value)}
                        options={additiveOptions}
                        required
                        helperText="Nombre, marca y unidad salen del catálogo."
                      />
                      <Input
                        label="Tipo"
                        value={row.measurement_method === 'MANUAL' ? 'Manual' : 'Tanque'}
                        disabled
                      />
                      <Input
                        label="Marca"
                        value={row.brand}
                        disabled
                        placeholder="Se llena desde catálogo"
                      />
                      <Input
                        label="Unidad"
                        value={row.uom}
                        disabled
                        placeholder="Se llena desde catálogo"
                        required
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <label className="flex items-center gap-2 rounded border border-[#9D9B9A] bg-[#F2F3F5] px-3 py-2 text-sm text-[#3B3A36]">
                        <input
                          type="checkbox"
                          checked={row.requires_photo}
                          onChange={(e) => updateRow(index, { requires_photo: e.target.checked })}
                        />
                        Requiere foto
                      </label>
                      <Select
                        label="Método"
                        value={row.measurement_method}
                        options={methodOptions}
                        onChange={(event) => {
                          const method = event.target.value as MeasurementMethod;
                          updateRow(index, {
                            measurement_method: method,
                            additive_type: method === 'MANUAL' ? 'MANUAL' : 'TANK',
                          });
                        }}
                        required
                      />
                      <Input
                        label="Nombre seleccionado"
                        value={row.additive_name}
                        disabled
                        placeholder="Se llena desde catálogo"
                      />
                    </div>

                    {row.measurement_method !== 'MANUAL' && (
                    <div className="mt-4 space-y-4 rounded-lg border border-[#E4E4E4] bg-[#F9FAFB] p-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <Input
                          label="Nombre del tanque"
                          value={row.tank_name || ''}
                          onChange={(e) => updateRow(index, { tank_name: e.target.value })}
                          placeholder="Ej: Tanque WR200"
                          required
                        />
                        {row.measurement_method === 'CURVE' && <Select
                          label="Curva de conversión"
                          value={row.calibration_curve_name || ''}
                          onChange={(e) => handleCurveChange(index, e.target.value)}
                          options={curveOptions}
                          required
                          helperText="La tabla y la unidad de lectura salen de esta curva."
                        />}
                        {row.measurement_method === 'CURVE' && <Input
                          label="Unidad de lectura"
                          value={row.reading_uom || ''}
                          disabled
                          placeholder="Se llena desde la curva"
                          required
                        />}
                      </div>
                      {row.measurement_method === 'CURVE' && <CurvePreviewTable
                        curve={tankCurveItems.find((curve) => curve.curve_name === row.calibration_curve_name)}
                      />}
                      {(row.measurement_method === 'CYLINDER_VERTICAL' || row.measurement_method === 'RECTANGULAR_IBC') && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {row.measurement_method === 'CYLINDER_VERTICAL' && (
                              <Input label="Diámetro" type="number" min="0" step="any" required
                                value={row.diameter ?? ''}
                                onChange={(event) => updateRow(index, { diameter: event.target.value === '' ? null : Number(event.target.value) })}
                              />
                            )}
                            {row.measurement_method === 'RECTANGULAR_IBC' && (
                              <>
                                <Input label="Largo" type="number" min="0" step="any" required
                                  value={row.length ?? ''}
                                  onChange={(event) => updateRow(index, { length: event.target.value === '' ? null : Number(event.target.value) })}
                                />
                                <Input label="Ancho" type="number" min="0" step="any" required
                                  value={row.width ?? ''}
                                  onChange={(event) => updateRow(index, { width: event.target.value === '' ? null : Number(event.target.value) })}
                                />
                              </>
                            )}
                            <Input label="Altura total" type="number" min="0" step="any" required
                              value={row.total_height ?? ''}
                              onChange={(event) => updateRow(index, { total_height: event.target.value === '' ? null : Number(event.target.value) })}
                            />
                            <Select label="Unidad dimensional" value={row.dimension_unit_id || ''}
                              onChange={(event) => updateRow(index, { dimension_unit_id: event.target.value })}
                              options={dimensionUnitOptions} required
                            />
                            <Input label="Capacidad nominal" type="number" min="0" step="any" required
                              value={row.capacity ?? ''}
                              onChange={(event) => updateRow(index, { capacity: event.target.value === '' ? null : Number(event.target.value) })}
                            />
                            <Select label="Unidad de capacidad" value={row.capacity_unit_id || ''}
                              onChange={(event) => updateRow(index, { capacity_unit_id: event.target.value })}
                              options={capacityUnitOptions} required
                            />
                          </div>
                          <p className="text-xs text-[#5F6773]">
                            La altura del líquido se capturará en la unidad dimensional. El servidor limitará el resultado a la capacidad nominal.
                          </p>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                ))
              )}

              <Button variant="secondary" onClick={addRow} className="w-full">
                + Agregar Aditivo
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#9D9B9A] p-6">
          <Button variant="dangerOutline" onClick={onClose} disabled={saving}>
            Salir
          </Button>
          <Button variant="success" onClick={handleSave} loading={saving} disabled={loading}>
            Guardar Configuración
          </Button>
        </div>
      </div>
    </div>
  );
}
