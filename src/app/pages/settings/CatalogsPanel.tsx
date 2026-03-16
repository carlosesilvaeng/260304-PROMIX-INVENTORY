/**
 * CatalogsPanel
 * Admin panel to manage standardized catalogs:
 * - Materiales
 * - Procedencias
 * - Aditivos
 * - Curvas de conversion por planta
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../contexts/AuthContext';
import {
  createAdditiveCatalogItem,
  createCalibrationCurveCatalogItem,
  createMaterial,
  createProcedencia,
  executeCalibrationCurvesImport,
  deleteAdditiveCatalogItem,
  deleteCalibrationCurveCatalogItem,
  deleteMaterial,
  deleteProcedencia,
  executeAdditivesCatalogImport,
  executeMaterialsImport,
  executeProcedenciasImport,
  getAdditivesCatalog,
  getCalibrationCurvesCatalog,
  getMateriales,
  getProcedencias,
  previewCalibrationCurvesImport,
  previewAdditivesCatalogImport,
  previewMaterialsImport,
  previewProcedenciasImport,
  updateAdditiveCatalogItem,
  updateCalibrationCurveCatalogItem,
  updateMaterial,
  updateProcedencia,
  type AdditiveCatalogItem,
  type AdditivesCatalogImportExecuteResponse,
  type AdditivesCatalogImportPreviewResponse,
  type AdditivesCatalogImportRowPayload,
  type CalibrationCurvesImportPreviewResponse,
  type CalibrationCurvesImportRowPayload,
  type CalibrationCurveCatalogItem,
  type MaterialCatalogItem,
  type MaterialsImportExecuteResponse,
  type MaterialsImportPreviewResponse,
  type MaterialsImportRowPayload,
  type ProcedenciaCatalogItem,
  type ProcedenciasImportExecuteResponse,
  type ProcedenciasImportPreviewResponse,
  type ProcedenciasImportRowPayload,
} from '../../utils/api';
import { parseAdditivesCatalogImportFile } from '../../utils/additivesCatalogImportParser';
import {
  ADDITIVES_CATALOG_IMPORT_MODULE,
  ADDITIVES_CATALOG_IMPORT_TEMPLATE_VERSION,
  downloadAdditivesCatalogImportWorkbook,
  type AdditivesCatalogImportWorkbookRow,
} from '../../utils/additivesCatalogImportWorkbook';
import { parseMaterialsImportFile } from '../../utils/materialsImportParser';
import {
  downloadMaterialsImportWorkbook,
  MATERIALS_IMPORT_MODULE,
  MATERIALS_IMPORT_TEMPLATE_VERSION,
  type MaterialsImportWorkbookRow,
} from '../../utils/materialsImportWorkbook';
import { parseProcedenciasImportFile } from '../../utils/procedenciasImportParser';
import {
  downloadProcedenciasImportWorkbook,
  PROCEDENCIAS_IMPORT_MODULE,
  PROCEDENCIAS_IMPORT_TEMPLATE_VERSION,
  type ProcedenciasImportWorkbookRow,
} from '../../utils/procedenciasImportWorkbook';
import { parseCalibrationCurvesImportFile } from '../../utils/calibrationCurvesImportParser';
import {
  CALIBRATION_CURVES_IMPORT_MODULE,
  CALIBRATION_CURVES_IMPORT_TEMPLATE_VERSION,
  downloadCalibrationCurvesImportWorkbook,
  type CalibrationCurvesImportWorkbookRow,
} from '../../utils/calibrationCurvesImportWorkbook';

interface CatalogItem {
  id: string;
  nombre: string;
  clase?: string | null;
  sort_order: number;
}

type CatalogSectionKey = 'materiales' | 'procedencias' | 'aditivos' | 'curvas';

interface ImportSummary {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  creates: number;
  updates: number;
}

interface ImportErrorRow {
  row: number;
  column: string;
  message: string;
}

interface CatalogImportPreviewBase {
  template_version: string;
  import_mode: 'upsert';
  summary: ImportSummary;
  errors: ImportErrorRow[];
  warnings: string[];
  preview_token: string | null;
}

interface CatalogImportActionProps {
  exportingTemplate: boolean;
  exportingCurrent: boolean;
  previewingImport: boolean;
  onDownloadBlankTemplate: () => void;
  onDownloadCurrentConfiguration: () => void;
  onOpenFilePicker: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImportFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function ImportActions({
  exportingTemplate,
  exportingCurrent,
  previewingImport,
  onDownloadBlankTemplate,
  onDownloadCurrentConfiguration,
  onOpenFilePicker,
  fileInputRef,
  onImportFileSelected,
}: CatalogImportActionProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={onDownloadBlankTemplate}
        loading={exportingTemplate}
        className="border-[#2475C7] bg-[#EEF4FB] text-[#2475C7] hover:bg-[#DCEBFA]"
      >
        <FileSpreadsheet size={16} aria-hidden="true" />
        Descargar plantilla
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onDownloadCurrentConfiguration}
        loading={exportingCurrent}
        className="border-[#1D6F42] bg-[#EAF7EF] text-[#1D6F42] hover:bg-[#D9F1E2]"
      >
        <Download size={16} aria-hidden="true" />
        Exportar actual
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onOpenFilePicker}
        loading={previewingImport}
        className="border-[#C97A1E] bg-[#FFF4E8] text-[#9A5A12] hover:bg-[#FDE7CF]"
      >
        <Upload size={16} aria-hidden="true" />
        Importar plantilla
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={onImportFileSelected}
      />
    </div>
  );
}

function CatalogImportPreviewModal({
  isOpen,
  onClose,
  title,
  label,
  preview,
  fileName,
  reason,
  onReasonChange,
  onConfirm,
  executing,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  label: string;
  preview: CatalogImportPreviewBase | null;
  fileName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  executing: boolean;
}) {
  const hasBlockingErrors = Boolean(preview && preview.errors.length > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={executing}
            disabled={!preview?.preview_token || hasBlockingErrors || reason.trim().length < 10}
            onClick={onConfirm}
          >
            Importar catálogo
          </Button>
        </>
      }
    >
      {!preview ? (
        <p className="text-sm text-[#5F6773]">Preparando previsualización...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-4">
              <p className="text-xs text-[#5F6773]">Archivo</p>
              <p className="mt-1 text-sm font-medium text-[#3B3A36]">{fileName || 'Plantilla'}</p>
            </div>
            <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-4">
              <p className="text-xs text-[#5F6773]">Filas</p>
              <p className="mt-1 text-2xl font-semibold text-[#3B3A36]">{preview.summary.total_rows}</p>
            </div>
            <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-4">
              <p className="text-xs text-[#5F6773]">Válidas</p>
              <p className="mt-1 text-2xl font-semibold text-[#1D6F42]">{preview.summary.valid_rows}</p>
            </div>
            <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-4">
              <p className="text-xs text-[#5F6773]">Crear</p>
              <p className="mt-1 text-2xl font-semibold text-[#2475C7]">{preview.summary.creates}</p>
            </div>
            <div className="rounded border border-[#D4D8DD] bg-[#F9FAFB] p-4">
              <p className="text-xs text-[#5F6773]">Actualizar</p>
              <p className="mt-1 text-2xl font-semibold text-[#9A5A12]">{preview.summary.updates}</p>
            </div>
          </div>

          {preview.warnings.length > 0 && (
            <div className="space-y-2">
              {preview.warnings.map((warning) => (
                <div
                  key={warning}
                  className="rounded border border-[#F0C36D] bg-[#FFF8E7] px-4 py-3 text-sm text-[#9A5A12]"
                >
                  {warning}
                </div>
              ))}
            </div>
          )}

          {preview.errors.length > 0 ? (
            <div className="space-y-3">
              <div className="rounded border border-[#C94A4A]/30 bg-[#C94A4A]/10 px-4 py-3 text-sm text-[#C94A4A]">
                Se encontraron {preview.errors.length} errores. Corrige el archivo y vuelve a importarlo.
              </div>
              <div className="max-h-[320px] overflow-auto rounded border border-[#E4E4E4]">
                <table className="w-full min-w-[680px]">
                  <thead className="bg-[#F2F3F5] text-[#3B3A36]">
                    <tr>
                      <th className="px-4 py-3 text-left">Fila</th>
                      <th className="px-4 py-3 text-left">Columna</th>
                      <th className="px-4 py-3 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.map((item, index) => (
                      <tr key={`${item.row}-${item.column}-${index}`} className="border-t border-[#E4E4E4]">
                        <td className="px-4 py-3 text-sm text-[#3B3A36]">{item.row}</td>
                        <td className="px-4 py-3 text-sm text-[#3B3A36]">{item.column}</td>
                        <td className="px-4 py-3 text-sm text-[#C94A4A]">{item.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded border border-[#B7DFC2] bg-[#EAF7EF] px-4 py-3 text-sm text-[#1D6F42]">
              La plantilla es válida. Puedes confirmar la importación para aplicar las filas a {label}.
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-[#3B3A36]">
              Motivo de la importación
            </label>
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              className="min-h-[110px] w-full rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
              placeholder={`Ej: actualización masiva del catálogo de ${label.toLowerCase()}.`}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

interface CatalogTableProps {
  title: string;
  description: string;
  items: CatalogItem[];
  itemCountLabel?: string;
  loading: boolean;
  hasClase?: boolean;
  importControls?: CatalogImportActionProps;
  onAdd: (nombre: string, clase?: string) => Promise<void>;
  onUpdate: (id: string, nombre: string, clase?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function CatalogTable({
  title,
  description,
  items,
  itemCountLabel,
  loading,
  hasClase = false,
  importControls,
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
      <div className="border-b border-[#9D9B9A] p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h4 className="text-base font-medium text-[#3B3A36]">{title}</h4>
          {!loading && (
            <span className="inline-flex w-fit rounded-full bg-[#EEF4FB] px-3 py-1 text-xs font-medium text-[#2475C7]">
              {itemCountLabel || `${items.length} items`}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-[#5F6773]">{description}</p>
        {importControls && <ImportActions {...importControls} />}
      </div>

      {loading ? (
        <div className="p-8 text-center text-[#5F6773]">Cargando...</div>
      ) : (
        <>
          <table className="w-full">
            <thead className="bg-[#F2F3F5]">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-[#5F6773]">Nombre</th>
                {hasClase && (
                  <th className="px-4 py-2 text-left text-sm font-medium text-[#5F6773]">Clase</th>
                )}
                <th className="w-28 px-4 py-2 text-center text-sm font-medium text-[#5F6773]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={hasClase ? 3 : 2} className="px-4 py-6 text-center text-sm text-[#5F6773]">
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
                          className="w-full rounded border border-[#2475C7] px-2 py-1 text-sm text-[#3B3A36] focus:outline-none"
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
                            className="w-full rounded border border-[#2475C7] px-2 py-1 text-sm text-[#3B3A36] focus:outline-none"
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
                            className="rounded px-2 py-1 text-xs text-[#C94A4A] transition-colors hover:bg-[#C94A4A]/20 bg-[#C94A4A]/10"
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

          <div className="flex gap-2 border-t border-[#9D9B9A] bg-[#F2F3F5] p-3">
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              placeholder="Nombre..."
              className="flex-1 rounded border border-[#9D9B9A] bg-white px-3 py-1.5 text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
            />
            {hasClase && (
              <input
                type="text"
                value={newClase}
                onChange={(e) => setNewClase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                }}
                placeholder="Clase..."
                className="w-32 rounded border border-[#9D9B9A] bg-white px-3 py-1.5 text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
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
  itemCountLabel,
  importControls,
  onAdd,
  onUpdate,
  onDelete,
}: {
  items: AdditiveCatalogItem[];
  loading: boolean;
  itemCountLabel?: string;
  importControls?: CatalogImportActionProps;
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
      <div className="border-b border-[#9D9B9A] p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h4 className="text-base font-medium text-[#3B3A36]">Aditivos</h4>
          {!loading && (
            <span className="inline-flex w-fit rounded-full bg-[#EEF4FB] px-3 py-1 text-xs font-medium text-[#2475C7]">
              {itemCountLabel || `${items.length} items`}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-[#5F6773]">
          Catálogo maestro para nombre, marca y unidad. La configuración de aditivos por planta selecciona desde aquí.
        </p>
        {importControls && <ImportActions {...importControls} />}
      </div>

      {loading ? (
        <div className="p-8 text-center text-[#5F6773]">Cargando...</div>
      ) : (
        <>
          <table className="w-full">
            <thead className="bg-[#F2F3F5]">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-[#5F6773]">Nombre</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-[#5F6773]">Marca</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-[#5F6773]">Unidad</th>
                <th className="w-28 px-4 py-2 text-center text-sm font-medium text-[#5F6773]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-[#5F6773]">
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
                          className="w-full rounded border border-[#2475C7] px-2 py-1 text-sm text-[#3B3A36] focus:outline-none"
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
                          className="w-full rounded border border-[#2475C7] px-2 py-1 text-sm text-[#3B3A36] focus:outline-none"
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
                          className="w-full rounded border border-[#2475C7] px-2 py-1 text-sm text-[#3B3A36] focus:outline-none"
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
                            className="rounded bg-[#C94A4A]/10 px-2 py-1 text-xs text-[#C94A4A] transition-colors hover:bg-[#C94A4A]/20"
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
              className="rounded border border-[#9D9B9A] bg-white px-3 py-1.5 text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
            />
            <input
              type="text"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="Marca..."
              className="rounded border border-[#9D9B9A] bg-white px-3 py-1.5 text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
            />
            <input
              type="text"
              value={newUom}
              onChange={(e) => setNewUom(e.target.value)}
              placeholder="Unidad..."
              className="rounded border border-[#9D9B9A] bg-white px-3 py-1.5 text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
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
  itemCountLabel,
  loading,
  importControls,
  onAdd,
  onUpdate,
  onDelete,
}: {
  plantOptions: Array<{ value: string; label: string }>;
  selectedPlantId: string;
  onPlantChange: (plantId: string) => void;
  items: CalibrationCurveCatalogItem[];
  itemCountLabel?: string;
  loading: boolean;
  importControls?: CatalogImportActionProps;
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

  const startEdit = (item: CalibrationCurveCatalogItem) => {
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
      <div className="space-y-3 border-b border-[#9D9B9A] p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h4 className="text-base font-medium text-[#3B3A36]">Curvas de conversión</h4>
          {!loading && (
            <span className="inline-flex w-fit rounded-full bg-[#EEF4FB] px-3 py-1 text-xs font-medium text-[#2475C7]">
              {itemCountLabel || `${items.length} items`}
            </span>
          )}
        </div>
        <div>
          <p className="mt-0.5 text-sm text-[#5F6773]">
            Catálogo por planta para reutilizar tablas de conversión. La importación por Excel funciona por planta y hace upsert seguro sobre el nombre de curva. Si una curva ya está en uso, el sistema bloquea renombres y borrados para mantener diesel, silos y aditivos sincronizados.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <label className="min-w-[120px] text-sm text-[#5F6773]">Planta</label>
          <select
            value={selectedPlantId}
            onChange={(e) => onPlantChange(e.target.value)}
            className="w-full rounded border border-[#9D9B9A] bg-white px-3 py-2 text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none md:max-w-sm"
          >
            <option value="">Selecciona una planta</option>
            {plantOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {importControls && <ImportActions {...importControls} />}
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
                <th className="px-4 py-2 text-left text-sm font-medium text-[#5F6773]">Nombre</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-[#5F6773]">Método</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-[#5F6773]">Unidad lectura</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-[#5F6773]">Puntos</th>
                <th className="w-28 px-4 py-2 text-center text-sm font-medium text-[#5F6773]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-[#5F6773]">
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
                          className="w-full rounded border border-[#2475C7] px-2 py-1 text-sm text-[#3B3A36] focus:outline-none"
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
                          className="w-full rounded border border-[#2475C7] px-2 py-1 text-sm text-[#3B3A36] focus:outline-none"
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
                          className="w-full rounded border border-[#2475C7] px-2 py-1 text-sm text-[#3B3A36] focus:outline-none"
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
                        <div className="max-w-[260px] break-all whitespace-pre-wrap rounded bg-[#F2F3F5] px-2 py-1 font-mono text-xs text-[#5F6773]">
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
                            className="rounded bg-[#C94A4A]/10 px-2 py-1 text-xs text-[#C94A4A] transition-colors hover:bg-[#C94A4A]/20"
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

          <div className="space-y-2 border-t border-[#9D9B9A] bg-[#F2F3F5] p-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input
                type="text"
                value={newCurveName}
                onChange={(e) => setNewCurveName(e.target.value)}
                placeholder="Nombre de curva..."
                className="rounded border border-[#9D9B9A] bg-white px-3 py-1.5 text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
              />
              <input
                type="text"
                value={newMeasurementType}
                onChange={(e) => setNewMeasurementType(e.target.value)}
                placeholder="Método..."
                className="rounded border border-[#9D9B9A] bg-white px-3 py-1.5 text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
              />
              <input
                type="text"
                value={newReadingUom}
                onChange={(e) => setNewReadingUom(e.target.value)}
                placeholder="Unidad de lectura..."
                className="rounded border border-[#9D9B9A] bg-white px-3 py-1.5 text-sm text-[#3B3A36] focus:border-[#2475C7] focus:outline-none"
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
  const [materiales, setMateriales] = useState<MaterialCatalogItem[]>([]);
  const [procedencias, setProcedencias] = useState<ProcedenciaCatalogItem[]>([]);
  const [aditivos, setAditivos] = useState<AdditiveCatalogItem[]>([]);
  const [curvas, setCurvas] = useState<CalibrationCurveCatalogItem[]>([]);
  const [selectedCurvePlantId, setSelectedCurvePlantId] = useState('');
  const [activeSection, setActiveSection] = useState<CatalogSectionKey>(() => {
    if (typeof window === 'undefined') return 'materiales';
    const stored = window.localStorage.getItem('settings_catalog_active_section');
    if (stored === 'materiales' || stored === 'procedencias' || stored === 'aditivos' || stored === 'curvas') {
      return stored;
    }
    return 'materiales';
  });
  const [loadingMat, setLoadingMat] = useState(true);
  const [loadingProc, setLoadingProc] = useState(true);
  const [loadingAditivos, setLoadingAditivos] = useState(true);
  const [loadingCurvas, setLoadingCurvas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exportingMaterialsTemplate, setExportingMaterialsTemplate] = useState(false);
  const [exportingMaterialsCurrent, setExportingMaterialsCurrent] = useState(false);
  const [previewingMaterialsImport, setPreviewingMaterialsImport] = useState(false);
  const [executingMaterialsImport, setExecutingMaterialsImport] = useState(false);
  const [showMaterialsImportPreview, setShowMaterialsImportPreview] = useState(false);
  const [materialsImportPreview, setMaterialsImportPreview] = useState<MaterialsImportPreviewResponse | null>(null);
  const [materialsImportReason, setMaterialsImportReason] = useState('');
  const [materialsImportFileName, setMaterialsImportFileName] = useState('');
  const [materialsImportPayload, setMaterialsImportPayload] = useState<{
    module: 'materiales';
    template_version: string;
    import_mode: 'upsert';
    rows: MaterialsImportRowPayload[];
  } | null>(null);
  const materialsFileInputRef = useRef<HTMLInputElement | null>(null);

  const [exportingProcedenciasTemplate, setExportingProcedenciasTemplate] = useState(false);
  const [exportingProcedenciasCurrent, setExportingProcedenciasCurrent] = useState(false);
  const [previewingProcedenciasImport, setPreviewingProcedenciasImport] = useState(false);
  const [executingProcedenciasImport, setExecutingProcedenciasImport] = useState(false);
  const [showProcedenciasImportPreview, setShowProcedenciasImportPreview] = useState(false);
  const [procedenciasImportPreview, setProcedenciasImportPreview] = useState<ProcedenciasImportPreviewResponse | null>(null);
  const [procedenciasImportReason, setProcedenciasImportReason] = useState('');
  const [procedenciasImportFileName, setProcedenciasImportFileName] = useState('');
  const [procedenciasImportPayload, setProcedenciasImportPayload] = useState<{
    module: 'procedencias';
    template_version: string;
    import_mode: 'upsert';
    rows: ProcedenciasImportRowPayload[];
  } | null>(null);
  const procedenciasFileInputRef = useRef<HTMLInputElement | null>(null);

  const [exportingAditivosTemplate, setExportingAditivosTemplate] = useState(false);
  const [exportingAditivosCurrent, setExportingAditivosCurrent] = useState(false);
  const [previewingAditivosImport, setPreviewingAditivosImport] = useState(false);
  const [executingAditivosImport, setExecutingAditivosImport] = useState(false);
  const [showAditivosImportPreview, setShowAditivosImportPreview] = useState(false);
  const [aditivosImportPreview, setAditivosImportPreview] = useState<AdditivesCatalogImportPreviewResponse | null>(null);
  const [aditivosImportReason, setAditivosImportReason] = useState('');
  const [aditivosImportFileName, setAditivosImportFileName] = useState('');
  const [aditivosImportPayload, setAditivosImportPayload] = useState<{
    module: 'additivos_catalogo';
    template_version: string;
    import_mode: 'upsert';
    rows: AdditivesCatalogImportRowPayload[];
  } | null>(null);
  const aditivosFileInputRef = useRef<HTMLInputElement | null>(null);

  const [exportingCurvesTemplate, setExportingCurvesTemplate] = useState(false);
  const [exportingCurvesCurrent, setExportingCurvesCurrent] = useState(false);
  const [previewingCurvesImport, setPreviewingCurvesImport] = useState(false);
  const [executingCurvesImport, setExecutingCurvesImport] = useState(false);
  const [showCurvesImportPreview, setShowCurvesImportPreview] = useState(false);
  const [curvesImportPreview, setCurvesImportPreview] = useState<CalibrationCurvesImportPreviewResponse | null>(null);
  const [curvesImportReason, setCurvesImportReason] = useState('');
  const [curvesImportFileName, setCurvesImportFileName] = useState('');
  const [curvesImportPayload, setCurvesImportPayload] = useState<{
    module: 'calibration_curves';
    template_version: string;
    import_mode: 'upsert';
    rows: CalibrationCurvesImportRowPayload[];
  } | null>(null);
  const curvesFileInputRef = useRef<HTMLInputElement | null>(null);

  const plantOptions = useMemo(
    () => allPlants.map((plant) => ({ value: plant.id, label: plant.name })),
    [allPlants]
  );
  const selectedCurvePlant = useMemo(
    () => allPlants.find((plant) => plant.id === selectedCurvePlantId) || null,
    [allPlants, selectedCurvePlantId]
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('settings_catalog_active_section', activeSection);
  }, [activeSection]);

  const resetMaterialsImportFlow = () => {
    setShowMaterialsImportPreview(false);
    setMaterialsImportPreview(null);
    setMaterialsImportReason('');
    setMaterialsImportFileName('');
    setMaterialsImportPayload(null);
    if (materialsFileInputRef.current) {
      materialsFileInputRef.current.value = '';
    }
  };

  const resetProcedenciasImportFlow = () => {
    setShowProcedenciasImportPreview(false);
    setProcedenciasImportPreview(null);
    setProcedenciasImportReason('');
    setProcedenciasImportFileName('');
    setProcedenciasImportPayload(null);
    if (procedenciasFileInputRef.current) {
      procedenciasFileInputRef.current.value = '';
    }
  };

  const resetAditivosImportFlow = () => {
    setShowAditivosImportPreview(false);
    setAditivosImportPreview(null);
    setAditivosImportReason('');
    setAditivosImportFileName('');
    setAditivosImportPayload(null);
    if (aditivosFileInputRef.current) {
      aditivosFileInputRef.current.value = '';
    }
  };

  const resetCurvesImportFlow = () => {
    setShowCurvesImportPreview(false);
    setCurvesImportPreview(null);
    setCurvesImportReason('');
    setCurvesImportFileName('');
    setCurvesImportPayload(null);
    if (curvesFileInputRef.current) {
      curvesFileInputRef.current.value = '';
    }
  };

  const handleDownloadMaterialsBlankTemplate = async () => {
    setExportingMaterialsTemplate(true);
    setError(null);
    try {
      await downloadMaterialsImportWorkbook({ rows: [], templateType: 'blank' });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'No se pudo generar la plantilla de materiales.');
    } finally {
      setExportingMaterialsTemplate(false);
    }
  };

  const handleDownloadMaterialsCurrent = async () => {
    setExportingMaterialsCurrent(true);
    setError(null);
    try {
      const rows: MaterialsImportWorkbookRow[] = materiales.map((item) => ({
        nombre: item.nombre,
        clase: item.clase || null,
      }));
      await downloadMaterialsImportWorkbook({ rows, templateType: 'current_config' });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'No se pudo exportar el catálogo actual de materiales.');
    } finally {
      setExportingMaterialsCurrent(false);
    }
  };

  const handleMaterialsFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreviewingMaterialsImport(true);
    setError(null);

    try {
      const parsed = await parseMaterialsImportFile(file);
      const payload = {
        module: MATERIALS_IMPORT_MODULE,
        template_version: MATERIALS_IMPORT_TEMPLATE_VERSION,
        import_mode: 'upsert' as const,
        rows: parsed.rows.map((row) => ({
          row_number: row.row_number,
          nombre: row.nombre,
          clase: row.clase,
        })),
      };

      const response = await previewMaterialsImport(payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo validar el archivo.');
      }

      setMaterialsImportFileName(file.name);
      setMaterialsImportPayload(payload);
      setMaterialsImportPreview(response.data);
      setShowMaterialsImportPreview(true);
    } catch (importError: any) {
      setError(importError?.message || 'No se pudo procesar el archivo seleccionado.');
    } finally {
      setPreviewingMaterialsImport(false);
      event.target.value = '';
    }
  };

  const handleExecuteMaterialsImport = async () => {
    if (!materialsImportPayload || !materialsImportPreview?.preview_token) return;

    setExecutingMaterialsImport(true);
    setError(null);

    try {
      const response = await executeMaterialsImport({
        ...materialsImportPayload,
        preview_token: materialsImportPreview.preview_token,
        reason: materialsImportReason,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo importar el catálogo.');
      }

      resetMaterialsImportFlow();
      await loadMateriales();
    } catch (importError: any) {
      setError(importError?.message || 'No se pudo importar el catálogo.');
    } finally {
      setExecutingMaterialsImport(false);
    }
  };

  const handleDownloadProcedenciasBlankTemplate = async () => {
    setExportingProcedenciasTemplate(true);
    setError(null);
    try {
      await downloadProcedenciasImportWorkbook({ rows: [], templateType: 'blank' });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'No se pudo generar la plantilla de procedencias.');
    } finally {
      setExportingProcedenciasTemplate(false);
    }
  };

  const handleDownloadProcedenciasCurrent = async () => {
    setExportingProcedenciasCurrent(true);
    setError(null);
    try {
      const rows: ProcedenciasImportWorkbookRow[] = procedencias.map((item) => ({
        nombre: item.nombre,
      }));
      await downloadProcedenciasImportWorkbook({ rows, templateType: 'current_config' });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'No se pudo exportar el catálogo actual de procedencias.');
    } finally {
      setExportingProcedenciasCurrent(false);
    }
  };

  const handleProcedenciasFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreviewingProcedenciasImport(true);
    setError(null);

    try {
      const parsed = await parseProcedenciasImportFile(file);
      const payload = {
        module: PROCEDENCIAS_IMPORT_MODULE,
        template_version: PROCEDENCIAS_IMPORT_TEMPLATE_VERSION,
        import_mode: 'upsert' as const,
        rows: parsed.rows.map((row) => ({
          row_number: row.row_number,
          nombre: row.nombre,
        })),
      };

      const response = await previewProcedenciasImport(payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo validar el archivo.');
      }

      setProcedenciasImportFileName(file.name);
      setProcedenciasImportPayload(payload);
      setProcedenciasImportPreview(response.data);
      setShowProcedenciasImportPreview(true);
    } catch (importError: any) {
      setError(importError?.message || 'No se pudo procesar el archivo seleccionado.');
    } finally {
      setPreviewingProcedenciasImport(false);
      event.target.value = '';
    }
  };

  const handleExecuteProcedenciasImport = async () => {
    if (!procedenciasImportPayload || !procedenciasImportPreview?.preview_token) return;

    setExecutingProcedenciasImport(true);
    setError(null);

    try {
      const response = await executeProcedenciasImport({
        ...procedenciasImportPayload,
        preview_token: procedenciasImportPreview.preview_token,
        reason: procedenciasImportReason,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo importar el catálogo.');
      }

      resetProcedenciasImportFlow();
      await loadProcedencias();
    } catch (importError: any) {
      setError(importError?.message || 'No se pudo importar el catálogo.');
    } finally {
      setExecutingProcedenciasImport(false);
    }
  };

  const handleDownloadAditivosBlankTemplate = async () => {
    setExportingAditivosTemplate(true);
    setError(null);
    try {
      await downloadAdditivesCatalogImportWorkbook({ rows: [], templateType: 'blank' });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'No se pudo generar la plantilla de aditivos.');
    } finally {
      setExportingAditivosTemplate(false);
    }
  };

  const handleDownloadAditivosCurrent = async () => {
    setExportingAditivosCurrent(true);
    setError(null);
    try {
      const rows: AdditivesCatalogImportWorkbookRow[] = aditivos.map((item) => ({
        nombre: item.nombre,
        marca: item.marca || null,
        uom: item.uom,
      }));
      await downloadAdditivesCatalogImportWorkbook({ rows, templateType: 'current_config' });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'No se pudo exportar el catálogo actual de aditivos.');
    } finally {
      setExportingAditivosCurrent(false);
    }
  };

  const handleAditivosFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreviewingAditivosImport(true);
    setError(null);

    try {
      const parsed = await parseAdditivesCatalogImportFile(file);
      const payload = {
        module: ADDITIVES_CATALOG_IMPORT_MODULE,
        template_version: ADDITIVES_CATALOG_IMPORT_TEMPLATE_VERSION,
        import_mode: 'upsert' as const,
        rows: parsed.rows.map((row) => ({
          row_number: row.row_number,
          nombre: row.nombre,
          marca: row.marca,
          uom: row.uom,
        })),
      };

      const response = await previewAdditivesCatalogImport(payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo validar el archivo.');
      }

      setAditivosImportFileName(file.name);
      setAditivosImportPayload(payload);
      setAditivosImportPreview(response.data);
      setShowAditivosImportPreview(true);
    } catch (importError: any) {
      setError(importError?.message || 'No se pudo procesar el archivo seleccionado.');
    } finally {
      setPreviewingAditivosImport(false);
      event.target.value = '';
    }
  };

  const handleExecuteAditivosImport = async () => {
    if (!aditivosImportPayload || !aditivosImportPreview?.preview_token) return;

    setExecutingAditivosImport(true);
    setError(null);

    try {
      const response = await executeAdditivesCatalogImport({
        ...aditivosImportPayload,
        preview_token: aditivosImportPreview.preview_token,
        reason: aditivosImportReason,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo importar el catálogo.');
      }

      resetAditivosImportFlow();
      await loadAdditives();
    } catch (importError: any) {
      setError(importError?.message || 'No se pudo importar el catálogo.');
    } finally {
      setExecutingAditivosImport(false);
    }
  };

  const handleDownloadCurvesBlankTemplate = async () => {
    if (!selectedCurvePlant) {
      setError('Selecciona una planta antes de descargar la plantilla de curvas.');
      return;
    }

    setExportingCurvesTemplate(true);
    setError(null);
    try {
      await downloadCalibrationCurvesImportWorkbook({
        plant: selectedCurvePlant,
        rows: [],
        templateType: 'blank',
      });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'No se pudo generar la plantilla de curvas.');
    } finally {
      setExportingCurvesTemplate(false);
    }
  };

  const handleDownloadCurvesCurrent = async () => {
    if (!selectedCurvePlant) {
      setError('Selecciona una planta antes de exportar las curvas.');
      return;
    }

    setExportingCurvesCurrent(true);
    setError(null);
    try {
      const rows: CalibrationCurvesImportWorkbookRow[] = curvas.map((item) => ({
        curve_name: item.curve_name,
        measurement_type: item.measurement_type,
        reading_uom: item.reading_uom || null,
        data_points: item.data_points || {},
      }));
      await downloadCalibrationCurvesImportWorkbook({
        plant: selectedCurvePlant,
        rows,
        templateType: 'current_config',
      });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'No se pudo exportar el catálogo actual de curvas.');
    } finally {
      setExportingCurvesCurrent(false);
    }
  };

  const handleCurvesFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedCurvePlant) {
      setError('Selecciona una planta antes de importar curvas.');
      event.target.value = '';
      return;
    }

    setPreviewingCurvesImport(true);
    setError(null);

    try {
      const parsed = await parseCalibrationCurvesImportFile(file);
      if (parsed.meta.plant_id !== selectedCurvePlant.id) {
        throw new Error(`La plantilla corresponde a la planta "${parsed.meta.plant_name || parsed.meta.plant_id}" y no a la planta seleccionada.`);
      }

      const payload = {
        module: CALIBRATION_CURVES_IMPORT_MODULE,
        template_version: CALIBRATION_CURVES_IMPORT_TEMPLATE_VERSION,
        import_mode: 'upsert' as const,
        rows: parsed.rows.map((row) => ({
          row_number: row.row_number,
          curve_name: row.curve_name,
          measurement_type: row.measurement_type,
          reading_uom: row.reading_uom,
          data_points_json: row.data_points_json,
        })),
      };

      const response = await previewCalibrationCurvesImport(selectedCurvePlant.id, payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo validar el archivo.');
      }

      setCurvesImportFileName(file.name);
      setCurvesImportPayload(payload);
      setCurvesImportPreview(response.data);
      setShowCurvesImportPreview(true);
    } catch (importError: any) {
      setError(importError?.message || 'No se pudo procesar el archivo seleccionado.');
    } finally {
      setPreviewingCurvesImport(false);
      event.target.value = '';
    }
  };

  const handleExecuteCurvesImport = async () => {
    if (!selectedCurvePlantId || !curvesImportPayload || !curvesImportPreview?.preview_token) return;

    setExecutingCurvesImport(true);
    setError(null);

    try {
      const response = await executeCalibrationCurvesImport(selectedCurvePlantId, {
        ...curvesImportPayload,
        preview_token: curvesImportPreview.preview_token,
        reason: curvesImportReason,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo importar el catálogo de curvas.');
      }

      resetCurvesImportFlow();
      await loadCurves(selectedCurvePlantId);
    } catch (importError: any) {
      setError(importError?.message || 'No se pudo importar el catálogo de curvas.');
    } finally {
      setExecutingCurvesImport(false);
    }
  };

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

  const handleCurvePlantChange = (plantId: string) => {
    if (plantId !== selectedCurvePlantId) {
      resetCurvesImportFlow();
    }
    setSelectedCurvePlantId(plantId);
  };

  const sectionOptions: Array<{
    key: CatalogSectionKey;
    label: string;
    description: string;
    count: number;
  }> = [
    {
      key: 'materiales',
      label: 'Materiales',
      description: 'Tipos de material que pueden asignarse a un cajón.',
      count: materiales.length,
    },
    {
      key: 'procedencias',
      label: 'Procedencias',
      description: 'Suplidores o procedencias del material.',
      count: procedencias.length,
    },
    {
      key: 'aditivos',
      label: 'Aditivos',
      description: 'Catálogo maestro para nombre, marca y unidad.',
      count: aditivos.length,
    },
    {
      key: 'curvas',
      label: 'Curvas de conversión',
      description: 'Catálogo por planta para tablas de conversión.',
      count: curvas.length,
    },
  ];

  const activeSectionMeta = sectionOptions.find((option) => option.key === activeSection) || sectionOptions[0];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg text-[#3B3A36]">Catálogos</h3>
        <p className="mt-1 text-sm text-[#5F6773]">
          Administra los valores estandarizados que usan las configuraciones por planta. Materiales, procedencias, aditivos y curvas de conversión ya soportan importación masiva con plantilla Excel y previsualización, y el sistema procura mantener las configuraciones sincronizadas con esos catálogos.
        </p>
      </div>

      {error && (
        <div className="rounded border border-[#C94A4A]/30 bg-[#C94A4A]/10 p-3 text-sm text-[#C94A4A]">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="rounded-lg border border-[#D4D8DD] bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-[#3B3A36]">Sección activa</p>
              <p className="mt-1 text-sm text-[#5F6773]">{activeSectionMeta.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sectionOptions.map((option) => {
                const isActive = option.key === activeSection;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setActiveSection(option.key)}
                    className={[
                      'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-[#2475C7] bg-[#EEF4FB] text-[#2475C7]'
                        : 'border-[#D4D8DD] bg-white text-[#5F6773] hover:border-[#9D9B9A] hover:text-[#3B3A36]',
                    ].join(' ')}
                  >
                    {option.label} ({option.count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {activeSection === 'materiales' && (
          <CatalogTable
            title="Materiales"
            description="Tipos de material que pueden asignarse a un cajón."
            items={materiales}
            itemCountLabel={`${materiales.length} items`}
            loading={loadingMat}
            hasClase={true}
            importControls={{
              exportingTemplate: exportingMaterialsTemplate,
              exportingCurrent: exportingMaterialsCurrent,
              previewingImport: previewingMaterialsImport,
              onDownloadBlankTemplate: handleDownloadMaterialsBlankTemplate,
              onDownloadCurrentConfiguration: handleDownloadMaterialsCurrent,
              onOpenFilePicker: () => {
                setError(null);
                materialsFileInputRef.current?.click();
              },
              fileInputRef: materialsFileInputRef,
              onImportFileSelected: handleMaterialsFileSelected,
            }}
            onAdd={handleAddMaterial}
            onUpdate={handleUpdateMaterial}
            onDelete={handleDeleteMaterial}
          />
        )}

        {activeSection === 'procedencias' && (
          <CatalogTable
            title="Procedencias"
            description="Nombre del suplidor o procedencia del material."
            items={procedencias}
            itemCountLabel={`${procedencias.length} items`}
            loading={loadingProc}
            importControls={{
              exportingTemplate: exportingProcedenciasTemplate,
              exportingCurrent: exportingProcedenciasCurrent,
              previewingImport: previewingProcedenciasImport,
              onDownloadBlankTemplate: handleDownloadProcedenciasBlankTemplate,
              onDownloadCurrentConfiguration: handleDownloadProcedenciasCurrent,
              onOpenFilePicker: () => {
                setError(null);
                procedenciasFileInputRef.current?.click();
              },
              fileInputRef: procedenciasFileInputRef,
              onImportFileSelected: handleProcedenciasFileSelected,
            }}
            onAdd={handleAddProcedencia}
            onUpdate={handleUpdateProcedencia}
            onDelete={handleDeleteProcedencia}
          />
        )}

        {activeSection === 'aditivos' && (
          <AdditiveCatalogTable
            items={aditivos}
            loading={loadingAditivos}
            itemCountLabel={`${aditivos.length} items`}
            importControls={{
              exportingTemplate: exportingAditivosTemplate,
              exportingCurrent: exportingAditivosCurrent,
              previewingImport: previewingAditivosImport,
              onDownloadBlankTemplate: handleDownloadAditivosBlankTemplate,
              onDownloadCurrentConfiguration: handleDownloadAditivosCurrent,
              onOpenFilePicker: () => {
                setError(null);
                aditivosFileInputRef.current?.click();
              },
              fileInputRef: aditivosFileInputRef,
              onImportFileSelected: handleAditivosFileSelected,
            }}
            onAdd={handleAddAditivo}
            onUpdate={handleUpdateAditivo}
            onDelete={handleDeleteAditivo}
          />
        )}

        {activeSection === 'curvas' && (
          <CalibrationCurvesTable
            plantOptions={plantOptions}
            selectedPlantId={selectedCurvePlantId}
            onPlantChange={handleCurvePlantChange}
            items={curvas}
            itemCountLabel={selectedCurvePlantId ? `${curvas.length} items` : 'Selecciona una planta'}
            loading={loadingCurvas}
            importControls={{
              exportingTemplate: exportingCurvesTemplate,
              exportingCurrent: exportingCurvesCurrent,
              previewingImport: previewingCurvesImport,
              onDownloadBlankTemplate: handleDownloadCurvesBlankTemplate,
              onDownloadCurrentConfiguration: handleDownloadCurvesCurrent,
              onOpenFilePicker: () => {
                if (!selectedCurvePlantId) {
                  setError('Selecciona una planta antes de importar curvas.');
                  return;
                }
                setError(null);
                curvesFileInputRef.current?.click();
              },
              fileInputRef: curvesFileInputRef,
              onImportFileSelected: handleCurvesFileSelected,
            }}
            onAdd={handleAddCurve}
            onUpdate={handleUpdateCurve}
            onDelete={handleDeleteCurve}
          />
        )}
      </div>

      <CatalogImportPreviewModal
        isOpen={showMaterialsImportPreview}
        onClose={resetMaterialsImportFlow}
        title="Previsualización de importación de materiales"
        label="Materiales"
        preview={materialsImportPreview}
        fileName={materialsImportFileName}
        reason={materialsImportReason}
        onReasonChange={setMaterialsImportReason}
        onConfirm={handleExecuteMaterialsImport}
        executing={executingMaterialsImport}
      />

      <CatalogImportPreviewModal
        isOpen={showProcedenciasImportPreview}
        onClose={resetProcedenciasImportFlow}
        title="Previsualización de importación de procedencias"
        label="Procedencias"
        preview={procedenciasImportPreview}
        fileName={procedenciasImportFileName}
        reason={procedenciasImportReason}
        onReasonChange={setProcedenciasImportReason}
        onConfirm={handleExecuteProcedenciasImport}
        executing={executingProcedenciasImport}
      />

      <CatalogImportPreviewModal
        isOpen={showAditivosImportPreview}
        onClose={resetAditivosImportFlow}
        title="Previsualización de importación de aditivos"
        label="Aditivos"
        preview={aditivosImportPreview}
        fileName={aditivosImportFileName}
        reason={aditivosImportReason}
        onReasonChange={setAditivosImportReason}
        onConfirm={handleExecuteAditivosImport}
        executing={executingAditivosImport}
      />

      <CatalogImportPreviewModal
        isOpen={showCurvesImportPreview}
        onClose={resetCurvesImportFlow}
        title="Previsualización de importación de curvas"
        label="Curvas de conversión"
        preview={curvesImportPreview}
        fileName={curvesImportFileName}
        reason={curvesImportReason}
        onReasonChange={setCurvesImportReason}
        onConfirm={handleExecuteCurvesImport}
        executing={executingCurvesImport}
      />
    </div>
  );
}
