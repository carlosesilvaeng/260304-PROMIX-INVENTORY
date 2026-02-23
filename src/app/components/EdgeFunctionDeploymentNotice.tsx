import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

export function EdgeFunctionDeploymentNotice() {
  const [dismissed, setDismissed] = React.useState(() => {
    return localStorage.getItem('edgeFunctionDeploymentNoticeDismissed') === 'true';
  });

  const handleDismiss = () => {
    localStorage.setItem('edgeFunctionDeploymentNoticeDismissed', 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md bg-amber-50 border-2 border-amber-400 rounded-lg shadow-xl p-4 animate-in slide-in-from-right">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-amber-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-bold text-amber-900">
              ⚠️ Acción Requerida
            </h3>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-amber-600 hover:text-amber-800 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <p className="text-xs text-amber-900 mb-2 font-medium">
            Debes redesplegar la Edge Function para aplicar los cambios de autenticación
          </p>
          
          <div className="bg-amber-100 rounded p-2 mb-2">
            <p className="text-xs text-amber-800 font-mono mb-1">
              Ejecuta en tu terminal:
            </p>
            <pre className="bg-amber-900 text-amber-50 text-xs p-2 rounded overflow-x-auto font-mono">
supabase functions deploy make-server-02205af0
            </pre>
          </div>
          
          <p className="text-xs text-amber-700">
            O desde el Dashboard: <strong>Edge Functions → make-server-02205af0 → Redeploy</strong>
          </p>
          
          <div className="mt-2 pt-2 border-t border-amber-300">
            <p className="text-xs text-amber-600 italic">
              Cambio aplicado: <code className="bg-amber-100 px-1 rounded">verify_jwt = false</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}