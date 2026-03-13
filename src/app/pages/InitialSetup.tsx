import React, { useState } from 'react';
import { PromixLogo } from '../components/PromixLogo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Alert } from '../components/Alert';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// ============================================================================
// BUILD VERSION - Update manually when deploying
// ============================================================================
const BUILD_VERSION = '2603131738';
// Format: YYMMDDHHMM (GMT-5 Puerto Rico Time) = 26/02/18 20:00 = Feb 18, 2026 8:00 PM

interface InitialSetupProps {
  onSetupComplete: () => void;
}

export function InitialSetup({ onSetupComplete }: InitialSetupProps) {
  const [step, setStep] = useState<'database' | 'admin'>('database');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Admin user form
  const [adminData, setAdminData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Inicializar esquema de base de datos
  const handleInitializeDatabase = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🔧 [InitialSetup] Initializing database schema...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server/db/initialize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'No se pudo inicializar la base de datos');
      }

      console.log('✅ [InitialSetup] Database initialized successfully');
      setSuccess('Base de datos inicializada correctamente.');
      
      // Wait a moment then move to admin creation
      setTimeout(() => {
        setStep('admin');
        setSuccess(null);
      }, 1500);

    } catch (err: any) {
      console.error('❌ [InitialSetup] Database initialization error:', err);
      setError(err.message || 'No se pudo inicializar la base de datos');
    } finally {
      setLoading(false);
    }
  };

  // Crear usuario super administrador
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validar formulario
    if (!adminData.name || !adminData.email || !adminData.password) {
      setError('Completa todos los campos');
      return;
    }

    if (adminData.password !== adminData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (adminData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      console.log('👤 [InitialSetup] Creating Super Admin user...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server/auth/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            email: adminData.email,
            password: adminData.password,
            name: adminData.name,
            role: 'SUPER_ADMIN',
            isInitialSetup: true
          })
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'No se pudo crear el usuario administrador');
      }

      console.log('✅ [InitialSetup] Super Admin created successfully');
      setSuccess('Super Administrador creado correctamente. Redirigiendo al inicio de sesión...');

      // Wait a moment then complete setup
      setTimeout(() => {
        onSetupComplete();
      }, 2000);

    } catch (err: any) {
      console.error('❌ [InitialSetup] Admin creation error:', err);
      setError(err.message || 'No se pudo crear el usuario administrador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F7] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <PromixLogo size="large" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[#1A1D1F] text-center mb-2">
          Configuración Inicial
        </h1>
        <p className="text-sm text-[#6F767E] text-center mb-6">
          {step === 'database' 
            ? 'Inicializa la base de datos para comenzar'
            : 'Crea tu cuenta de Super Administrador'}
        </p>

        {/* Error Alert */}
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert variant="success" className="mb-4">
            {success}
          </Alert>
        )}

        {/* Step 1: Database Initialization */}
        {step === 'database' && (
          <div className="space-y-4">
            <div className="bg-[#F5F6F7] rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-[#1A1D1F] mb-2">
                Base de Datos
              </h3>
              <p className="text-sm text-[#6F767E] mb-3">
                Esto creará todas las tablas y el esquema necesarios en tu base de datos de Supabase.
              </p>
              <ul className="text-sm text-[#6F767E] space-y-1 list-disc list-inside">
                <li>Tablas de usuarios y autenticación</li>
                <li>Tablas de configuración de plantas</li>
                <li>Tablas de seguimiento de inventarios</li>
                <li>Configuración de módulos</li>
              </ul>
            </div>

            <Button
              onClick={handleInitializeDatabase}
              disabled={loading}
              fullWidth
              size="lg"
            >
              {loading ? 'Inicializando...' : 'Inicializar Base de Datos'}
            </Button>
          </div>
        )}

        {/* Step 2: Admin Creation */}
        {step === 'admin' && (
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="bg-[#F5F6F7] rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-[#1A1D1F] mb-2">
                Cuenta de Super Administrador
              </h3>
              <p className="text-sm text-[#6F767E]">
                Crea tu cuenta de Super Administrador para gestionar el sistema.
              </p>
            </div>

            <Input
              label="Nombre Completo"
              type="text"
              value={adminData.name}
              onChange={(e) => setAdminData({ ...adminData, name: e.target.value })}
              placeholder="Juan Perez"
              required
            />

            <Input
              label="Correo Electrónico"
              type="email"
              value={adminData.email}
              onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
              placeholder="admin@promix.com"
              required
            />

            <Input
              label="Contraseña"
              type="password"
              value={adminData.password}
              onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
              placeholder="••••••••"
              required
            />

            <Input
              label="Confirmar Contraseña"
              type="password"
              value={adminData.confirmPassword}
              onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
              placeholder="••••••••"
              required
            />

            <Button
              type="submit"
              disabled={loading}
              fullWidth
              size="lg"
            >
              {loading ? 'Creando administrador...' : 'Crear Super Administrador'}
            </Button>
          </form>
        )}

        {/* Build Version */}
        <div className="mt-6 text-center">
          <p className="text-xs text-[#9CA0A6]">
            Version de build: {BUILD_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}
