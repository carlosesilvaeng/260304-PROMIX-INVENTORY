import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Alert } from '../components/Alert';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PromixLogo } from '../components/PromixLogo';
import { Eye, EyeOff } from 'lucide-react';

// ============================================================================
// BUILD VERSION - Update manually when deploying
// ============================================================================
const BUILD_VERSION = '2606242237';
// Format: YYMMDDHHMM (GMT-5 Puerto Rico Time) = 26/06/24 22:37 = Jun 24, 2026 10:37 PM

export function Login() {
  const { login } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEmergencyReset, setShowEmergencyReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      // Mostrar mensaje de error específico del backend
      const errorMessage = err.message || t('login.invalidCredentials');
      setError(errorMessage);
      console.error('Login error:', err);
      
      // Si el error es por JWT inválido, mostrar opción de reset
      if (errorMessage.includes('JWT') || errorMessage.includes('401') || errorMessage.includes('Token')) {
        setShowEmergencyReset(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyReset = () => {
    if (confirm('🚨 EMERGENCY RESET\n\nEsto limpiará TODA la sesión guardada y recargará la página.\n\n¿Continuar?')) {
      console.log('🚨 [EMERGENCY] Clearing all localStorage...');
      localStorage.clear();
      console.log('✅ [EMERGENCY] LocalStorage cleared, reloading...');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--ui-primary-2b7de9)] to-[var(--ui-primary-hover-1e5bb8)] flex items-center justify-center p-4">
      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4">
        <div className="flex items-center gap-2 bg-[var(--ui-surface)]/90 backdrop-blur rounded-lg p-1 shadow-lg">
          <button
            onClick={() => setLanguage('es')}
            className={`px-3 py-2 rounded text-sm font-medium transition-all ${
              language === 'es'
                ? 'bg-[var(--ui-primary-2b7de9)] text-white'
                : 'text-[color:var(--ui-text-muted-6c7178)] hover:text-[color:var(--ui-text-3d3f42)]'
            }`}
          >
            🇪🇸 ES
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-2 rounded text-sm font-medium transition-all ${
              language === 'en'
                ? 'bg-[var(--ui-primary-2b7de9)] text-white'
                : 'text-[color:var(--ui-text-muted-6c7178)] hover:text-[color:var(--ui-text-3d3f42)]'
            }`}
          >
            🇺🇸 EN
          </button>
        </div>
      </div>

      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="bg-[var(--ui-surface)] rounded-lg p-6 inline-block mb-4 shadow-lg">
            <div className="flex justify-center mb-3">
              <PromixLogo size="xl" />
            </div>
            <div className="text-sm text-[color:var(--ui-text-muted-6c7178)] mt-1">{t('login.subtitle')}</div>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-[var(--ui-surface)] rounded-lg shadow-xl p-8">
          <h2 className="text-2xl text-[color:var(--ui-text-3d3f42)] mb-2 text-center">{t('login.welcome')}</h2>
          <p className="text-sm text-[color:var(--ui-text-muted-6c7178)] mb-6 text-center">{t('login.description')}</p>
          
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} onClose={() => setError('')} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('login.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@promixpr.com"
              required
            />

            <div className="w-full">
              <label className="flex min-h-5 items-center text-[color:var(--ui-text-3b3a36)] mb-1.5 leading-5" htmlFor="login-password">
                {t('login.password')}
                <span className="text-[#C94A4A] ml-1">*</span>
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="
                    w-full px-4 py-2.5 pr-12
                    bg-[var(--ui-surface)]
                    border border-[var(--ui-border-9d9b9a)]
                    rounded
                    text-[color:var(--ui-text-3b3a36)]
                    placeholder:text-[color:var(--ui-text-muted-5f6773)]
                    focus:outline-none
                    focus:ring-2
                    focus:ring-[var(--ui-primary-2475c7)]
                    focus:border-transparent
                    transition-all
                  "
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded bg-[var(--ui-surface)] text-[color:var(--ui-primary-2475c7)] transition-colors hover:bg-[var(--ui-login-hover)] hover:text-[color:var(--ui-primary-hover-1a5a9f)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-primary-2475c7)] focus:ring-offset-1"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="h-6 w-6" aria-hidden="true" strokeWidth={2.4} />
                  ) : (
                    <Eye className="h-6 w-6" aria-hidden="true" strokeWidth={2.4} />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? '...' : t('login.button')}
            </Button>

            {/* Build Version */}
            <div className="text-center mt-3">
              <p className="text-xs text-[color:var(--ui-text-disabled-9ca0a6)]">
                Version de build: {BUILD_VERSION}
              </p>
            </div>
          </form>

          {/* Emergency Reset Button - Always visible but discrete */}
          <div className="text-center mt-4 pt-3 border-t border-[var(--ui-hover-e8eaed)]">
            <button
              type="button"
              onClick={handleEmergencyReset}
              className="text-xs text-[color:var(--ui-text-disabled-9ca0a6)] hover:text-[#F44336] transition-colors"
            >
              🔧 Limpiar datos y reiniciar
            </button>
          </div>
        </div>

        <p className="text-center text-white/80 mt-6 text-sm">
          © 2026 PROMIX. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
