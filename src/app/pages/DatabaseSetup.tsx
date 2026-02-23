import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, Activity, Database, Server, Wifi } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { PromixLogo } from '../components/PromixLogo';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { initializeDatabase, seedPlantConfigurations, clearAllConfigurations, reloadSchemaCache } from '../utils/api';

// Build Version - Format: YYMMDDHHMI (GMT-5 Puerto Rico Time)
// 26/02/18 20:00 = February 18, 2026 at 8:00 PM
const BUILD_VERSION = '2602182000';

interface SetupState {
  loading: boolean;
  message: string;
  messageType: 'success' | 'error' | 'info';
}

export function DatabaseSetup() {
  const [setupState, setSetupState] = useState<SetupState>({
    loading: false,
    message: '',
    messageType: 'info'
  });
  const [showConnectionTest, setShowConnectionTest] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const runConnectionTests = async () => {
    setTesting(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Test 1: Health Check
    try {
      const healthRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-02205af0/health`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      const healthData = await healthRes.json();
      results.tests.push({
        name: 'Health Check',
        status: healthRes.ok ? 'PASS' : 'FAIL',
        response: healthData
      });
    } catch (error) {
      results.tests.push({
        name: 'Health Check',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 2: Database Check
    try {
      const dbRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-02205af0/db/initialize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      const dbData = await dbRes.json();
      results.tests.push({
        name: 'Database Schema Check',
        status: dbData.success ? 'PASS' : 'FAIL',
        response: dbData
      });
    } catch (error) {
      results.tests.push({
        name: 'Database Schema Check',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 3: Environment Variables
    results.tests.push({
      name: 'Environment Variables',
      status: 'INFO',
      data: {
        projectId: projectId,
        hasAnonKey: !!publicAnonKey,
        edgeFunctionUrl: `https://${projectId}.supabase.co/functions/v1/make-server-02205af0`
      }
    });

    setTestResults(results);
    setTesting(false);
    setShowConnectionTest(true);
  };

  const handleInitialize = async () => {
    setSetupState({ loading: true, message: 'Inicializando esquema de base de datos...', messageType: 'info' });
    
    const result = await initializeDatabase();
    
    if (result.success) {
      setSetupState({
        loading: false,
        message: '✅ Esquema de base de datos inicializado correctamente. Ahora puedes ejecutar el seed de datos.',
        messageType: 'success'
      });
    } else {
      setSetupState({
        loading: false,
        message: `❌ Error al inicializar: ${result.error}`,
        messageType: 'error'
      });
    }
  };

  const handleSeed = async () => {
    setSetupState({ loading: true, message: 'Cargando configuraciones de las 6 plantas PROMIX...', messageType: 'info' });
    
    const result = await seedPlantConfigurations();
    
    if (result.success) {
      setSetupState({
        loading: false,
        message: '✅ Configuraciones de plantas cargadas exitosamente. El sistema está listo para usar.',
        messageType: 'success'
      });
    } else {
      setSetupState({
        loading: false,
        message: `❌ Error al cargar datos: ${result.error}`,
        messageType: 'error'
      });
    }
  };

  const handleClear = async () => {
    if (!window.confirm('⚠️ ADVERTENCIA: Esto eliminará TODAS las configuraciones de plantas. ¿Estás seguro?')) {
      return;
    }
    
    setSetupState({ loading: true, message: 'Limpiando configuraciones...', messageType: 'info' });
    
    const result = await clearAllConfigurations();
    
    if (result.success) {
      setSetupState({
        loading: false,
        message: '✅ Configuraciones eliminadas correctamente.',
        messageType: 'success'
      });
    } else {
      setSetupState({
        loading: false,
        message: `❌ Error al limpiar datos: ${result.error}`,
        messageType: 'error'
      });
    }
  };

  const handleReloadCache = async () => {
    setSetupState({ loading: true, message: '🔄 Recargando cache del schema de PostgREST...', messageType: 'info' });
    
    const result = await reloadSchemaCache();
    
    if (result.success) {
      setSetupState({
        loading: false,
        message: '✅ Cache recargado exitosamente. Espera 5-10 segundos y vuelve a intentar "Cargar Configuraciones".',
        messageType: 'success'
      });
    } else {
      // If function doesn't exist, show instructions
      if (result.error?.includes('Schema cache reload function not found')) {
        setSetupState({
          loading: false,
          message: `❌ ${result.error}\n\nEjecuta esto en Supabase SQL Editor:\nNOTIFY pgrst, 'reload schema';`,
          messageType: 'error'
        });
      } else {
        setSetupState({
          loading: false,
          message: `❌ Error al recargar cache: ${result.error}`,
          messageType: 'error'
        });
      }
    }
  };

  const handleFullSetup = async () => {
    setSetupState({ loading: true, message: 'Verificando tablas de base de datos...', messageType: 'info' });
    
    // Add timeout to prevent infinite loading
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT: La operación tardó más de 30 segundos. Probablemente las tablas no existen en Supabase.')), 30000)
    );
    
    try {
      // Step 1: Initialize (verify tables exist) with timeout
      const initResult = await Promise.race([initializeDatabase(), timeoutPromise]) as any;
      
      if (!initResult.success) {
        // Format error message for better display
        const errorMsg = initResult.error || 'Error desconocido';
        const formattedError = errorMsg.replace(/\\\\n/g, '\n'); // Convert \\n to actual line breaks
        
        setSetupState({
          loading: false,
          message: formattedError,
          messageType: 'error'
        });
        return;
      }
      
      // Step 2: Seed
      setSetupState({ loading: true, message: 'Cargando configuraciones de las 6 plantas PROMIX...', messageType: 'info' });
      const seedResult = await Promise.race([seedPlantConfigurations(), timeoutPromise]) as any;
      
      if (seedResult.success) {
        setSetupState({
          loading: false,
          message: '✅ Setup completo exitoso! Las 6 plantas PROMIX están configuradas. El sistema está listo para usar.',
          messageType: 'success'
        });
      } else {
        // Format seed error message
        const errorMsg = seedResult.error || 'Error desconocido al cargar configuraciones';
        const formattedError = errorMsg.replace(/\\\\n/g, '\n');
        
        setSetupState({
          loading: false,
          message: formattedError,
          messageType: 'error'
        });
      }
    } catch (error) {
      setSetupState({
        loading: false,
        message: error instanceof Error ? error.message : 'Error desconocido al procesar la solicitud',
        messageType: 'error'
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#1A1D1F] mb-2">
            Configuración de Base de Datos
          </h1>
          <p className="text-[#6F767E]">
            Inicializa y configura el sistema de inventarios PROMIX
          </p>
        </div>

        {setupState.message && (
          <div className="mb-6">
            <Alert 
              type={setupState.messageType}
              message={setupState.message}
            />
          </div>
        )}

        <div className="grid gap-6">
          {/* IMPORTANT: SQL Instructions FIRST */}
          <Card className="p-6 bg-amber-50 border-amber-300 border-2">
            <h2 className="text-xl font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              PASO 1 (OBLIGATORIO): Crear Tablas en Supabase Dashboard
            </h2>
            
            <div className="space-y-4 text-sm text-amber-900">
              <p className="font-semibold text-base">
                Antes de usar esta pantalla, DEBES ejecutar el script SQL manualmente:
              </p>
              
              <ol className="list-decimal list-inside space-y-3 ml-2 bg-white p-4 rounded border border-amber-300">
                <li className="font-medium">
                  Ve a tu proyecto en{' '}
                  <a 
                    href="https://supabase.com/dashboard" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline font-bold hover:text-amber-700 text-blue-700"
                  >
                    Supabase Dashboard →
                  </a>
                </li>
                <li className="font-medium">
                  Haz clic en <strong className="bg-amber-100 px-2 py-0.5 rounded">SQL Editor</strong> en el menú lateral
                </li>
                <li className="font-medium">
                  Haz clic en <strong className="bg-amber-100 px-2 py-0.5 rounded">New Query</strong>
                </li>
                <li className="font-medium">
                  Abre el archivo <code className="bg-gray-800 text-green-400 px-2 py-1 rounded font-mono text-xs">/supabase/schema.sql</code> en tu editor de código
                </li>
                <li className="font-medium">
                  Copia TODO el contenido del archivo (son ~450 líneas)
                </li>
                <li className="font-medium">
                  Pega el contenido en el SQL Editor de Supabase
                </li>
                <li className="font-medium">
                  Haz clic en <strong className="bg-green-600 text-white px-2 py-0.5 rounded">Run</strong> (o presiona Ctrl+Enter)
                </li>
                <li className="font-medium">
                  Espera a que aparezca <span className="text-green-600 font-bold">"Success"</span>
                </li>
                <li className="font-medium">
                  Vuelve aquí y haz clic en <strong className="bg-blue-600 text-white px-2 py-0.5 rounded">Verificar & Cargar Datos</strong> abajo
                </li>
              </ol>
              
              <div className="mt-4 p-3 bg-amber-100 border border-amber-400 rounded">
                <p className="font-semibold">
                  ℹ️ ¿Por qué debo hacer esto manualmente?
                </p>
                <p className="mt-1 text-xs">
                  Figma Make no puede ejecutar comandos DDL (CREATE TABLE) directamente en Supabase.
                  Debes crear las 17 tablas ejecutando el script SQL en el Dashboard de Supabase.
                </p>
              </div>
            </div>
          </Card>

          {/* Quick Setup Card - Renamed */}
          <Card className="p-6 border-2 border-[#2B7DE9]">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-[#1A1D1F] mb-2 flex items-center gap-2">
                  <span className="text-2xl">🚀</span>
                  PASO 2: Verificar Tablas y Cargar Datos
                </h2>
                <p className="text-[#6F767E] mb-4">
                  Después de ejecutar el script SQL en Supabase Dashboard (Paso 1), 
                  haz clic aquí para verificar que las tablas existan y cargar las 
                  configuraciones de las 6 plantas PROMIX.
                </p>
                <Button
                  onClick={handleFullSetup}
                  disabled={setupState.loading}
                  className="bg-[#2B7DE9] hover:bg-[#1E5DB8] text-white font-semibold"
                >
                  {setupState.loading ? 'Procesando...' : '✓ Verificar & Cargar Datos'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Troubleshooting Card - NEW */}
          <Card className="p-6 bg-red-50 border-red-300 border-2">
            <h2 className="text-xl font-semibold text-red-900 mb-3 flex items-center gap-2">
              <span className="text-2xl">🔧</span>
              SOLUCIÓN DE ERRORES: Columnas Faltantes
            </h2>
            
            <div className="space-y-4 text-sm text-red-900">
              <p className="font-semibold text-base">
                ¿Ves errores como "Could not find the 'box_height_ft' column" o "Could not find the 'location_area' column"?
              </p>
              
              <p className="bg-white p-3 rounded border border-red-300">
                <strong>Causa:</strong> Ejecutaste una versión antigua del schema.sql que no incluía todas las columnas necesarias.
              </p>

              <div className="bg-white p-4 rounded border border-red-300">
                <p className="font-semibold mb-2">📋 SOLUCIÓN (Elige una opción):</p>
                
                <div className="ml-4 space-y-3">
                  <div>
                    <p className="font-semibold text-green-700">Opción A: Ejecutar script de migración (Recomendado) ⚡</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2 mt-1 text-xs">
                      <li>Ve a Supabase Dashboard → SQL Editor</li>
                      <li>Abre el archivo <code className="bg-gray-800 text-green-400 px-2 py-0.5 rounded font-mono">/supabase/migration_add_missing_columns.sql</code></li>
                      <li>Copia y pega el contenido en SQL Editor</li>
                      <li>Haz clic en <strong>Run</strong></li>
                      <li>Vuelve aquí y ejecuta "Verificar & Cargar Datos"</li>
                    </ol>
                  </div>

                  <div className="pt-2 border-t border-red-200">
                    <p className="font-semibold text-blue-700">Opción B: Re-ejecutar schema.sql completo</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2 mt-1 text-xs">
                      <li>Ve a Supabase Dashboard → SQL Editor</li>
                      <li>Abre el archivo <code className="bg-gray-800 text-green-400 px-2 py-0.5 rounded font-mono">/supabase/schema.sql</code></li>
                      <li>Copia TODO el contenido (ahora es idempotente)</li>
                      <li>Pega en SQL Editor y haz clic en <strong>Run</strong></li>
                      <li>Vuelve aquí y ejecuta "Verificar & Cargar Datos"</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Manual Steps Card */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-[#1A1D1F] mb-4">
              🔧 Configuración Manual (Paso a Paso)
            </h2>
            
            <div className="space-y-6">
              {/* Step 1: Initialize */}
              <div className="border-l-4 border-[#2B7DE9] pl-4">
                <h3 className="font-semibold text-[#1A1D1F] mb-2">
                  Paso 1: Inicializar Esquema
                </h3>
                <p className="text-sm text-[#6F767E] mb-3">
                  Crea todas las tablas necesarias en la base de datos (configuración por planta, 
                  tablas mensuales, curvas de calibración, etc.)
                </p>
                <Button
                  onClick={handleInitialize}
                  disabled={setupState.loading}
                  variant="outline"
                >
                  Inicializar Base de Datos
                </Button>
              </div>

              {/* Step 2: Seed */}
              <div className="border-l-4 border-[#22C55E] pl-4">
                <h3 className="font-semibold text-[#1A1D1F] mb-2">
                  Paso 2: Cargar Configuraciones
                </h3>
                <p className="text-sm text-[#6F767E] mb-3">
                  Carga las configuraciones preestablecidas de las 6 plantas PROMIX:
                  <br />
                  • Carolina, Ceiba, Guaynabo, Gurabo, Vega Baja, Humacao
                  <br />
                  • Silos, agregados, aditivos, diesel, productos, medidores, petty cash
                </p>
                <Button
                  onClick={handleSeed}
                  disabled={setupState.loading}
                  variant="outline"
                >
                  Cargar Configuraciones
                </Button>
              </div>
            </div>
          </Card>

          {/* Danger Zone Card */}
          <Card className="p-6 border-red-200 bg-red-50">
            <h2 className="text-xl font-semibold text-red-900 mb-4">
              ⚠️ Zona de Peligro
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-red-900 mb-2">
                  Limpiar Todas las Configuraciones
                </h3>
                <p className="text-sm text-red-700 mb-3">
                  Esto eliminará TODAS las configuraciones de plantas, pero NO eliminará 
                  los inventarios mensuales ya creados. Usa con precaución.
                </p>
                <Button
                  onClick={handleClear}
                  disabled={setupState.loading}
                  variant="destructive"
                >
                  Limpiar Configuraciones
                </Button>
              </div>
            </div>
          </Card>

          {/* Information Card */}
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">
              ℹ️ Información del Sistema
            </h2>
            
            <div className="space-y-2 text-sm text-blue-800">
              <p>
                <strong>Tablas de Configuración:</strong> Definen qué ítems, equipos y medidores 
                tiene cada planta (silos, agregados, tanques, etc.)
              </p>
              <p>
                <strong>Tablas Mensuales:</strong> Almacenan las lecturas y datos del inventario 
                de cada mes (estado: EN_PROGRESO → ENVIADO → APROBADO)
              </p>
              <p>
                <strong>Curvas de Calibración:</strong> Convierten lecturas de tanques 
                (ej: pulgadas → galones)
              </p>
              <p>
                <strong>Plantas Configuradas:</strong> CAROLINA, CEIBA, GUAYNABO, GURABO, 
                VEGA BAJA, HUMACAO
              </p>
            </div>
          </Card>
          
          {/* SQL Schema Instructions Card */}
          <Card className="p-6 bg-amber-50 border-amber-200">
            <h2 className="text-lg font-semibold text-amber-900 mb-3">
              📄 Si la inicialización falla: Crear tablas manualmente
            </h2>
            
            <div className="space-y-3 text-sm text-amber-800">
              <p>
                Si el botón "Inicializar Base de Datos" falla, sigue estos pasos:
              </p>
              
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>
                  Ve a tu proyecto en{' '}
                  <a 
                    href="https://supabase.com/dashboard" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline font-semibold hover:text-amber-900"
                  >
                    Supabase Dashboard
                  </a>
                </li>
                <li>Haz clic en <strong>"SQL Editor"</strong> en el menú lateral</li>
                <li>Crea una nueva query</li>
                <li>
                  Copia y pega el contenido del archivo{' '}
                  <code className="bg-amber-100 px-1 py-0.5 rounded">/supabase/schema.sql</code>
                </li>
                <li>Haz clic en <strong>"Run"</strong> para ejecutar el SQL</li>
                <li>
                  Una vez completado, vuelve aquí y haz clic en{' '}
                  <strong>"Cargar Configuraciones"</strong>
                </li>
              </ol>
              
              <p className="mt-3 pt-3 border-t border-amber-300">
                <strong>Nota:</strong> El archivo schema.sql contiene la definición completa 
                de todas las 17 tablas necesarias (8 tablas de configuración + 8 tablas mensuales + 
                tabla de curvas de calibración).
              </p>
            </div>
          </Card>

          {/* Connection Test Card */}
          <Card className="p-6 bg-gray-50 border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              🔗 Pruebas de Conexión
            </h2>
            
            <div className="space-y-3 text-sm text-gray-800">
              <p>
                Ejecuta pruebas para verificar la conexión y el estado del servidor:
              </p>
              
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>
                  Haz clic en <strong>"Ejecutar Pruebas"</strong> para verificar la salud del servidor, 
                  el esquema de la base de datos y las variables de entorno.
                </li>
              </ol>
              
              <Button
                onClick={runConnectionTests}
                disabled={testing}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold"
              >
                {testing ? 'Procesando...' : 'Ejecutar Pruebas'}
              </Button>

              {showConnectionTest && (
                <div className="mt-4 p-3 bg-gray-100 border border-gray-300 rounded">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Resultados de Pruebas
                  </h3>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      <strong>Fecha:</strong> {testResults.timestamp}
                    </p>
                    
                    {testResults.tests.map((test: any, index: number) => (
                      <div key={index} className="space-y-1">
                        <p className="text-sm font-semibold">
                          {test.name}: <span className={`text-${test.status.toLowerCase()}`}>{test.status}</span>
                        </p>
                        
                        {test.status === 'FAIL' && (
                          <p className="text-sm text-red-700">
                            <strong>Error:</strong> {test.error}
                          </p>
                        )}
                        
                        {test.status === 'PASS' && (
                          <p className="text-sm text-green-700">
                            <strong>Respuesta:</strong> {JSON.stringify(test.response, null, 2)}
                          </p>
                        )}
                        
                        {test.status === 'INFO' && (
                          <p className="text-sm text-blue-700">
                            <strong>Información:</strong> {JSON.stringify(test.data, null, 2)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
        
        {/* Build Version Footer */}
        <div className="mt-6 text-center text-xs text-[#6F767E]">
          Build: {BUILD_VERSION}
        </div>
      </div>
    </div>
  );
}