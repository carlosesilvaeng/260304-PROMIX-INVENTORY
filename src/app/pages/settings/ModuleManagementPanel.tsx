/**
 * ModuleManagementPanel
 * Super Admin panel to enable/disable application modules
 * Controls which sections are visible to all users
 */

import React, { useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useModules } from '../../contexts/ModulesContext';
import { useAuth } from '../../contexts/AuthContext';
import { ModuleKey } from '../../config/moduleConfig';

export function ModuleManagementPanel() {
  const { user } = useAuth();
  const { moduleSettings, toggleModule, loading, refreshModules } = useModules();
  const [updating, setUpdating] = useState<ModuleKey | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Only Super Admin can access this panel
  if (user?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <Card className="p-6 border-red-300 bg-red-50">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔒</span>
            <div>
              <h3 className="text-lg font-bold text-red-900">Acceso Denegado</h3>
              <p className="text-red-700">Solo Super Admins pueden gestionar módulos.</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const handleToggle = async (moduleKey: ModuleKey, currentlyEnabled: boolean) => {
    setUpdating(moduleKey);
    setMessage(null);

    try {
      await toggleModule(moduleKey, !currentlyEnabled, user.email);
      setMessage({
        type: 'success',
        text: `Módulo "${moduleSettings.modules[moduleKey].name}" ${!currentlyEnabled ? 'habilitado' : 'deshabilitado'} exitosamente`,
      });
      
      // Auto-hide success message
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error toggling module:', error);
      setMessage({
        type: 'error',
        text: `Error al actualizar módulo: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#2475C7] mb-4"></div>
              <p className="text-[#5F6773]">Cargando configuración de módulos...</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Get modules sorted by order
  const modules = Object.values(moduleSettings.modules).sort((a, b) => a.order - b.order);

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#3B3A36]">Gestión de Módulos</h2>
          <p className="text-[#5F6773]">
            Controla qué secciones están disponibles para todos los usuarios
          </p>
        </div>
        <Button
          onClick={refreshModules}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <span>🔄</span>
          Actualizar
        </Button>
      </div>

      {/* INFO BANNER */}
      <Card className="bg-blue-50 border-blue-300">
        <div className="p-4 flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-blue-900 mb-1">
              Rolling Out Progresivo
            </h3>
            <p className="text-sm text-blue-800">
              Habilita módulos gradualmente para controlar el despliegue a producción. 
              Los módulos deshabilitados no aparecerán en la navegación ni en las rutas.
            </p>
            <p className="text-xs text-blue-700 mt-2">
              <strong>Recomendación:</strong> Empieza con <strong>Agregados</strong>, 
              luego <strong>Silos</strong>, y así sucesivamente.
            </p>
          </div>
        </div>
      </Card>

      {/* SUCCESS/ERROR MESSAGE */}
      {message && (
        <Card className={`p-4 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-300' 
            : 'bg-red-50 border-red-300'
        }`}>
          <p className={`text-sm font-semibold ${
            message.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {message.text}
          </p>
        </Card>
      )}

      {/* MODULES LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {modules.map((module) => {
          const isEnabled = module.enabled;
          const isUpdating = updating === module.key;

          return (
            <Card 
              key={module.key}
              className={`p-5 transition-all ${
                isEnabled 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-[#D4D2CF] bg-white'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`
                  text-4xl p-3 rounded-lg
                  ${isEnabled ? 'bg-green-100' : 'bg-[#F2F3F5]'}
                `}>
                  {module.icon}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className={`text-lg font-bold ${
                        isEnabled ? 'text-green-900' : 'text-[#3B3A36]'
                      }`}>
                        {module.name}
                      </h3>
                      <p className="text-sm text-[#5F6773] mt-0.5">
                        {module.description}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div className={`
                      px-3 py-1 rounded-full text-xs font-bold
                      ${isEnabled 
                        ? 'bg-green-600 text-white' 
                        : 'bg-[#9D9B9A] text-white'
                      }
                    `}>
                      {isEnabled ? 'ACTIVO' : 'INACTIVO'}
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <Button
                    onClick={() => handleToggle(module.key, isEnabled)}
                    disabled={isUpdating}
                    size="sm"
                    className={`mt-3 ${
                      isEnabled
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isUpdating ? (
                      <>
                        <span className="inline-block animate-spin mr-2">⏳</span>
                        Actualizando...
                      </>
                    ) : isEnabled ? (
                      <>
                        <span className="mr-2">🔴</span>
                        Deshabilitar
                      </>
                    ) : (
                      <>
                        <span className="mr-2">🟢</span>
                        Habilitar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* LAST UPDATED INFO */}
      {moduleSettings.lastUpdatedBy && (
        <Card className="bg-[#F2F3F5] border-[#D4D2CF]">
          <div className="p-4 text-sm text-[#5F6773]">
            <p>
              <strong>Última actualización:</strong>{' '}
              {new Date(moduleSettings.lastUpdatedAt!).toLocaleString('es-ES', {
                dateStyle: 'full',
                timeStyle: 'short',
              })}
            </p>
            <p className="mt-1">
              <strong>Actualizado por:</strong> {moduleSettings.lastUpdatedBy}
            </p>
          </div>
        </Card>
      )}

      {/* ROLLOUT RECOMMENDATIONS */}
      <Card className="bg-yellow-50 border-yellow-300">
        <div className="p-4">
          <h3 className="text-sm font-bold text-yellow-900 mb-2 flex items-center gap-2">
            <span>💡</span>
            Recomendaciones de Rolling Out
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-800">
            <li><strong>Fase 1:</strong> Habilitar solo <strong>Agregados</strong> → Probar con usuarios</li>
            <li><strong>Fase 2:</strong> Agregar <strong>Silos</strong> y <strong>Aditivos</strong> → Validar</li>
            <li><strong>Fase 3:</strong> Agregar <strong>Diesel</strong> y <strong>Aceites y Productos</strong></li>
            <li><strong>Fase 4:</strong> Agregar <strong>Utilities</strong> y <strong>Petty Cash</strong></li>
            <li><strong>Fase 5:</strong> Habilitar <strong>Revisar y Aprobar</strong> para flujo completo</li>
          </ol>
          <p className="text-xs text-yellow-700 mt-3">
            ⚠️ Los cambios toman efecto inmediatamente para todos los usuarios. 
            Los módulos deshabilitados no aparecerán en la navegación.
          </p>
        </div>
      </Card>
    </div>
  );
}
