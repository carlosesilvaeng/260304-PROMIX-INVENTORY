import { Users, Shield, Building2, Activity } from 'lucide-react';
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
import { CajonesConfigModal } from '../components/CajonesConfigModal';
import { SilosConfigModal } from '../components/SilosConfigModal';
import { AdditivesConfigModal } from '../components/AdditivesConfigModal';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { getMateriales, getProcedencias } from '../utils/api';
import type { Plant, CajonConfig } from '../types';

// Build Version - Update manually when deploying
// Format: YYMMDDHHMM (GMT-5 Puerto Rico Time) = 26/02/18 20:00 = Feb 18, 2026 8:00 PM
const BUILD_VERSION = '2603050601';

export function Settings() {
  const { user, allPlants, togglePlantStatus, updatePlant, createPlant, savePlantCajones } = useAuth();
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'plants' | 'users' | 'audit' | 'modules' | 'catalogs' | 'units' | 'account'>('plants');
  const [editingCajones, setEditingCajones] = useState<{ plant: Plant } | null>(null);
  const [editingSilos, setEditingSilos] = useState<Plant | null>(null);
  const [editingAdditives, setEditingAdditives] = useState<Plant | null>(null);
  const [viewingPlantDetails, setViewingPlantDetails] = useState<Plant | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showCreatePlantModal, setShowCreatePlantModal] = useState(false);
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantCode, setNewPlantCode] = useState('');
  const [newPlantLocation, setNewPlantLocation] = useState('');

  // Catalog options for CajonesConfigModal dropdowns
  const [catalogMateriales, setCatalogMateriales] = useState<string[]>([]);
  const [catalogProcedencias, setCatalogProcedencias] = useState<string[]>([]);
  const canManageSettings = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    if (!canManageSettings) return;

    getMateriales().then(r => {
      if (r.success) setCatalogMateriales((r.data || []).map((m: any) => m.nombre));
    });
    getProcedencias().then(r => {
      if (r.success) setCatalogProcedencias((r.data || []).map((p: any) => p.nombre));
    });
  }, [canManageSettings]);

  useEffect(() => {
    if (user && !canManageSettings) {
      setActiveTab('account');
    }
  }, [user, canManageSettings]);

  const handleSave = () => {
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const handleSaveCajones = (cajones: CajonConfig[]) => {
    if (editingCajones) {
      savePlantCajones(editingCajones.plant.id, cajones)
        .then(() => handleSave())
        .catch((error) => {
          console.error('❌ Error guardando cajones:', error);
          window.alert(error?.message || 'No se pudo guardar la configuración de cajones.');
        });
    }
  };

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

      {/* Tabs */}
      <div className="border-b border-[#9D9B9A]">
        <div className="flex gap-4">
          {canManageSettings && (
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
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'users'
                    ? 'border-[#2475C7] text-[#2475C7]'
                    : 'border-transparent text-[#5F6773] hover:text-[#3B3A36]'
                }`}
              >
                Usuarios
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
          {canManageSettings && user?.role === 'super_admin' && (
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

      {!canManageSettings && (
        <Alert
          type="warning"
          message="Acceso limitado: como Gerente solo puedes administrar Mi Cuenta y cambiar tu contraseña."
        />
      )}

      {/* Plants Tab */}
      {canManageSettings && activeTab === 'plants' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg text-[#3B3A36]">Gestión de Plantas</h3>
            {(user?.role === 'super_admin' || user?.role === 'admin') && (
              <Button variant="secondary" onClick={() => setShowCreatePlantModal(true)}>
                + Agregar Planta
              </Button>
            )}
          </div>

          <Card noPadding>
            <table className="w-full">
              <thead className="bg-[#3B3A36] text-white">
                <tr>
                  <th className="px-6 py-3 text-left">Nombre</th>
                  <th className="px-6 py-3 text-left">Código</th>
                  <th className="px-6 py-3 text-center">Silos</th>
                  <th className="px-6 py-3 text-center">Cajones</th>
                  <th className="px-6 py-3 text-center">Estado</th>
                  <th className="px-6 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {allPlants.map((plant) => (
                  <tr key={plant.id} className="border-b border-[#9D9B9A]">
                    <td className="px-6 py-4 text-[#3B3A36] font-medium">{plant.name}</td>
                    <td className="px-6 py-4 text-[#5F6773]">{plant.code}</td>
                    <td className="px-6 py-4 text-center text-[#3B3A36]">
                      {plant.silos.length}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[#3B3A36]">
                        {plant.cajones?.length || 0}
                      </span>
                    </td>
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
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSilos(plant)}
                        >
                          🏗️ Silos
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCajones({ plant })}
                        >
                          📦 Cajones
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingAdditives(plant)}
                        >
                          ⚗️ Aditivos
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingPlantDetails(plant)}
                        >
                          Ver Detalles
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      {canManageSettings && activeTab === 'users' && (
        <UserManagement />
      )}

      {/* Audit Tab */}
      {canManageSettings && activeTab === 'audit' && (
        <AuditPanel />
      )}
      
      {/* Modules Tab */}
      {canManageSettings && activeTab === 'modules' && (
        <div className="space-y-4">
          <ModuleManagementPanel />
        </div>
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
      {canManageSettings && activeTab === 'catalogs' && (
        <CatalogsPanel />
      )}

      {/* Units Tab */}
      {canManageSettings && activeTab === 'units' && (
        <UnitsPanel />
      )}

      {/* Cajones Config Modal */}
      {editingCajones && (
        <CajonesConfigModal
          plantName={editingCajones.plant.name}
          cajones={editingCajones.plant.cajones || []}
          materiales={catalogMateriales}
          procedencias={catalogProcedencias}
          onSave={handleSaveCajones}
          onClose={() => setEditingCajones(null)}
        />
      )}

      {/* Silos Config Modal */}
      {editingSilos && (
        <SilosConfigModal
          plant={editingSilos}
          onSaved={() => setEditingSilos(null)}
          onClose={() => setEditingSilos(null)}
        />
      )}

      {editingAdditives && (
        <AdditivesConfigModal
          plant={editingAdditives}
          onSaved={() => {
            setEditingAdditives(null);
            handleSave();
          }}
          onClose={() => setEditingAdditives(null)}
        />
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

              {/* Cajones */}
              <div>
                <h4 className="text-sm font-semibold text-[#3B3A36] mb-3">
                  Cajones ({viewingPlantDetails.cajones?.length || 0})
                </h4>
                {viewingPlantDetails.cajones && viewingPlantDetails.cajones.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {viewingPlantDetails.cajones.map((cajon) => (
                      <div key={cajon.id} className="p-3 border border-[#E4E4E4] rounded-lg bg-[#F2F3F5]">
                        <div className="font-medium text-[#3B3A36]">{cajon.name}</div>
                        <div className="text-sm text-[#5F6773] mt-1">
                          {cajon.material}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#9D9B9A]">No hay cajones configurados</p>
                )}
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
                Cancelar
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
        Build: {BUILD_VERSION}
      </div>
    </div>
  );
}
