/**
 * CatalogsPanel
 * Admin panel to manage standardized catalogs:
 * - Materiales
 * - Procedencias
 * - Aditivos
 * - Curvas de conversion por planta
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuth } from '../../contexts/AuthContext';
import {
  createAdditiveCatalogItem,
  createCalibrationCurveCatalogItem,
  createMaterial,
  createProcedencia,
  deleteAdditiveCatalogItem,
  deleteCalibrationCurveCatalogItem,
  deleteMaterial,
  deleteProcedencia,
  getAdditivesCatalog,
  getCalibrationCurvesCatalog,
  getMateriales,
  getProcedencias,
  updateAdditiveCatalogItem,
  updateCalibrationCurveCatalogItem,
  updateMaterial,
  updateProcedencia,
} from '../../utils/api';

interface CatalogItem {
  id: string;
  nombre: string;
  clase?: string;
  sort_order: number;
}

interface AdditiveCatalogItem {
  id: string;
  nombre: string;
  marca?: string | null;
  uom: string;
  sort_order: number;
}

interface CalibrationCurveItem {
  id: string;
  plant_id: string;
  curve_name: string;
  measurement_type: string;
  reading_uom?: string | null;
  data_points: Record<string, number>;
}

interface CatalogTableProps {
  title: string;
  description: string;
  items: CatalogItem[];
  loading: boolean;
  hasClase?: boolean;
  onAdd: (nombre: string, clase?: string) => Promise<void>;
  onUpdate: (id: string, nombre: string, clase?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function CatalogTable({
  title,
  description,
  items,
  loading,
  hasClase = false,
  onAdd,
  onUpdate,
  onDelete,
}: CatalogTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editClase, setEditClase] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newClase, setNewClase] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditValue(item.nombre);
    setEditClase(item.clase ?? '');
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
    setEditClase('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editValue.trim()) return;
    setSaving(true);
    try {
      await onUpdate(editingId, editValue.trim(), hasClase ? editClase.trim() : undefined);
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    setSaving(true);
    try {
      await onAdd(newValue.trim(), hasClase ? newClase.trim() : undefined);
      setNewValue('');
      setNewClase('');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card noPadding>
      <div className="p-4 border-b border-[#9D9B9A]">
        <h4 className="text-base font-medium text-[#3B3A36]">{title}</h4>
        <p className="text-sm text-[#5F6773] mt-0.5">{description}</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-[#5F6773]">Cargando...</div>
      ) : (
        <>
          <table className="w-full">
            <thead className="bg-[#F2F3F5]">
              <tr>
                <th className="px-4 py-2 text-left text-sm text-[#5F6773] font-medium">Nombre</th>
                {hasClase && (
                  <th className="px-4 py-2 text-left text-sm text-[#5F6773] font-medium">Clase</th>
                )}
                <th className="px-4 py-2 text-center text-sm text-[#5F6773] font-medium w-28">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={hasClase ? 3 : 2} className="px-4 py-6 text-center text-[#5F6773] text-sm">
                    No hay entradas. Agrega la primera abajo.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-[#F2F3F5]">
                    <td className="px-4 py-2">
                      {editingId === item.id ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="w-full px-2 py-1 border border-[#2475C7] rounded text-sm text-[#3B3A36] focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm text-[#3B3A36]">{item.nombre}</span>
                      )}
                    </td>
                    {hasClase && (
                      <td className="px-4 py-2">
                        {editingId === item.id ? (
                          <input
                            type="text"
                            value={editClase}
                            onChange={(e) => setEditClase(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            placeholder="Clase..."
                            className="w-full px-2 py-1 border border-[#2475C7] rounded text-sm text-[#3B3A36] focus:outline-none"
                          />
                        ) : (
                          <span className="text-sm text-[#5F6773]">{item.clase ?? '—'}</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2 text-center">
                      {editingId === item.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={saving || !editValue.trim()}>
                            ✓
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                            ✕
                          </Button>
                        </div>
                      ) : confirmDeleteId === item.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={saving}
                            className="px-2 py-1 text-xs bg-[#C94A4A]/10 text-[#C94A4A] hover:bg-[#C94A4A]/20 rounded transition-colors"
                          >
                            Eliminar
                          </button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(item)}>
                            ✏️
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(item.id)}>
                            🗑️
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="p-3 border-t border-[#9D9B9A] bg-[#F2F3F5] flex gap-2">
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="Nombre..."
              className="flex-1 px-3 py-1.5 border border-[#9D9B9A] rounded text-sm text-[#3B3A36] bg-white focus:outline-none focus:border-[#2475C7]"
            />
            {hasClase && (
              <input
                type="text"
                value={newClase}
                onChange={(e) => setNewClase(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="Clase..."
                className="w-32 px-3 py-1.5 border border-[#9D9B9A] rounded text-sm text-[#3B3A36] bg-white focus:outline-none focus:border-[#2475C7]"
              />
            )}
            <Button variant="secondary" size="sm" onClick={handleAdd} disabled={saving || !newValue.trim()}>
              + Agregar
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function AdditiveCatalogTable({
  items,
  loading,
  onAdd,
  onUpdate,
  onDelete,
}: {
  items: AdditiveCatalogItem[];
  loading: boolean;
  onAdd: (nombre: string, marca: string, uom: string) => Promise<void>;
  onUpdate: (id: string, nombre: string, marca: string, uom: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editUom, setEditUom] = useState('');
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newUom, setNewUom] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (item: AdditiveCatalogItem) => {
    setEditingId(item.id);
    setEditName(item.nombre);
    setEditBrand(item.marca ?? '');
    setEditUom(item.uom);
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditBrand('');
    setEditUom('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editUom.trim()) return;
    setSaving(true);
    try {
      await onUpdate(editingId, editName.trim(), editBrand.trim(), editUom.trim());
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newUom.trim()) return;
    setSaving(true);
    try {
      await onAdd(newName.trim(), newBrand.trim(), newUom.trim());
      setNewName('');
      setNewBrand('');
      setNewUom('');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card noPadding>
      <div className="p-4 border-b border-[#9D9B9A]">
        <h4 className="text-base font-medium text-[#3B3A36]">Aditivos</h4>
        <p className="text-sm text-[#5F6773] mt-0.5">
          Catálogo maestro para nombre, marca y unidad. La configuración de aditivos por planta selecciona desde aquí.
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-[#5F6773]">Cargando...</div>
      ) : (
        <>
          <table className="w-full">
            <thead className="bg-[#F2F3F5]">
              <tr>
                <th className="px-4 py-2 text-left text-sm text-[#5F6773] font-medium">Nombre</th>
                <th className="px-4 py-2 text-left text-sm text-[#5F6773] font-medium">Marca</th>
                <th className="px-4 py-2 text-left text-sm text-[#5F6773] font-medium">Unidad</th>
                <th className="px-4 py-2 text-center text-sm text-[#5F6773] font-medium w-28">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[#5F6773] text-sm">
                    No hay aditivos en catálogo todavía.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-[#F2F3F5]">
                    <td className="px-4 py-2">
                      {editingId === item.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 border border-[#2475C7] rounded text-sm text-[#3B3A36] focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm text-[#3B3A36]">{item.nombre}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingId === item.id ? (
                        <input
                          type="text"
                          value={editBrand}
                          onChange={(e) => setEditBrand(e.target.value)}
                          className="w-full px-2 py-1 border border-[#2475C7] rounded text-sm text-[#3B3A36] focus:outline-none"
                        />
                      ) : (
                        <span className="text-sm text-[#5F6773]">{item.marca || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingId === item.id ? (
                        <input
                          type="text"
                          value={editUom}
                          onChange={(e) => setEditUom(e.target.value)}
                          className="w-full px-2 py-1 border border-[#2475C7] rounded text-sm text-[#3B3A36] focus:outline-none"
                        />
                      ) : (
                        <span className="text-sm text-[#3B3A36]">{item.uom}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {editingId === item.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={saving || !editName.trim() || !editUom.trim()}>
                            ✓
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                            ✕
                          </Button>
                        </div>
                      ) : confirmDeleteId === item.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={saving}
                            className="px-2 py-1 text-xs bg-[#C94A4A]/10 text-[#C94A4A] hover:bg-[#C94A4A]/20 rounded transition-colors"
                          >
                            Eliminar
                          </button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(item)}>
                            ✏️
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(item.id)}>
                            🗑️
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="grid grid-cols-1 gap-2 border-t border-[#9D9B9A] bg-[#F2F3F5] p-3 md:grid-cols-[1.4fr_1fr_0.8fr_auto]">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre..."
              className="px-3 py-1.5 border border-[#9D9B9A] rounded text-sm text-[#3B3A36] bg-white focus:outline-none focus:border-[#2475C7]"
            />
            <input
              type="text"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="Marca..."
              className="px-3 py-1.5 border border-[#9D9B9A] rounded text-sm text-[#3B3A36] bg-white focus:outline-none focus:border-[#2475C7]"
            />
            <input
              type="text"
              value={newUom}
              onChange={(e) => setNewUom(e.target.value)}
              placeholder="Unidad..."
              className="px-3 py-1.5 border border-[#9D9B9A] rounded text-sm text-[#3B3A36] bg-white focus:outline-none focus:border-[#2475C7]"
            />
            <Button variant="secondary" size="sm" onClick={handleAdd} disabled={saving || !newName.trim() || !newUom.trim()}>
              + Agregar
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function parseCurveText(raw: string): Record<string, number> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
    throw new Error('La curva debe ser un JSON con puntos de lectura');
  }
  return parsed;
}

function CalibrationCurvesTable({
  plantOptions,
  selectedPlantId,
  onPlantChange,
  items,
  loading,
  onAdd,
  onUpdate,
  onDelete,
}: {
  plantOptions: Array<{ value: string; label: string }>;
  selectedPlantId: string;
  onPlantChange: (plantId: string) => void;
  items: CalibrationCurveItem[];
  loading: boolean;
  onAdd: (payload: {
    plant_id: string;
    curve_name: string;
    measurement_type: string;
    reading_uom: string;
    data_points: Record<string, number>;
  }) => Promise<void>;
  onUpdate: (id: string, payload: {
    curve_name: string;
    measurement_type: string;
    reading_uom: string;
    data_points: Record<string, number>;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCurveName, setEditCurveName] = useState('');
  const [editMeasurementType, setEditMeasurementType] = useState('TANK_LEVEL');
  const [editReadingUom, setEditReadingUom] = useState('');
  const [editDataPoints, setEditDataPoints] = useState('');
  const [newCurveName, setNewCurveName] = useState('');
  const [newMeasurementType, setNewMeasurementType] = useState('TANK_LEVEL');
  const [newReadingUom, setNewReadingUom] = useState('');
  const [newDataPoints, setNewDataPoints] = useState('{\n  "0": 0\n}');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (item: CalibrationCurveItem) => {
    setEditingId(item.id);
    setEditCurveName(item.curve_name);
    setEditMeasurementType(item.measurement_type);
    setEditReadingUom(item.reading_uom || '');
    setEditDataPoints(JSON.stringify(item.data_points || {}, null, 2));
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCurveName('');
    setEditMeasurementType('TANK_LEVEL');
    setEditReadingUom('');
    setEditDataPoints('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editCurveName.trim()) return;
    setSaving(true);
    try {
      await onUpdate(editingId, {
        curve_name: editCurveName.trim(),
        measurement_type: editMeasurementType.trim(),
        reading_uom: editReadingUom.trim(),
        data_points: parseCurveText(editDataPoints),
      });
      cancelEdit();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error validando la curva');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedPlantId || !newCurveName.trim()) return;
    setSaving(true);
    try {
      await onAdd({
        plant_id: selectedPlantId,
        curve_name: newCurveName.trim(),
        measurement_type: newMeasurementType.trim(),
        reading_uom: newReadingUom.trim(),
        data_points: parseCurveText(newDataPoints),
      });
      setNewCurveName('');
      setNewMeasurementType('TANK_LEVEL');
      setNewReadingUom('');
      setNewDataPoints('{\n  "0": 0\n}');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error validando la curva');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card noPadding>
      <div className="p-4 border-b border-[#9D9B9A] space-y-3">
        <div>
          <h4 className="text-base font-medium text-[#3B3A36]">Curvas de conversión</h4>
          <p className="text-sm text-[#5F6773] mt-0.5">
            Catálogo por planta para reutilizar tablas de conversión. La configuración de aditivos toma estos valores para tanques.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <label className="text-sm text-[#5F6773] min-w-[120px]">Planta</label>
          <select
            value={selectedPlantId}
            onChange={(e) => onPlantChange(e.target.value)}
            className="w-full md:max-w-sm px-3 py-2 border border-[#9D9B9A] rounded text-sm text-[#3B3A36] bg-white focus:outline-none focus:border-[#2475C7]"
          >
            <option value="">Selecciona una planta</option>
            {plantOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedPlantId ? (
        <div className="p-8 text-center text-[#5F6773]">Selecciona una planta para ver sus curvas.</div>
      ) : loading ? (
        <div className="p-8 text-center text-[#5F6773]">Cargando curvas...</div>
      ) : (
        <>
          <table className="w-full">
            <thead className="bg-[#F2F3F5]">
              <tr>
                <th className="px-4 py-2 text-left text-sm text-[#5F6773] font-medium">Nombre</th>
                <th className="px-4 py-2 text-left text-sm text-[#5F6773] font-medium">Método</th>
                <th className="px-4 py-2 text-left text-sm text-[#5F6773] font-medium">Unidad lectura</th>
                <th className="px-4 py-2 text-left text-sm text-[#5F6773] font-medium">Puntos</th>
                <th className="px-4 py-2 text-center text-sm text-[#5F6773] font-medium w-28">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[#5F6773] text-sm">
                    No hay curvas configuradas para esta planta.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-[#F2F3F5] align-top">
                    <td className="px-4 py-2">
                      {editingId === item.id ? (
                        <input
                          type="text"
                          value={editCurveName}
                          onChange={(e) => setEditCurveName(e.target.value)}
                          className="w-full px-2 py-1 border border-[#2475C7] rounded text-sm text-[#3B3A36] focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm text-[#3B3A36]">{item.curve_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingId === item.id ? (
                        <input
                          type="text"
                          value={editMeasurementType}
                          onChange={(e) => setEditMeasurementType(e.target.value)}
                          className="w-full px-2 py-1 border border-[#2475C7] rounded text-sm text-[#3B3A36] focus:outline-none"
                        />
                      ) : (
                        <span className="text-sm text-[#5F6773]">{item.measurement_type}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingId === item.id ? (
                        <input
                          type="text"
                          value={editReadingUom}
                          onChange={(e) => setEditReadingUom(e.target.value)}
                          className="w-full px-2 py-1 border border-[#2475C7] rounded text-sm text-[#3B3A36] focus:outline-none"
                        />
                      ) : (
                        <span className="text-sm text-[#5F6773]">{item.reading_uom || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingId === item.id ? (
                        <textarea
                          value={editDataPoints}
                          onChange={(e) => setEditDataPoints(e.target.value)}
                          rows={6}
                          className="w-full rounded border border-[#2475C7] bg-white px-2 py-1 font-mono text-xs text-[#3B3A36] focus:outline-none"
                        />
                      ) : (
                        <div className="max-w-[260px] rounded bg-[#F2F3F5] px-2 py-1 font-mono text-xs text-[#5F6773] whitespace-pre-wrap break-all">
                          {JSON.stringify(item.data_points || {})}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {editingId === item.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={saving || !editCurveName.trim()}>
                            ✓
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                            ✕
                          </Button>
                        </div>
                      ) : confirmDeleteId === item.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={saving}
                            className="px-2 py-1 text-xs bg-[#C94A4A]/10 text-[#C94A4A] hover:bg-[#C94A4A]/20 rounded transition-colors"
                          >
                            Eliminar
                          </button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(item)}>
                            ✏️
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(item.id)}>
                            🗑️
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="border-t border-[#9D9B9A] bg-[#F2F3F5] p-3 space-y-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input
                type="text"
                value={newCurveName}
                onChange={(e) => setNewCurveName(e.target.value)}
                placeholder="Nombre de curva..."
                className="px-3 py-1.5 border border-[#9D9B9A] rounded text-sm text-[#3B3A36] bg-white focus:outline-none focus:border-[#2475C7]"
              />
              <input
                type="text"
                value={newMeasurementType}
                onChange={(e) => setNewMeasurementType(e.target.value)}
                placeholder="Método..."
                className="px-3 py-1.5 border border-[#9D9B9A] rounded text-sm text-[#3B3A36] bg-white focus:outline-none focus:border-[#2475C7]"
              />
              <input
                type="text"
                value={newReadingUom}
                onChange={(e) => setNewReadingUom(e.target.value)}
                placeholder="Unidad de lectura..."
                className="px-3 py-1.5 border border-[#9D9B9A] rounded text-sm text-[#3B3A36] bg-white focus:outline-none focus:border-[#2475C7]"
              />
            </div>
            <textarea
              value={newDataPoints}
              onChange={(e) => setNewDataPoints(e.target.value)}
              rows={6}
              className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2 font-mono text-xs text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
              placeholder='{"0": 0, "6": 250, "12": 520}'
            />
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={handleAdd} disabled={saving || !selectedPlantId || !newCurveName.trim()}>
                + Agregar Curva
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

export function CatalogsPanel() {
  const { allPlants } = useAuth();
  const [materiales, setMateriales] = useState<CatalogItem[]>([]);
  const [procedencias, setProcedencias] = useState<CatalogItem[]>([]);
  const [aditivos, setAditivos] = useState<AdditiveCatalogItem[]>([]);
  const [curvas, setCurvas] = useState<CalibrationCurveItem[]>([]);
  const [selectedCurvePlantId, setSelectedCurvePlantId] = useState('');
  const [loadingMat, setLoadingMat] = useState(true);
  const [loadingProc, setLoadingProc] = useState(true);
  const [loadingAditivos, setLoadingAditivos] = useState(true);
  const [loadingCurvas, setLoadingCurvas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plantOptions = useMemo(
    () => allPlants.map((plant) => ({ value: plant.id, label: plant.name })),
    [allPlants]
  );

  useEffect(() => {
    if (!selectedCurvePlantId && plantOptions.length > 0) {
      setSelectedCurvePlantId(plantOptions[0].value);
    }
  }, [plantOptions, selectedCurvePlantId]);

  const loadMateriales = async () => {
    setLoadingMat(true);
    const res = await getMateriales();
    if (res.success) setMateriales(res.data || []);
    else setError('Error cargando materiales: ' + res.error);
    setLoadingMat(false);
  };

  const loadProcedencias = async () => {
    setLoadingProc(true);
    const res = await getProcedencias();
    if (res.success) setProcedencias(res.data || []);
    else setError('Error cargando procedencias: ' + res.error);
    setLoadingProc(false);
  };

  const loadAdditives = async () => {
    setLoadingAditivos(true);
    const res = await getAdditivesCatalog();
    if (res.success) setAditivos(res.data || []);
    else setError('Error cargando aditivos: ' + res.error);
    setLoadingAditivos(false);
  };

  const loadCurves = async (plantId: string) => {
    if (!plantId) {
      setCurvas([]);
      return;
    }

    setLoadingCurvas(true);
    const res = await getCalibrationCurvesCatalog(plantId);
    if (res.success) setCurvas(res.data || []);
    else setError('Error cargando curvas: ' + res.error);
    setLoadingCurvas(false);
  };

  useEffect(() => {
    loadMateriales();
    loadProcedencias();
    loadAdditives();
  }, []);

  useEffect(() => {
    if (selectedCurvePlantId) {
      loadCurves(selectedCurvePlantId);
    }
  }, [selectedCurvePlantId]);

  const handleAddMaterial = async (nombre: string, clase?: string) => {
    const res = await createMaterial(nombre, clase);
    if (res.success) await loadMateriales();
    else alert('Error: ' + res.error);
  };

  const handleUpdateMaterial = async (id: string, nombre: string, clase?: string) => {
    const res = await updateMaterial(id, { nombre, clase });
    if (res.success) await loadMateriales();
    else alert('Error: ' + res.error);
  };

  const handleDeleteMaterial = async (id: string) => {
    const res = await deleteMaterial(id);
    if (res.success) await loadMateriales();
    else alert('Error: ' + res.error);
  };

  const handleAddProcedencia = async (nombre: string) => {
    const res = await createProcedencia(nombre);
    if (res.success) await loadProcedencias();
    else alert('Error: ' + res.error);
  };

  const handleUpdateProcedencia = async (id: string, nombre: string) => {
    const res = await updateProcedencia(id, { nombre });
    if (res.success) await loadProcedencias();
    else alert('Error: ' + res.error);
  };

  const handleDeleteProcedencia = async (id: string) => {
    const res = await deleteProcedencia(id);
    if (res.success) await loadProcedencias();
    else alert('Error: ' + res.error);
  };

  const handleAddAditivo = async (nombre: string, marca: string, uom: string) => {
    const res = await createAdditiveCatalogItem(nombre, marca, uom);
    if (res.success) await loadAdditives();
    else alert('Error: ' + res.error);
  };

  const handleUpdateAditivo = async (id: string, nombre: string, marca: string, uom: string) => {
    const res = await updateAdditiveCatalogItem(id, { nombre, marca, uom });
    if (res.success) await loadAdditives();
    else alert('Error: ' + res.error);
  };

  const handleDeleteAditivo = async (id: string) => {
    const res = await deleteAdditiveCatalogItem(id);
    if (res.success) await loadAdditives();
    else alert('Error: ' + res.error);
  };

  const handleAddCurve = async (payload: {
    plant_id: string;
    curve_name: string;
    measurement_type: string;
    reading_uom: string;
    data_points: Record<string, number>;
  }) => {
    const res = await createCalibrationCurveCatalogItem(payload);
    if (res.success) await loadCurves(payload.plant_id);
    else alert('Error: ' + res.error);
  };

  const handleUpdateCurve = async (
    id: string,
    payload: {
      curve_name: string;
      measurement_type: string;
      reading_uom: string;
      data_points: Record<string, number>;
    }
  ) => {
    const res = await updateCalibrationCurveCatalogItem(id, payload);
    if (res.success && selectedCurvePlantId) await loadCurves(selectedCurvePlantId);
    else if (!res.success) alert('Error: ' + res.error);
  };

  const handleDeleteCurve = async (id: string) => {
    const res = await deleteCalibrationCurveCatalogItem(id);
    if (res.success && selectedCurvePlantId) await loadCurves(selectedCurvePlantId);
    else if (!res.success) alert('Error: ' + res.error);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg text-[#3B3A36]">Catálogos</h3>
        <p className="text-[#5F6773] text-sm mt-1">
          Administra los valores estandarizados que usan las configuraciones por planta. Aquí ya puedes controlar materiales,
          procedencias, aditivos y curvas de conversión.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-[#C94A4A]/10 border border-[#C94A4A]/30 rounded text-sm text-[#C94A4A]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CatalogTable
          title="Materiales"
          description="Tipos de material que pueden asignarse a un cajón."
          items={materiales}
          loading={loadingMat}
          hasClase={true}
          onAdd={handleAddMaterial}
          onUpdate={handleUpdateMaterial}
          onDelete={handleDeleteMaterial}
        />

        <CatalogTable
          title="Procedencias"
          description="Nombre del suplidor o procedencia del material."
          items={procedencias}
          loading={loadingProc}
          onAdd={handleAddProcedencia}
          onUpdate={handleUpdateProcedencia}
          onDelete={handleDeleteProcedencia}
        />

        <AdditiveCatalogTable
          items={aditivos}
          loading={loadingAditivos}
          onAdd={handleAddAditivo}
          onUpdate={handleUpdateAditivo}
          onDelete={handleDeleteAditivo}
        />

        <CalibrationCurvesTable
          plantOptions={plantOptions}
          selectedPlantId={selectedCurvePlantId}
          onPlantChange={setSelectedCurvePlantId}
          items={curvas}
          loading={loadingCurvas}
          onAdd={handleAddCurve}
          onUpdate={handleUpdateCurve}
          onDelete={handleDeleteCurve}
        />
      </div>
    </div>
  );
}
