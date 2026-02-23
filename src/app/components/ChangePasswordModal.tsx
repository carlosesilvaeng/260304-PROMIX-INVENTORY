import { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Alert } from './Alert';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangePasswordModal({ onClose, onSuccess }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Todos los campos son obligatorios');
      return;
    }

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (newPassword === currentPassword) {
      setError('La nueva contraseña debe ser diferente a la actual');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-02205af0/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Error al cambiar la contraseña');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error cambiando contraseña:', err);
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b border-[#E4E4E4]">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-[#3B3A36]">Cambiar Contraseña</h3>
              <p className="text-sm text-[#5F6773] mt-1">
                Actualiza tu contraseña de forma segura
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#F2F3F5] rounded-lg transition-colors"
              disabled={loading}
            >
              <span className="text-2xl text-[#5F6773]">×</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <Alert type="error" message={error} onClose={() => setError('')} />
          )}
          
          {success && (
            <Alert type="success" message="¡Contraseña actualizada exitosamente!" />
          )}

          <div>
            <label className="block text-sm font-medium text-[#3B3A36] mb-2">
              Contraseña Actual <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Ingresa tu contraseña actual"
              disabled={loading || success}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3B3A36] mb-2">
              Nueva Contraseña <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              disabled={loading || success}
              required
            />
            <p className="text-xs text-[#5F6773] mt-1">
              Usa al menos 8 caracteres, incluyendo letras y números
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3B3A36] mb-2">
              Confirmar Nueva Contraseña <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirma tu nueva contraseña"
              disabled={loading || success}
              required
            />
          </div>

          {/* Tips de Seguridad */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 text-lg">🔒</span>
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  Consejos de Seguridad
                </h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Usa una contraseña única para esta aplicación</li>
                  <li>• No compartas tu contraseña con nadie</li>
                  <li>• Cambia tu contraseña regularmente</li>
                </ul>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-[#E4E4E4] bg-[#F2F3F5] flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || success}
            className="flex-1"
          >
            {loading ? 'Actualizando...' : success ? '✓ Actualizada' : 'Actualizar Contraseña'}
          </Button>
        </div>
      </div>
    </div>
  );
}