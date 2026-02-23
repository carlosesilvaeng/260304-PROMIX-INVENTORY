import React, { useState, useEffect } from 'react';
import { Check, X, AlertCircle, Activity } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// Build Version - Format: YYMMDDHHMI (GMT-5 Puerto Rico Time)
// 26/02/18 20:00 = February 18, 2026 at 8:00 PM
const BUILD_VERSION = '2602182000';

export function ConnectionTest() {
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [hasOldToken, setHasOldToken] = useState(false);

  // Detectar si hay un token viejo al cargar
  useEffect(() => {
    const storedToken = localStorage.getItem('promix_access_token');
    if (storedToken) {
      // Verificar si el token está expirado o es inválido
      try {
        const parts = storedToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const isExpired = payload.exp ? Date.now() / 1000 > payload.exp : false;
          setHasOldToken(isExpired);
        }
      } catch (e) {
        setHasOldToken(true);
      }
    }
  }, []);

  const runTests = async () => {
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
        anonKeyPreview: publicAnonKey.substring(0, 50) + '...',
        anonKeyLength: publicAnonKey.length,
        edgeFunctionUrl: `https://${projectId}.supabase.co/functions/v1/make-server-02205af0`
      }
    });

    // Test 4: JWT Token Validation (if logged in)
    const storedToken = localStorage.getItem('promix_access_token');
    if (storedToken) {
      try {
        // Intentar verificar el token con el endpoint correcto
        const validateRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-02205af0/auth/verify`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${storedToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
          }
        );
        
        let validateData;
        try {
          validateData = await validateRes.json();
        } catch (e) {
          validateData = { error: 'Could not parse JSON response' };
        }
        
        results.tests.push({
          name: 'JWT Token Validation',
          status: validateRes.ok && validateData.success ? 'PASS' : 'FAIL',
          httpStatus: validateRes.status,
          response: validateData,
          tokenInfo: {
            tokenLength: storedToken.length,
            tokenPrefix: storedToken.substring(0, 50) + '...',
            // Decodificar el JWT para ver su contenido (solo la parte payload)
            decodedPayload: (() => {
              try {
                const parts = storedToken.split('.');
                if (parts.length === 3) {
                  const payload = JSON.parse(atob(parts[1]));
                  return {
                    iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : 'N/A',
                    exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'N/A',
                    sub: payload.sub?.substring(0, 10) + '...' || 'N/A',
                    isExpired: payload.exp ? Date.now() / 1000 > payload.exp : false
                  };
                }
                return 'Invalid JWT format';
              } catch (e) {
                return 'Could not decode JWT';
              }
            })()
          }
        });
      } catch (error) {
        results.tests.push({
          name: 'JWT Token Validation',
          status: 'FAIL',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      results.tests.push({
        name: 'JWT Token Validation',
        status: 'SKIP',
        message: 'No hay usuario logueado - login primero para probar'
      });
    }

    // Test 5: Backend Environment Check
    try {
      console.log('🧪 Test #5: Backend Build & Environment Check');
      console.log('   Endpoint:', `https://${projectId}.supabase.co/functions/v1/make-server-02205af0/debug/env`);
      console.log('   Method: GET');
      console.log('   Frontend ANON Key:', publicAnonKey.substring(0, 50) + '...');
      console.log('   Frontend ANON Key Length:', publicAnonKey.length);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-02205af0/debug/env`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Test #5 Failed:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Test #5 Response:', data);
      
      // Comparar las claves ANON del frontend y backend
      const frontendKeyPrefix = publicAnonKey.substring(0, 50);
      const backendKeyPrefix = data.environment?.anonKeyPrefix?.substring(0, 50) || '';
      const frontendKeyLength = publicAnonKey.length;
      const backendKeyLength = data.environment?.anonKeyLength || 0;
      
      const lengthsMatch = frontendKeyLength === backendKeyLength;
      const prefixesMatch = frontendKeyPrefix === backendKeyPrefix;
      
      console.log('📊 ANON Key Comparison:');
      console.log('   Frontend Length:', frontendKeyLength);
      console.log('   Backend Length:', backendKeyLength);
      console.log('   Lengths Match:', lengthsMatch ? '✅ YES' : '❌ NO (THIS IS THE PROBLEM!)');
      console.log('   Frontend Prefix:', frontendKeyPrefix + '...');
      console.log('   Backend Prefix:', backendKeyPrefix + '...');
      console.log('   Prefixes Match:', prefixesMatch ? '✅ YES' : '❌ NO');
      
      // Si no coinciden, mostrar advertencia crítica
      if (!lengthsMatch || !prefixesMatch) {
        console.error('🚨 CRITICAL: ANON Key mismatch detected!');
        console.error('   This will cause all JWT validations to fail with "Invalid JWT"');
        console.error('   Action required: Update CLIENT_ANON_KEY in Supabase Edge Functions environment');
        console.error('   Correct value (208 chars):', publicAnonKey);
      }

      results.tests.push({
        name: 'Backend Build & Environment',
        status: (lengthsMatch && prefixesMatch) ? 'PASS' : 'FAIL',
        httpStatus: response.status,
        response: data,
        keyComparison: {
          frontendProjectId: projectId,
          frontendAnonKeyLength: publicAnonKey.length,
          frontendAnonKeyPrefix: publicAnonKey.substring(0, 50) + '...',
          frontendAnonKeyFull: publicAnonKey, // FULL KEY for debugging
          backendAnonKeyLength: data.environment?.anonKeyLength || 'N/A',
          backendAnonKeyPrefix: data.environment?.anonKeyPrefix || 'N/A',
          keysMatch: publicAnonKey.substring(0, 50) === data.environment?.anonKeyPrefix?.substring(0, 50),
          lengthMatch: publicAnonKey.length === data.environment?.anonKeyLength,
          hasJwtSecret: data.environment?.hasJwtSecret || false,
          jwtSecretLength: data.environment?.jwtSecretLength || 0
        },
        error: (!lengthsMatch || !prefixesMatch) 
          ? `⚠️ KEY MISMATCH: Backend CLIENT_ANON_KEY is NOT configured correctly!\n\nBackend: ${backendKeyLength} chars, Frontend: ${frontendKeyLength} chars\n\nYou MUST update CLIENT_ANON_KEY in Supabase Dashboard → Edge Functions → Secrets\nCorrect value: ${publicAnonKey}`
          : undefined,
        details: `Build: ${data.buildVersion}\n\n` +
          `Backend ANON Key:\n` +
          `  Length: ${backendKeyLength}\n` +
          `  Prefix: ${backendKeyPrefix}...\n\n` +
          `Frontend ANON Key:\n` +
          `  Length: ${frontendKeyLength}\n` +
          `  Prefix: ${frontendKeyPrefix}...\n\n` +
          `Comparison:\n` +
          `  ✅ Lengths Match: ${lengthsMatch ? 'YES' : 'NO (THIS IS THE PROBLEM!)'}\n` +
          `  ✅ Prefixes Match: ${prefixesMatch ? 'YES' : 'NO'}\n\n` +
          `${!lengthsMatch || !prefixesMatch ? '🚨 ACTION REQUIRED:\n1. Go to Supabase Dashboard\n2. Navigate to Edge Functions → Secrets\n3. Update CLIENT_ANON_KEY with the correct 208-char value\n4. Wait 1-2 minutes\n5. Re-run this test' : '✅ Keys match! JWT validation should work correctly.'}`
      });
    } catch (error: any) {
      console.error('❌ Test #5 Error:', error);
      results.tests.push({
        name: 'Backend Build & Environment',
        status: 'FAIL',
        error: error.message 
      });
    }

    // Test 6: Compare Frontend vs Backend Keys
    results.tests.push({
      name: 'Key Comparison (Frontend vs Backend)',
      status: 'INFO',
      data: {
        frontendProjectId: projectId,
        frontendAnonKeyPrefix: publicAnonKey.substring(0, 50) + '...',
        frontendAnonKeyLength: publicAnonKey.length,
        note: 'Check Test 4 debugInfo.backendAnonKeyPrefix to compare'
      }
    });

    setTestResults(results);
    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔧</span>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Connection Test</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Diagnóstico completo de conectividad backend/frontend
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // Limpiar TODAS las claves de sesión
                  localStorage.removeItem('promix_access_token');
                  localStorage.removeItem('promix_auth_token');
                  localStorage.removeItem('promix_user');
                  localStorage.removeItem('promix_plant');
                  localStorage.removeItem('promix_current_inventory');
                  console.log('✅ Session cleared - redirecting to login...');
                  // Pequeño delay para asegurar que se limpió
                  setTimeout(() => {
                    window.location.href = '/login';
                  }, 100);
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
              >
                <span>🔄</span>
                Clear Session & Re-login
              </button>
              <button
                onClick={() => window.location.href = '/settings'}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                ← Volver a Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#1A1D1F] mb-2">
            🔍 Connection Test - Production Readiness
          </h1>
          <p className="text-[#6F767E]">
            Verifica que el Edge Function esté desplegado y funcionando correctamente
          </p>
        </div>

        {/* Warning Banner for Old/Expired Token */}
        {hasOldToken && (
          <Card className="p-6 mb-6 bg-red-50 border-red-200 border-2">
            <div className="flex items-start gap-4">
              <div className="text-4xl">⚠️</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-red-900 mb-2">
                  Token Expirado o Inválido Detectado
                </h2>
                <p className="text-red-800 mb-4">
                  Tu sesión actual tiene un token JWT expirado o inválido. Esto causará errores "Invalid JWT" 
                  en todas las llamadas al backend. Necesitas limpiar la sesión y hacer login nuevamente.
                </p>
                <button
                  onClick={() => {
                    // Limpiar TODAS las claves de sesión
                    localStorage.removeItem('promix_access_token');
                    localStorage.removeItem('promix_auth_token');
                    localStorage.removeItem('promix_user');
                    localStorage.removeItem('promix_plant');
                    localStorage.removeItem('promix_current_inventory');
                    console.log('✅ Session cleared - redirecting to login...');
                    // Pequeño delay para asegurar que se limpió
                    setTimeout(() => {
                      window.location.href = '/login';
                    }, 100);
                  }}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 font-bold"
                >
                  <span>🔄</span>
                  LIMPIAR SESIÓN Y RE-LOGIN AHORA
                </button>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Ejecutar Pruebas de Conexión</h2>
          <p className="text-sm text-[#6F767E] mb-4">
            Esto verificará:
          </p>
          <ul className="list-disc list-inside text-sm text-[#6F767E] mb-6 space-y-1">
            <li>Edge Function está desplegado y responde</li>
            <li>Tablas de base de datos existen</li>
            <li>Variables de entorno configuradas</li>
          </ul>
          <Button
            onClick={runTests}
            disabled={testing}
            className="bg-[#2B7DE9] hover:bg-[#1E5DB8] text-white"
          >
            {testing ? 'Probando...' : 'Ejecutar Pruebas'}
          </Button>
        </Card>

        {testResults && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Resultados</h2>
            <div className="text-xs text-[#6F767E] mb-4">
              Ejecutado: {new Date(testResults.timestamp).toLocaleString()}
            </div>

            <div className="space-y-4">
              {testResults.tests.map((test: any, index: number) => (
                <div
                  key={index}
                  className={`p-4 rounded border-l-4 ${
                    test.status === 'PASS'
                      ? 'border-green-500 bg-green-50'
                      : test.status === 'FAIL'
                      ? 'border-red-500 bg-red-50'
                      : 'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{test.name}</h3>
                    <span
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        test.status === 'PASS'
                          ? 'bg-green-600 text-white'
                          : test.status === 'FAIL'
                          ? 'bg-red-600 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {test.status}
                    </span>
                  </div>

                  {test.response && (
                    <pre className="text-xs bg-white p-3 rounded overflow-x-auto mt-2">
                      {JSON.stringify(test.response, null, 2)}
                    </pre>
                  )}

                  {test.httpStatus && (
                    <div className="text-sm mt-2">
                      <strong>HTTP Status:</strong>{' '}
                      <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                        {test.httpStatus}
                      </code>
                    </div>
                  )}

                  {test.tokenInfo && (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <strong className="text-sm">📋 Token Info:</strong>
                      <div className="mt-2 space-y-1 text-xs">
                        <div>
                          <strong>Length:</strong> {test.tokenInfo.tokenLength}
                        </div>
                        <div>
                          <strong>Prefix:</strong>{' '}
                          <code className="bg-gray-100 px-1">{test.tokenInfo.tokenPrefix}</code>
                        </div>
                        {typeof test.tokenInfo.decodedPayload === 'object' && (
                          <>
                            <div className="font-semibold mt-2">Decoded JWT Payload:</div>
                            <div className="ml-2">
                              <div>
                                <strong>Issued At (iat):</strong> {test.tokenInfo.decodedPayload.iat}
                              </div>
                              <div>
                                <strong>Expires (exp):</strong> {test.tokenInfo.decodedPayload.exp}
                              </div>
                              <div>
                                <strong>Subject (sub):</strong> {test.tokenInfo.decodedPayload.sub}
                              </div>
                              <div className={test.tokenInfo.decodedPayload.isExpired ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                                <strong>Is Expired:</strong> {test.tokenInfo.decodedPayload.isExpired ? '❌ YES' : '✅ NO'}
                              </div>
                            </div>
                          </>
                        )}
                        {typeof test.tokenInfo.decodedPayload === 'string' && (
                          <div className="text-red-600">
                            <strong>Decode Error:</strong> {test.tokenInfo.decodedPayload}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {test.data && (
                    <div className="text-sm mt-2 space-y-1">
                      {Object.entries(test.data).map(([key, value]) => (
                        <div key={key}>
                          <strong>{key}:</strong>{' '}
                          <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                            {String(value)}
                          </code>
                        </div>
                      ))}
                    </div>
                  )}

                  {test.keyComparison && (
                    <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                      <strong className="text-sm">🔑 Key Comparison:</strong>
                      <div className="mt-2 space-y-2 text-xs">
                        <div className="font-semibold">Frontend:</div>
                        <div className="ml-2">
                          <div><strong>Length:</strong> {test.keyComparison.frontendAnonKeyLength}</div>
                          <div><strong>Prefix:</strong> <code className="bg-gray-100 px-1">{test.keyComparison.frontendAnonKeyPrefix}</code></div>
                          <div className="mt-1 p-2 bg-white rounded">
                            <strong>FULL KEY:</strong>
                            <div className="font-mono text-[10px] break-all mt-1">{test.keyComparison.frontendAnonKeyFull}</div>
                          </div>
                        </div>
                        <div className="font-semibold mt-2">Backend:</div>
                        <div className="ml-2">
                          <div><strong>Length:</strong> {test.keyComparison.backendAnonKeyLength}</div>
                          <div><strong>Prefix:</strong> <code className="bg-gray-100 px-1">{test.keyComparison.backendAnonKeyPrefix}</code></div>
                        </div>
                        <div className="font-semibold mt-2">Comparison:</div>
                        <div className="ml-2">
                          <div className={test.keyComparison.lengthMatch ? 'text-green-600' : 'text-red-600 font-bold'}>
                            <strong>Lengths Match:</strong> {test.keyComparison.lengthMatch ? '✅ YES' : '❌ NO (THIS IS THE PROBLEM!)'}
                          </div>
                          <div className={test.keyComparison.keysMatch ? 'text-green-600' : 'text-red-600 font-bold'}>
                            <strong>Prefixes Match:</strong> {test.keyComparison.keysMatch ? '✅ YES' : '❌ NO'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {test.error && (
                    <div className="text-sm text-red-700 mt-2">
                      <strong>Error:</strong> {test.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded">
              <h3 className="font-semibold text-amber-900 mb-2">
                📋 Siguiente Paso
              </h3>
              {testResults.tests.some((t: any) => t.status === 'FAIL') ? (
                <div className="text-sm text-amber-800">
                  <p className="mb-2">
                    <strong>Hay errores que corregir:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      Si "Health Check" falla: El Edge Function no está desplegado. 
                      Publica el sitio en Figma Make.
                    </li>
                    <li>
                      Si "Database Schema Check" falla: Las tablas no existen. 
                      Ve a Database Setup y ejecuta el SQL en Supabase Dashboard.
                    </li>
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-green-800">
                  ✅ Todo funciona correctamente! Puedes ir a Database Setup 
                  y cargar las configuraciones de las plantas.
                </p>
              )}
            </div>
          </Card>
        )}
        
        {/* Build Version Footer */}
        <div className="mt-6 text-center text-xs text-[#6F767E]">
          Build: {BUILD_VERSION}
        </div>
      </div>
    </div>
  );
}