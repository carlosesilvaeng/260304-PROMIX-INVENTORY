import { AlertTriangle, FileImage, FileSpreadsheet, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { PromixLogo } from '../components/PromixLogo';
import { Alert } from '../components/Alert';
import { Card } from '../components/Card';
import { UserManagement } from './settings/UserManagement';
import { ModuleManagementPanel } from './settings/ModuleManagementPanel';
import { AuditPanel } from './settings/AuditPanel';
import { CatalogsPanel } from './settings/CatalogsPanel';
import { UnitsPanel } from './settings/UnitsPanel';
import { DataControlPanel } from './settings/DataControlPanel';
import { deletePlantLayoutImage, getPlantConfigurationCounts, uploadPlantLayoutImage } from '../utils/api';
import { compressImage } from '../utils/imageCompression';
import { AggregatesConfigModal } from '../components/AggregatesConfigModal';
import { SilosConfigModal } from '../components/SilosConfigModal';
import { AdditivesConfigModal } from '../components/AdditivesConfigModal';
import { DieselConfigModal } from '../components/DieselConfigModal';
import { ProductsConfigModal } from '../components/ProductsConfigModal';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { exportPlantConfigurations } from '../utils/exportPlantConfigurations';
import type { Plant } from '../contexts/AuthContext';
import { canAccessAudit, canManageModules, canManagePlantConfiguration, canManagePlantManagers } from '../utils/permissions';

// Build Version - Update manually when deploying
// Format: YYMMDDHHMM (GMT-5 Puerto Rico Time) = 26/02/18 20:00 = Feb 18, 2026 8:00 PM
const BUILD_VERSION = '2603131812';

interface PlantModuleCounts {
  aggregates: number;
  silos: number;
  additives: number;
  diesel: number;
  products: number;
  hasInvalidAggregates: boolean;
}

const EMPTY_MODULE_COUNTS: PlantModuleCounts = {
  aggregates: 0,
  silos: 0,
  additives: 0,
  diesel: 0,
  products: 0,
  hasInvalidAggregates: false,
};

export function Settings() {
  const { user, allPlants, togglePlantStatus, updatePlant, createPlant, refreshPlants } = useAuth();
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [plantsExportMessage, setPlantsExportMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [exportingPlantsConfig, setExportingPlantsConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'plants' | 'users' | 'audit' | 'modules' | 'catalogs' | 'units' | 'data-control' | 'account'>('plants');
  const [editingAggregates, setEditingAggregates] = useState<Plant | null>(null);
  const [editingSilos, setEditingSilos] = useState<Plant | null>(null);
  const [editingAdditives, setEditingAdditives] = useState<Plant | null>(null);
  const [editingDiesel, setEditingDiesel] = useState<Plant | null>(null);
  const [editingProducts, setEditingProducts] = useState<Plant | null>(null);
  const [editingLayout, setEditingLayout] = useState<Plant | null>(null);
  const [layoutUploading, setLayoutUploading] = useState(false);
  const [layoutDeleting, setLayoutDeleting] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [layoutPreviewUrl, setLayoutPreviewUrl] = useState<string | null>(null);
  const [viewingPlantDetails, setViewingPlantDetails] = useState<Plant | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showCreatePlantModal, setShowCreatePlantModal] = useState(false);
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantCode, setNewPlantCode] = useState('');
  const [newPlantLocation, setNewPlantLocation] = useState('');
  const [plantModuleCounts, setPlantModuleCounts] = useState<Record<string, PlantModuleCounts>>({});
  const canManageUsers = canManagePlantManagers(user?.role);
  const canManagePlants = canManagePlantConfiguration(user?.role);
  const canViewAudit = canAccessAudit(user?.role);
  const canManageSystemModules = canManageModules(user?.role);
  const canAccessDataControl = user?.role === 'super_admin';
  const hasManagementTabs = canManageUsers || canManagePlants || canViewAudit || canManageSystemModules || canAccessDataControl;

  useEffect(() => {
    if (!user) return;

    const allowedTabs = new Set<typeof activeTab>(['account']);
    if (canManageUsers) allowedTabs.add('users');
    if (canManagePlants) {
      allowedTabs.add('plants');
      allowedTabs.add('catalogs');
      allowedTabs.add('units');
    }
    if (canViewAudit) allowedTabs.add('audit');
    if (canManageSystemModules) allowedTabs.add('modules');
    if (canAccessDataControl) allowedTabs.add('data-control');

    if (!allowedTabs.has(activeTab)) {
      setActiveTab(canManageUsers ? 'users' : 'account');
    } else if (!hasManagementTabs) {
      setActiveTab('account');
    }
  }, [user, activeTab, canManageUsers, canManagePlants, canViewAudit, canManageSystemModules, canAccessDataControl, hasManagementTabs]);

  const handleSave = () => {
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const loadPlantModuleCounts = async () => {
    if (allPlants.length === 0) {
      setPlantModuleCounts({});
      return;
    }

    try {
      const response = await getPlantConfigurationCounts();
      if (!response.success || !response.data) {
        throw new Error(response.error || 'No se pudo cargar el resumen de configuraciones.');
      }

      setPlantModuleCounts(
        Object.fromEntries(
          response.data.map((row) => [
            row.plant_id,
            {
              aggregates: row.aggregates,
              silos: row.silos,
              additives: row.additives,
              diesel: row.diesel,
              products: row.products,
              hasInvalidAggregates: row.hasInvalidAggregates,
            },
          ])
        )
      );
    } catch (error) {
      console.error('❌ Error cargando conteos de configuración:', error);
      setPlantModuleCounts({});
    }
  };

  useEffect(() => {
    if (!canManagePlants || activeTab !== 'plants') return;
    loadPlantModuleCounts();
  }, [activeTab, allPlants, canManagePlants]);

  const getCountsForPlant = (plant: Plant) => {
    return plantModuleCounts[plant.id] || {
      ...EMPTY_MODULE_COUNTS,
      silos: plant.silos.length,
    };
  };

  const renderConfigActionButton = ({
    icon,
    label,
    count,
    hasWarning = false,
    onClick,
  }: {
    icon: string;
    label: string;
    count: number;
    hasWarning?: boolean;
    onClick: () => void;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="min-w-[92px] flex-col gap-0.5 px-2 py-2 leading-tight"
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="flex items-center justify-center gap-1 text-xs font-medium text-center">
        <span>{label}</span>
        {hasWarning && <AlertTriangle size={12} className="text-[#C97A1E]" aria-hidden="true" />}
      </span>
      <span className="flex items-center justify-center gap-1 leading-none">
        <span className={`text-lg font-semibold ${count > 0 ? 'text-[#C94A4A]' : 'text-[#9D9B9A]'}`}>
          {count}
        </span>
      </span>
    </Button>
  );

  const handleTogglePlantStatus = (plant: Plant) => {
    const nextStatus = plant.isActive ? 'inactiva' : 'activa';
    const confirmed = window.confirm(
      `¿Confirmas cambiar la planta "${plant.name}" a estado ${nextStatus}?`
    );
    if (!confirmed) return;
    togglePlantStatus(plant.id);
    handleSave();
  };

  const handleCreatePlant = () => {
    const name = newPlantName.trim();
    const code = newPlantCode.trim().toUpperCase();
    const location = newPlantLocation.trim();

    if (!name || !code || !location) {
      window.alert('Completa nombre, código y ubicación para agregar la planta.');
      return;
    }

    const duplicatedCode = allPlants.some((p) => p.code.toUpperCase() === code);
    if (duplicatedCode) {
      window.alert(`Ya existe una planta con el código "${code}".`);
      return;
    }

    createPlant({
      name,
      code,
      location,
      methods: {
        hasConeMeasurement: true,
        hasCajonMeasurement: true,
      },
      cajones: [],
      silos: [],
      pettyCashEstablished: 0,
      isActive: true,
    });

    setNewPlantName('');
    setNewPlantCode('');
    setNewPlantLocation('');
    setShowCreatePlantModal(false);
    handleSave();
  };

  const handleExportPlantsConfiguration = async () => {
    setExportingPlantsConfig(true);
    setPlantsExportMessage(null);

    try {
      await exportPlantConfigurations(allPlants);
      setPlantsExportMessage({
        type: 'success',
        message: 'Configuración activa exportada exitosamente a Excel.',
      });
    } catch (error: any) {
      console.error('❌ Error exportando configuración de plantas:', error);
      setPlantsExportMessage({
        type: 'error',
        message: error?.message || 'No se pudo exportar la configuración activa de plantas.',
      });
    } finally {
      setExportingPlantsConfig(false);
    }
  };

  const openLayoutModal = (plant: Plant) => {
    setEditingLayout(plant);
    setLayoutPreviewUrl(plant.layoutImageUrl || null);
    setLayoutMessage(null);
  };

  const handleLayoutFileSelected = async (file: File | null) => {
    if (!editingLayout || !file) return;

    const isJpeg = file.type === 'image/jpeg' || /\.(jpe?g)$/i.test(file.name);
    if (!isJpeg) {
      setLayoutMessage({ type: 'error', message: 'Selecciona una imagen JPG para el layout.' });
      return;
    }

    setLayoutUploading(true);
    setLayoutMessage(null);

    try {
      const compressed = await compressImage(file, {
        maxWidth: 2400,
        maxHeight: 1800,
        quality: 0.88,
        mimeType: 'image/jpeg',
      });
      const response = await uploadPlantLayoutImage(editingLayout.id, {
        base64: compressed,
        filename: file.name,
      });

      if (!response.success || !response.data?.layout_image_url) {
        throw new Error(response.error || 'No se pudo guardar el layout de la planta.');
      }

      setLayoutPreviewUrl(response.data.layout_image_url);
      setLayoutMessage({ type: 'success', message: 'Layout guardado exitosamente.' });
      await refreshPlants();
      handleSave();
    } catch (error: any) {
      console.error('❌ Error guardando layout:', error);
      setLayoutMessage({ type: 'error', message: error?.message || 'No se pudo guardar el layout.' });
    } finally {
      setLayoutUploading(false);
    }
  };

  const handleDeleteLayout = async () => {
    if (!editingLayout) return;
    const confirmed = window.confirm(`¿Eliminar el layout de "${editingLayout.name}"?`);
    if (!confirmed) return;

    setLayoutDeleting(true);
    setLayoutMessage(null);

    try {
      const response = await deletePlantLayoutImage(editingLayout.id);
      if (!response.success) {
        throw new Error(response.error || 'No se pudo eliminar el layout.');
      }

      setLayoutPreviewUrl(null);
      setLayoutMessage({ type: 'success', message: 'Layout eliminado.' });
      await refreshPlants();
      handleSave();
    } catch (error: any) {
      console.error('❌ Error eliminando layout:', error);
      setLayoutMessage({ type: 'error', message: error?.message || 'No se pudo eliminar el layout.' });
    } finally {
      setLayoutDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Logo Header */}
      <div className="flex justify-center mb-2">
        <PromixLogo size="lg" />
      </div>
      
      <div>
        <h2 className="text-2xl text-[#3B3A36]">Configuración</h2>
        <p className="text-[#5F6773]">Gestión de plantas, usuarios y auditoría</p>
      </div>

      {showSaveSuccess && (
        <Alert 
          type="success" 
          message="Configuración guardada exitosamente" 
          autoClose 
        />
      )}

      {plantsExportMessage && (
        <Alert
          type={plantsExportMessage.type}
          message={plantsExportMessage.message}
          onClose={() => setPlantsExportMessage(null)}
          autoClose={plantsExportMessage.type === 'success'}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-[#9D9B9A]">
        <div className="flex gap-4">
          {canManagePlants && (
            <>
              <button
                onClick={() => setActiveTab('plants')}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'plants'
                    ? 'border-[#2475C7] text-[#2475C7]'
                    : 'border-transparent text-[#5F6773] hover:text-[#3B3A36]'
                }`}
              >
                Plantas
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'audit'
                    ? 'border-[#2475C7] text-[#2475C7]'
                    : 'border-transparent text-[#5F6773] hover:text-[#3B3A36]'
                }`}
              >
                Auditoría
              </button>
              <button
                onClick={() => setActiveTab('catalogs')}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'catalogs'
                    ? 'border-[#2475C7] text-[#2475C7]'
                    : 'border-transparent text-[#5F6773] hover:text-[#3B3A36]'
                }`}
              >
                Catálogos
              </button>
              <button
                onClick={() => setActiveTab('units')}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'units'
                    ? 'border-[#2475C7] text-[#2475C7]'
                    : 'border-transparent text-[#5F6773] hover:text-[#3B3A36]'
                }`}
              >
                Unidades
              </button>
            </>
          )}
          {canManageUsers && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-[#2475C7] text-[#2475C7]'
                  : 'border-transparent text-[#5F6773] hover:text-[#3B3A36]'
              }`}
            >
              Usuarios
            </button>
          )}
          {canManageSystemModules && (
            <button
              onClick={() => setActiveTab('modules')}
              className={`px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'modules'
                  ? 'border-[#2475C7] text-[#2475C7]'
                  : 'border-transparent text-[#5F6773] hover:text-[#3B3A36]'
              }`}
            >
              Módulos
            </button>
          )}
          {canAccessDataControl && (
            <button
              onClick={() => setActiveTab('data-control')}
              className={`px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'data-control'
                  ? 'border-[#2475C7] text-[#2475C7]'
                  : 'border-transparent text-[#5F6773] hover:text-[#3B3A36]'
              }`}
            >
              Control de Datos
            </button>
          )}
          {/* Todos los usuarios pueden ver Mi Cuenta y cambiar contraseña */}
          <button
            onClick={() => setActiveTab('account')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'account'
                ? 'border-[#2475C7] text-[#2475C7]'
                : 'border-transparent text-[#5F6773] hover:text-[#3B3A36]'
            }`}
          >
            Mi Cuenta
          </button>
        </div>
      </div>

      {!hasManagementTabs && (
        <Alert
          type="warning"
          message="Acceso limitado: como Gerente solo puedes administrar Mi Cuenta y cambiar tu contraseña."
        />
      )}

      {/* Plants Tab */}
      {canManagePlants && activeTab === 'plants' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg text-[#3B3A36]">Gestión de Plantas</h3>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleExportPlantsConfiguration}
                loading={exportingPlantsConfig}
                disabled={allPlants.length === 0}
                className="min-w-[250px] border-[#1D6F42] bg-[#EAF7EF] text-[#1D6F42] hover:bg-[#D9F1E2]"
              >
                <FileSpreadsheet size={18} aria-hidden="true" />
                <span>Exportar configuración activa</span>
              </Button>
              {(user?.role === 'super_admin' || user?.role === 'admin') && (
                <Button variant="secondary" onClick={() => setShowCreatePlantModal(true)}>
                  + Agregar Planta
                </Button>
              )}
            </div>
          </div>

          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="bg-[#3B3A36] text-white">
                  <tr>
                    <th className="px-6 py-3 text-left">Nombre</th>
                    <th className="px-6 py-3 text-left">Código</th>
                    <th className="px-6 py-3 text-center">Estado</th>
                    <th className="px-6 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {allPlants.map((plant) => {
                    const counts = getCountsForPlant(plant);

                    return (
                      <tr key={plant.id} className="border-b border-[#9D9B9A]">
                        <td className="px-6 py-4 text-[#3B3A36] font-medium">{plant.name}</td>
                        <td className="px-6 py-4 text-[#5F6773]">{plant.code}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleTogglePlantStatus(plant)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              plant.isActive
                                ? 'bg-[#2ecc71]/10 text-[#2ecc71] hover:bg-[#2ecc71]/20'
                                : 'bg-[#C94A4A]/10 text-[#C94A4A] hover:bg-[#C94A4A]/20'
                            }`}
                          >
                            {plant.isActive ? 'Activa' : 'Inactiva'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-wrap items-start justify-center gap-2">
                            {renderConfigActionButton({
                              icon: '🏗️',
                              label: 'Silos',
                              count: counts.silos,
                              onClick: () => setEditingSilos(plant),
                            })}
                            {renderConfigActionButton({
                              icon: '📐',
                              label: 'Agregados',
                              count: counts.aggregates,
                              hasWarning: counts.hasInvalidAggregates,
                              onClick: () => setEditingAggregates(plant),
                            })}
                            {renderConfigActionButton({
                              icon: '⚗️',
                              label: 'Aditivos',
                              count: counts.additives,
                              onClick: () => setEditingAdditives(plant),
                            })}
                            {renderConfigActionButton({
                              icon: '⛽',
                              label: 'Diesel',
                              count: counts.diesel,
                              onClick: () => setEditingDiesel(plant),
                            })}
                            {renderConfigActionButton({
                              icon: '🛢️',
                              label: 'Aceites y Productos',
                              count: counts.products,
                              onClick: () => setEditingProducts(plant),
                            })}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openLayoutModal(plant)}
                              className="min-w-[92px] flex-col gap-0.5 px-2 py-2 leading-tight"
                            >
                              <FileImage size={22} aria-hidden="true" />
                              <span className="text-xs font-medium">Layout</span>
                              <span className={`text-xs font-semibold ${plant.layoutImageUrl ? 'text-[#2E7D4F]' : 'text-[#9D9B9A]'}`}>
                                {plant.layoutImageUrl ? 'Cargado' : 'Sin JPG'}
                              </span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-w-[110px] self-center"
                              onClick={() => setViewingPlantDetails(plant)}
                            >
                              Ver Detalles
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-4 p-4 bg-[#F2F3F5] rounded border border-[#9D9B9A]">
            <p className="text-sm text-[#5F6773]">
              <strong>Nota:</strong> Las plantas inactivas no aparecerán en la selección de plantas para los usuarios.
              {user?.role === 'super_admin' && ' Como Super Administrador, puedes crear nuevas plantas y administrar sus configuraciones.'}
            </p>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {canManageUsers && activeTab === 'users' && (
        <UserManagement />
      )}

      {/* Audit Tab */}
      {canViewAudit && activeTab === 'audit' && (
        <AuditPanel />
      )}
      
      {/* Modules Tab */}
      {canManageSystemModules && activeTab === 'modules' && (
        <div className="space-y-4">
          <ModuleManagementPanel />
        </div>
      )}

      {canAccessDataControl && activeTab === 'data-control' && (
        <DataControlPanel />
      )}
      
      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="space-y-4">
          <Card>
            <h3 className="text-lg text-[#3B3A36] mb-4">Configuración de Cuenta</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#5F6773]">Cambiar Contraseña</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChangePassword(true)}
                >
                  Cambiar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* Catalogs Tab */}
      {canManagePlants && activeTab === 'catalogs' && (
        <CatalogsPanel />
      )}

      {/* Units Tab */}
      {canManagePlants && activeTab === 'units' && (
        <UnitsPanel />
      )}

      {editingAggregates && (
        <AggregatesConfigModal
          plant={editingAggregates}
          onSaved={() => {
            refreshPlants()
              .catch((error) => {
                console.error('❌ Error recargando plantas tras guardar agregados:', error);
              })
              .then(() => loadPlantModuleCounts())
              .finally(() => {
                setEditingAggregates(null);
                handleSave();
              });
          }}
          onClose={() => setEditingAggregates(null)}
        />
      )}

      {/* Silos Config Modal */}
      {editingSilos && (
        <SilosConfigModal
          plant={editingSilos}
          onSaved={() => {
            setEditingSilos(null);
            loadPlantModuleCounts();
            handleSave();
          }}
          onClose={() => setEditingSilos(null)}
        />
      )}

      {editingAdditives && (
        <AdditivesConfigModal
          plant={editingAdditives}
          onSaved={() => {
            setEditingAdditives(null);
            loadPlantModuleCounts();
            handleSave();
          }}
          onClose={() => setEditingAdditives(null)}
        />
      )}

      {editingDiesel && (
        <DieselConfigModal
          plant={editingDiesel}
          onSaved={() => {
            setEditingDiesel(null);
            loadPlantModuleCounts();
            handleSave();
          }}
          onClose={() => setEditingDiesel(null)}
        />
      )}

      {editingProducts && (
        <ProductsConfigModal
          plant={editingProducts}
          onSaved={() => {
            setEditingProducts(null);
            loadPlantModuleCounts();
            handleSave();
          }}
          onClose={() => setEditingProducts(null)}
        />
      )}

      {editingLayout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">
            <div className="p-6 border-b border-[#E4E4E4] flex justify-between items-start gap-4 sticky top-0 bg-white">
              <div>
                <h3 className="text-xl font-bold text-[#3B3A36]">Layout de planta</h3>
                <p className="text-sm text-[#5F6773] mt-1">{editingLayout.name} • Solo imágenes JPG</p>
              </div>
              <button
                onClick={() => setEditingLayout(null)}
                className="p-2 hover:bg-[#F2F3F5] rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <span className="text-2xl text-[#5F6773]">×</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {layoutMessage && (
                <Alert
                  type={layoutMessage.type}
                  message={layoutMessage.message}
                  onClose={() => setLayoutMessage(null)}
                  autoClose={layoutMessage.type === 'success'}
                />
              )}

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center justify-center gap-2 rounded border border-[#9D9B9A] bg-[#F2F3F5] px-4 py-2 text-[#3B3A36] font-medium hover:bg-[#E4E4E4] transition-colors cursor-pointer">
                  <FileImage size={18} aria-hidden="true" />
                  <span>{layoutUploading ? 'Cargando...' : layoutPreviewUrl ? 'Cambiar JPG' : 'Cargar JPG'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,.jpg,.jpeg"
                    className="sr-only"
                    disabled={layoutUploading || layoutDeleting}
                    onChange={(event) => {
                      handleLayoutFileSelected(event.target.files?.[0] || null);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {layoutPreviewUrl && (
                  <Button
                    variant="destructive"
                    onClick={handleDeleteLayout}
                    loading={layoutDeleting}
                    disabled={layoutUploading}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                    Eliminar
                  </Button>
                )}
              </div>

              <div className="border border-[#E4E4E4] rounded-lg bg-[#F7F8FA] min-h-[280px] flex items-center justify-center overflow-hidden">
                {layoutPreviewUrl ? (
                  <img
                    src={layoutPreviewUrl}
                    alt={`Layout de ${editingLayout.name}`}
                    className="max-h-[58vh] w-full object-contain"
                  />
                ) : (
                  <div className="text-center p-8">
                    <FileImage size={46} className="mx-auto text-[#9D9B9A] mb-3" aria-hidden="true" />
                    <p className="text-[#3B3A36] font-medium">No hay layout cargado</p>
                    <p className="text-sm text-[#5F6773] mt-1">Carga un JPG para que aparezca en Inicio.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-[#E4E4E4] bg-[#F2F3F5]">
              <Button
                variant="secondary"
                onClick={() => setEditingLayout(null)}
                className="w-full"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Plant Details Modal */}
      {viewingPlantDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-[#E4E4E4] flex justify-between items-center sticky top-0 bg-white">
              <div>
                <h3 className="text-xl font-bold text-[#3B3A36]">{viewingPlantDetails.name}</h3>
                <p className="text-sm text-[#5F6773]">{viewingPlantDetails.code} • {viewingPlantDetails.location}</p>
              </div>
              <button
                onClick={() => setViewingPlantDetails(null)}
                className="p-2 hover:bg-[#F2F3F5] rounded-lg transition-colors"
              >
                <span className="text-2xl text-[#5F6773]">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Estado */}
              <div>
                <h4 className="text-sm font-semibold text-[#3B3A36] mb-2">Estado</h4>
                <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                  viewingPlantDetails.isActive
                    ? 'bg-[#2ecc71]/10 text-[#2ecc71]'
                    : 'bg-[#C94A4A]/10 text-[#C94A4A]'
                }`}>
                  {viewingPlantDetails.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              {/* Petty Cash */}
              {viewingPlantDetails.pettyCashAmount && (
                <div>
                  <h4 className="text-sm font-semibold text-[#3B3A36] mb-2">Petty Cash</h4>
                  <p className="text-[#5F6773]">
                    ${viewingPlantDetails.pettyCashAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}

              {/* Silos */}
              <div>
                <h4 className="text-sm font-semibold text-[#3B3A36] mb-3">
                  Silos ({viewingPlantDetails.silos.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {viewingPlantDetails.silos.map((silo) => (
                    <div key={silo.id} className="p-3 border border-[#E4E4E4] rounded-lg bg-[#F2F3F5]">
                      <div className="font-medium text-[#3B3A36]">{silo.name}</div>
                      <div className="text-sm text-[#5F6773] mt-1">
                        Capacidad: {silo.capacity ? silo.capacity.toLocaleString() : 'N/A'} {silo.unit || ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ubicación completa */}
              <div>
                <h4 className="text-sm font-semibold text-[#3B3A36] mb-2">Ubicación</h4>
                <p className="text-[#5F6773]">{viewingPlantDetails.location}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#E4E4E4] bg-[#F2F3F5]">
              <Button
                variant="secondary"
                onClick={() => setViewingPlantDetails(null)}
                className="w-full"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onSuccess={() => {
            setShowSaveSuccess(true);
            setTimeout(() => setShowSaveSuccess(false), 3000);
          }}
        />
      )}

      {/* Create Plant Modal */}
      {showCreatePlantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-[#E4E4E4]">
              <h3 className="text-xl font-bold text-[#3B3A36]">Agregar Planta</h3>
              <p className="text-sm text-[#5F6773] mt-1">Completa los datos para crear una nueva planta</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-[#3B3A36] mb-1">Nombre</label>
                <input
                  value={newPlantName}
                  onChange={(e) => setNewPlantName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#C5C6C7] rounded-md focus:outline-none focus:ring-2 focus:ring-[#2475C7]/30"
                  placeholder="Ej: Bayamón"
                />
              </div>
              <div>
                <label className="block text-sm text-[#3B3A36] mb-1">Código</label>
                <input
                  value={newPlantCode}
                  onChange={(e) => setNewPlantCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-[#C5C6C7] rounded-md focus:outline-none focus:ring-2 focus:ring-[#2475C7]/30"
                  placeholder="Ej: BAYAMON"
                />
              </div>
              <div>
                <label className="block text-sm text-[#3B3A36] mb-1">Ubicación</label>
                <input
                  value={newPlantLocation}
                  onChange={(e) => setNewPlantLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-[#C5C6C7] rounded-md focus:outline-none focus:ring-2 focus:ring-[#2475C7]/30"
                  placeholder="Ej: Puerto Rico"
                />
              </div>
            </div>

            <div className="p-6 border-t border-[#E4E4E4] bg-[#F2F3F5] flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowCreatePlantModal(false);
                  setNewPlantName('');
                  setNewPlantCode('');
                  setNewPlantLocation('');
                }}
              >
                Salir
              </Button>
              <Button variant="secondary" className="flex-1" onClick={handleCreatePlant}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Build Version Footer */}
      <div className="mt-6 text-center text-xs text-[#6F767E]">
        Version de build: {BUILD_VERSION}
      </div>
    </div>
  );
}
