import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Alert } from '../components/Alert';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PromixLogo } from '../components/PromixLogo';

// ============================================================================
// BUILD VERSION - Update manually when deploying
// ============================================================================
const BUILD_VERSION = '2603131812';
// Format: YYMMDDHHMM (GMT-5 Puerto Rico Time) = 26/02/18 20:00 = Feb 18, 2026 8:00 PM

export function Login() {
  const { login } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen bg-gradient-to-br from-[#2B7DE9] to-[#1E5BB8] flex items-center justify-center p-4">
      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur rounded-lg p-1 shadow-lg">
          <button
            onClick={() => setLanguage('es')}
            className={`px-3 py-2 rounded text-sm font-medium transition-all ${
              language === 'es'
                ? 'bg-[#2B7DE9] text-white'
                : 'text-[#6C7178] hover:text-[#3D3F42]'
            }`}
          >
            🇪🇸 ES
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-2 rounded text-sm font-medium transition-all ${
              language === 'en'
                ? 'bg-[#2B7DE9] text-white'
                : 'text-[#6C7178] hover:text-[#3D3F42]'
            }`}
          >
            🇺🇸 EN
          </button>
        </div>
      </div>

      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="bg-white rounded-lg p-6 inline-block mb-4 shadow-lg">
            <div className="flex justify-center mb-3">
              <PromixLogo size="xl" />
            </div>
            <div className="text-sm text-[#6C7178] mt-1">{t('login.subtitle')}</div>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl text-[#3D3F42] mb-2 text-center">{t('login.welcome')}</h2>
          <p className="text-sm text-[#6C7178] mb-6 text-center">{t('login.description')}</p>
          
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

            <Input
              label={t('login.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

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
              <p className="text-xs text-[#9CA0A6]">
                Version de build: {BUILD_VERSION}
              </p>
            </div>
          </form>

          {/* Emergency Reset Button - Always visible but discrete */}
          <div className="text-center mt-4 pt-3 border-t border-[#E8EAED]">
            <button
              type="button"
              onClick={handleEmergencyReset}
              className="text-xs text-[#9CA0A6] hover:text-[#F44336] transition-colors"
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
