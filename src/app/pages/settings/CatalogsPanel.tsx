/**
 * CatalogsPanel
 * Admin panel to manage standardized catalogs:
 * - Materiales (materials for cajones) — includes nombre + clase
 * - Procedencias (source/origin of materials) — nombre only
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import {
  getMateriales, createMaterial, updateMaterial, deleteMaterial,
  getProcedencias, createProcedencia, updateProcedencia, deleteProcedencia,
} from '../../utils/api';

interface CatalogItem {
  id: string;
  nombre: string;
  clase?: string;
  sort_order: number;
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
      setEditingId(null);
      setEditValue('');
      setEditClase('');
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
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={saving || !editValue.trim()}
                          >
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(item)}
                          >
                            ✏️
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteId(item.id)}
                          >
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

          {/* Add new row */}
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
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAdd}
              disabled={saving || !newValue.trim()}
            >
              + Agregar
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

// ============================================================================
// MAIN PANEL
// ============================================================================

export function CatalogsPanel() {
  const [materiales, setMateriales] = useState<CatalogItem[]>([]);
  const [procedencias, setProcedencias] = useState<CatalogItem[]>([]);
  const [loadingMat, setLoadingMat] = useState(true);
  const [loadingProc, setLoadingProc] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadMateriales();
    loadProcedencias();
  }, []);

  // ── Materiales handlers ──

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

  // ── Procedencias handlers ──

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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg text-[#3B3A36]">Catálogos</h3>
        <p className="text-[#5F6773] text-sm mt-1">
          Administra los valores estandarizados para Materiales y Procedencias de cajones.
          Estos valores aparecerán como opciones en la configuración de cajones de cada planta.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-[#C94A4A]/10 border border-[#C94A4A]/30 rounded text-sm text-[#C94A4A]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CatalogTable
          title="Materiales"
          description="Tipos de material que pueden asignarse a un cajón (ej. Piedra 3/4, Arena Fina)"
          items={materiales}
          loading={loadingMat}
          hasClase={true}
          onAdd={handleAddMaterial}
          onUpdate={handleUpdateMaterial}
          onDelete={handleDeleteMaterial}
        />

        <CatalogTable
          title="Procedencias"
          description="Origen o proveedor del material (ej. Cantera Norte, Cantera Sur)"
          items={procedencias}
          loading={loadingProc}
          onAdd={handleAddProcedencia}
          onUpdate={handleUpdateProcedencia}
          onDelete={handleDeleteProcedencia}
        />
      </div>
    </div>
  );
}
