import React from 'react';
import { Button } from './Button';

interface MigrationAlertProps {
  show: boolean;
  onClose: () => void;
}

export function MigrationAlert({ show, onClose }: MigrationAlertProps) {
  if (!show) return null;

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4">
      <div className="max-w-2xl mx-auto bg-yellow-50 border-2 border-yellow-400 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl">⚠️</div>
          <div className="flex-1">
            <h3 className="font-bold text-yellow-900 mb-2">
              Actualización de Sistema Detectada
            </h3>
            <p className="text-yellow-800 text-sm mb-3">
              Se ha detectado una actualización en los IDs de las plantas. 
              Para asegurar el correcto funcionamiento, por favor <strong>recarga la página</strong> (F5).
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleReload}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
                size="sm"
              >
                🔄 Recargar Ahora
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                size="sm"
                className="text-yellow-800"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
