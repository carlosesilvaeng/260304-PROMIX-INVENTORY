import React, { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/Modal';
import { Alert } from '../components/Alert';
import { useInventory } from '../contexts/InventoryContext';
import { useAuth } from '../contexts/AuthContext';
import { PromixLogo } from '../components/PromixLogo';

interface ReviewAndApproveProps {
  onComplete: () => void;
}

export function ReviewAndApprove({ onComplete }: ReviewAndApproveProps) {
  const { currentInventory, completeInventory, approveInventory } = useInventory();
  const { currentPlant, user } = useAuth();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!currentInventory) {
    return (
      <div className="p-6">
        <Alert type="warning" message="No hay inventario activo para revisar" />
      </div>
    );
  }

  const handleApprove = () => {
    if (user) {
      const roleLabel = user.role === 'super_admin' 
        ? 'Super Administrador' 
        : user.role === 'admin' 
          ? 'Administrador' 
          : 'Gerente de Planta';
      
      // Si el usuario es admin, aprueba directamente
      if (user.role === 'admin' || user.role === 'super_admin') {
        approveInventory(user.name, roleLabel);
      } else {
        // Si es gerente, solo completa
        completeInventory();
      }
    }
    setShowConfirmModal(false);
    setShowSuccess(true);
    setTimeout(() => {
      onComplete();
    }, 2000);
  };

  const incompleteSections = currentInventory.sections.filter(s => s.status !== 'complete');

  return (
    <div className="p-6 space-y-6">
      {/* Header with Logo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-[#3D3F42]">Revisión Final</h2>
          <p className="text-[#6C7178]">Revise todos los datos antes de aprobar y sincronizar</p>
        </div>
        <PromixLogo size="md" />
      </div>

      {showSuccess && (
        <Alert 
          type="success" 
          message="¡Inventario aprobado y sincronizado exitosamente!" 
          autoClose 
        />
      )}

      {incompleteSections.length > 0 && (
        <Alert 
          type="warning" 
          message={`Hay ${incompleteSections.length} sección(es) incompleta(s). Complete todas las secciones antes de aprobar.`}
        />
      )}

      {/* Summary Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <h3 className="text-sm text-[#5F6773] mb-1">Planta</h3>
          <p className="text-lg font-medium text-[#3B3A36]">{currentPlant?.name}</p>
          <p className="text-sm text-[#5F6773]">{currentPlant?.code}</p>
        </Card>
        
        <Card>
          <h3 className="text-sm text-[#5F6773] mb-1">Período</h3>
          <p className="text-lg font-medium text-[#3B3A36]">
            {currentInventory.month} {currentInventory.year}
          </p>
        </Card>
        
        <Card>
          <h3 className="text-sm text-[#5F6773] mb-1">Diligenciado por</h3>
          <p className="text-lg font-medium text-[#3B3A36]">
            {currentInventory.createdBy || 'N/A'}
          </p>
          <p className="text-sm text-[#5F6773]">{currentInventory.createdByRole}</p>
        </Card>

        <Card>
          <h3 className="text-sm text-[#5F6773] mb-1">
            {currentInventory.status === 'approved' ? 'Aprobado por' : 'Pendiente Aprobación'}
          </h3>
          {currentInventory.status === 'approved' ? (
            <>
              <p className="text-lg font-medium text-[#2ecc71]">
                {currentInventory.approvedBy}
              </p>
              <p className="text-sm text-[#5F6773]">{currentInventory.approvedByRole}</p>
            </>
          ) : (
            <p className="text-lg font-medium text-[#f59e0b]">
              Por aprobar
            </p>
          )}
        </Card>
      </div>

      {/* Sections Summary */}
      <Card>
        <h3 className="text-lg text-[#3B3A36] mb-4">Resumen por Sección</h3>
        <div className="space-y-3">
          {currentInventory.sections.map((section) => (
            <div 
              key={section.id}
              className="flex items-center justify-between p-3 bg-[#F2F3F5] rounded"
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  section.status === 'complete' ? 'bg-[#2ecc71]' :
                  section.status === 'in-progress' ? 'bg-[#2475C7]' :
                  'bg-[#9D9B9A]'
                }`} />
                <span className="text-[#3B3A36]">{section.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 bg-white rounded-full h-2">
                  <div 
                    className="bg-[#2475C7] h-2 rounded-full transition-all"
                    style={{ width: `${section.progress}%` }}
                  />
                </div>
                <span className="text-sm text-[#5F6773] w-12 text-right">
                  {section.progress}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Data Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-3xl font-bold text-[#2475C7]">
              {currentInventory.aggregates.length}
            </p>
            <p className="text-sm text-[#5F6773] mt-1">Agregados</p>
          </div>
        </Card>
        
        <Card>
          <div className="text-center">
            <p className="text-3xl font-bold text-[#2475C7]">
              {currentInventory.silos.length}
            </p>
            <p className="text-sm text-[#5F6773] mt-1">Silos</p>
          </div>
        </Card>
        
        <Card>
          <div className="text-center">
            <p className="text-3xl font-bold text-[#2475C7]">
              {currentInventory.additives.length}
            </p>
            <p className="text-sm text-[#5F6773] mt-1">Aditivos</p>
          </div>
        </Card>
        
        <Card>
          <div className="text-center">
            <p className="text-3xl font-bold text-[#2475C7]">
              {currentInventory.utilities.length}
            </p>
            <p className="text-sm text-[#5F6773] mt-1">Utilidades</p>
          </div>
        </Card>
      </div>

      {/* Photo Evidence Count */}
      <Card>
        <h3 className="text-lg text-[#3B3A36] mb-4">Evidencia Fotográfica</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-bold text-[#2475C7]">
              {currentInventory.aggregates.filter(a => a.photo).length}
            </p>
            <p className="text-sm text-[#5F6773]">Fotos de Agregados</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#2475C7]">
              {currentInventory.silos.filter(s => s.photo).length}
            </p>
            <p className="text-sm text-[#5F6773]">Fotos de Silos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#2475C7]">
              {currentInventory.additives.filter(a => a.photo).length}
            </p>
            <p className="text-sm text-[#5F6773]">Fotos de Aditivos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#2475C7]">
              {currentInventory.utilities.filter(u => u.photo).length}
            </p>
            <p className="text-sm text-[#5F6773]">Fotos de Utilidades</p>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="secondary" onClick={onComplete}>
          Volver al Dashboard
        </Button>
        <Button 
          size="lg"
          onClick={() => setShowConfirmModal(true)}
          disabled={incompleteSections.length > 0}
        >
          Aprobar y Sincronizar
        </Button>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleApprove}
        title="Confirmar Aprobación"
        message="¿Está seguro de que desea aprobar y sincronizar este inventario? Esta acción no se puede deshacer."
        confirmText="Aprobar y Sincronizar"
      />
    </div>
  );
}