import React, { createContext, useContext, useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getCajonesByPlant } from '../config/cajonesConfig';

// DIAGNOSTIC LOG - Verificar que se carguen los valores correctos
console.log('🔍 [AuthContext] Supabase Config Loaded:');
console.log('   ProjectId:', projectId);
console.log('   AnonKey Length:', publicAnonKey.length);
console.log('   AnonKey Prefix:', publicAnonKey.substring(0, 50) + '...');
console.log('   Expected ProjectId: olieryxyhakumgyohlrr');
console.log('   Match:', projectId === 'olieryxyhakumgyohlrr' ? '✅' : '❌');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
  role: 'plant_manager' | 'admin' | 'super_admin';
  assigned_plants: string[]; // IDs de plantas asignadas
  is_active: boolean;
  auth_user_id?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

interface SiloConfig {
  id: string;
  name: string;
  type: 'cemento' | 'slag';
}

export interface CajonConfig {
  id: string;
  name: string; // Ej: "Cajón 1", "Cajón 2"
  material: string; // Ej: "Piedra 3/4"
  procedencia: string; // Ej: "Cantera Norte"
}

export interface Plant {
  id: string;
  name: string;
  code: string;
  location: string;
  methods: {
    hasConeMeasurement: boolean;
    hasCajonMeasurement: boolean;
  };
  cajones?: CajonConfig[]; // Configuración de cajones por planta
  silos: SiloConfig[];
  pettyCashEstablished: number;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  currentPlant: Plant | null;
  allPlants: Plant[];
  accessToken: string | null;
  isLoading: boolean;
  isFirstTime: boolean; // NEW: Indica si es first-time setup (no hay usuarios)
  showMigrationMessage: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  selectPlant: (plantId: string) => void;
  updatePlant: (plant: Plant) => void;
  createPlant: (plant: Omit<Plant, 'id'>) => void;
  togglePlantStatus: (plantId: string) => void;
  dismissMigrationMessage: () => void;
  refreshUser: () => Promise<void>;
  refreshFirstTimeCheck: () => Promise<void>; // NEW: Re-verificar si hay usuarios
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// STATIC PLANT DATA (Stays in frontend for now)
// ============================================================================

const MOCK_PLANTS: Plant[] = [
  {
    id: 'CAROLINA',
    name: 'CAROLINA',
    code: 'CAR-001',
    location: 'Carolina, PR',
    methods: { hasConeMeasurement: true, hasCajonMeasurement: true },
    cajones: getCajonesByPlant('CAROLINA').map(c => ({ id: c.id, name: c.name, material: '', procedencia: '' })),
    silos: [
      { id: '1', name: 'Silo Cemento 1', type: 'cemento' },
      { id: '2', name: 'Silo Cemento 2', type: 'cemento' },
      { id: '3', name: 'Silo Slag 1', type: 'slag' },
    ],
    pettyCashEstablished: 1500,
    isActive: true
  },
  {
    id: 'CEIBA',
    name: 'CEIBA',
    code: 'CEI-002',
    location: 'Ceiba, PR',
    methods: { hasConeMeasurement: true, hasCajonMeasurement: true },
    cajones: getCajonesByPlant('CEIBA').map(c => ({ id: c.id, name: c.name, material: '', procedencia: '' })),
    silos: [
      { id: '4', name: 'Silo Cemento 1', type: 'cemento' },
      { id: '5', name: 'Silo Cemento 2', type: 'cemento' },
    ],
    pettyCashEstablished: 1200,
    isActive: true
  },
  {
    id: 'GUAYNABO',
    name: 'GUAYNABO',
    code: 'GUA-003',
    location: 'Guaynabo, PR',
    methods: { hasConeMeasurement: true, hasCajonMeasurement: true },
    cajones: getCajonesByPlant('GUAYNABO').map(c => ({ id: c.id, name: c.name, material: '', procedencia: '' })),
    silos: [
      { id: '6', name: 'Silo Cemento 1', type: 'cemento' },
      { id: '7', name: 'Silo Cemento 2', type: 'cemento' },
      { id: '8', name: 'Silo Slag 1', type: 'slag' },
    ],
    pettyCashEstablished: 1500,
    isActive: true
  },
  {
    id: 'GURABO',
    name: 'GURABO',
    code: 'GUR-004',
    location: 'Gurabo, PR',
    methods: { hasConeMeasurement: true, hasCajonMeasurement: true },
    cajones: getCajonesByPlant('GURABO').map(c => ({ id: c.id, name: c.name, material: '', procedencia: '' })),
    silos: [
      { id: '9', name: 'Silo Cemento 1', type: 'cemento' },
      { id: '10', name: 'Silo Cemento 2', type: 'cemento' },
    ],
    pettyCashEstablished: 1200,
    isActive: true
  },
  {
    id: 'VEGA_BAJA',
    name: 'VEGA BAJA',
    code: 'VEB-005',
    location: 'Vega Baja, PR',
    methods: { hasConeMeasurement: true, hasCajonMeasurement: true },
    cajones: getCajonesByPlant('VEGA BAJA').map(c => ({ id: c.id, name: c.name, material: '', procedencia: '' })),
    silos: [
      { id: '11', name: 'Silo Cemento 1', type: 'cemento' },
      { id: '12', name: 'Silo Cemento 2', type: 'cemento' },
      { id: '13', name: 'Silo Slag 1', type: 'slag' },
    ],
    pettyCashEstablished: 1000,
    isActive: true
  },
  {
    id: 'HUMACAO',
    name: 'HUMACAO',
    code: 'HUM-006',
    location: 'Humacao, PR',
    methods: { hasConeMeasurement: true, hasCajonMeasurement: true },
    cajones: getCajonesByPlant('HUMACAO').map(c => ({ id: c.id, name: c.name, material: '', procedencia: '' })),
    silos: [
      { id: '14', name: 'Silo Cemento 1', type: 'cemento' },
      { id: '15', name: 'Silo Cemento 2', type: 'cemento' },
    ],
    pettyCashEstablished: 1000,
    isActive: true
  },
];

// ============================================================================
// API HELPER
// ============================================================================

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-02205af0`;

async function callAPI(endpoint: string, method: string = 'GET', body?: any, token?: string) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Use access token if available, otherwise use anon key
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['Authorization'] = `Bearer ${publicAnonKey}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`📡 [API] ${method} ${url}`);
  
  try {
    const response = await fetch(url, options);
    
    console.log(`📡 [API] Response status: ${response.status}`);
    
    // Intentar parsear JSON
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('❌ [API] Failed to parse JSON response:', parseError);
      throw new Error('El servidor no respondió con datos válidos. Verifica que la Edge Function esté desplegada.');
    }

    if (!response.ok) {
      console.error('❌ [API] Error response:', data);
      throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (error: any) {
    console.error('❌ [API] Network error:', error);
    
    // Mejorar el mensaje de error para el usuario
    if (error.message === 'Failed to fetch') {
      throw new Error('No se puede conectar al servidor. Verifica que la Edge Function esté desplegada en Supabase.');
    }
    
    throw error;
  }
}

// ============================================================================
// AUTH PROVIDER
// ============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentPlant, setCurrentPlant] = useState<Plant | null>(null);
  const [allPlants, setAllPlants] = useState<Plant[]>(MOCK_PLANTS);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(false); // NEW: Indica si es first-time setup (no hay usuarios)
  const [showMigrationMessage, setShowMigrationMessage] = useState(false);

  // ============================================================================
  // INITIAL LOAD - Verificar sesión existente
  // ============================================================================

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // PRIMERO: Verificar si es first-time setup (no hay usuarios)
        console.log('🔍 [AuthContext] Checking first-time setup...');
        console.log('🔍 [AuthContext] Calling:', `${API_BASE_URL}/auth/check-first-time`);
        try {
          const firstTimeResponse = await callAPI('/auth/check-first-time', 'GET');
          if (firstTimeResponse.success) {
            setIsFirstTime(firstTimeResponse.isFirstTime);
            console.log(`🔍 [AuthContext] First-time setup: ${firstTimeResponse.isFirstTime ? 'YES' : 'NO'} (${firstTimeResponse.userCount} users)`);
            
            // Si es first-time, no intentamos verificar sesión
            if (firstTimeResponse.isFirstTime) {
              setIsLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error('❌ [AuthContext] Error checking first-time setup:', error);
        }

        // SEGUNDO: Verificar sesión existente (solo si NO es first-time)
        const storedToken = localStorage.getItem('promix_access_token');
        const storedUser = localStorage.getItem('promix_user');
        const storedPlant = localStorage.getItem('promix_plant');

        if (storedToken && storedUser) {
          // Verificar si el token es válido
          try {
            const response = await callAPI('/auth/verify', 'POST', {}, storedToken);
            
            if (response.success && response.user) {
              setUser(response.user);
              setAccessToken(storedToken);

              // Restaurar planta seleccionada
              if (storedPlant) {
                try {
                  const plant = JSON.parse(storedPlant);
                  const existingPlant = MOCK_PLANTS.find(p => p.id === plant.id);
                  if (existingPlant) {
                    setCurrentPlant(existingPlant);
                  }
                } catch (e) {
                  console.error('Error loading stored plant:', e);
                  localStorage.removeItem('promix_plant');
                }
              }
            } else {
              // Token inválido, limpiar sesión
              console.warn('⚠️ Token stored is invalid, clearing session...');
              clearSession();
            }
          } catch (error: any) {
            console.error('❌ Error verifying token:', error);
            
            // Si el error es por JWT inválido, expirado o 401, limpiar automáticamente
            if (
              error.message?.includes('401') || 
              error.message?.includes('JWT') || 
              error.message?.includes('Invalid') ||
              error.message?.includes('TOKEN_EXPIRED') ||
              error.message?.includes('expired')
            ) {
              console.warn('⚠️ Invalid or expired JWT detected, auto-clearing session...');
              clearSession();
            } else {
              // Otros errores (red, servidor caído, etc.), mantener sesión por si acaso
              console.warn('⚠️ Network error, keeping session for retry...');
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // ============================================================================
  // HELPER - Limpiar sesión
  // ============================================================================

  const clearSession = () => {
    setUser(null);
    setCurrentPlant(null);
    setAccessToken(null);
    localStorage.removeItem('promix_access_token');
    localStorage.removeItem('promix_user');
    localStorage.removeItem('promix_plant');
  };

  // ============================================================================
  // LOGIN
  // ============================================================================

  const login = async (email: string, password: string) => {
    try {
      const response = await callAPI('/auth/login', 'POST', { email, password });

      if (!response.success || !response.user || !response.access_token) {
        throw new Error(response.error || 'Error al iniciar sesión');
      }

      // Guardar usuario y token
      setUser(response.user);
      setAccessToken(response.access_token);
      localStorage.setItem('promix_access_token', response.access_token);
      localStorage.setItem('promix_user', JSON.stringify(response.user));

      console.log('✅ Login exitoso:', response.user.email);
    } catch (error: any) {
      console.error('❌ Error en login:', error);
      throw new Error(error.message || 'Credenciales inválidas');
    }
  };

  // ============================================================================
  // LOGOUT
  // ============================================================================

  const logout = () => {
    clearSession();
    console.log('✅ Sesión cerrada');
  };

  // ============================================================================
  // REFRESH USER (después de actualizaciones)
  // ============================================================================

  const refreshUser = async () => {
    if (!accessToken) return;

    try {
      const response = await callAPI('/auth/verify', 'POST', {}, accessToken);
      
      if (response.success && response.user) {
        setUser(response.user);
        localStorage.setItem('promix_user', JSON.stringify(response.user));
      }
    } catch (error: any) {
      console.error('Error refreshing user:', error);
      
      // Si el token expiró durante el refresh, cerrar sesión
      if (
        error.message?.includes('401') || 
        error.message?.includes('JWT') || 
        error.message?.includes('TOKEN_EXPIRED') ||
        error.message?.includes('expired')
      ) {
        console.warn('⚠️ Token expired during refresh, logging out...');
        clearSession();
      }
    }
  };

  // ============================================================================
  // PLANT MANAGEMENT
  // ============================================================================

  const selectPlant = (plantId: string) => {
    const plant = allPlants.find(p => p.id === plantId);
    if (plant) {
      setCurrentPlant(plant);
      localStorage.setItem('promix_plant', JSON.stringify(plant));
    }
  };

  const updatePlant = (plant: Plant) => {
    const updatedPlants = allPlants.map(p => p.id === plant.id ? plant : p);
    setAllPlants(updatedPlants);
  };

  const createPlant = (plant: Omit<Plant, 'id'>) => {
    const newPlant: Plant = { ...plant, id: (allPlants.length + 1).toString() };
    setAllPlants([...allPlants, newPlant]);
  };

  const togglePlantStatus = (plantId: string) => {
    const updatedPlants = allPlants.map(p => 
      p.id === plantId ? { ...p, isActive: !p.isActive } : p
    );
    setAllPlants(updatedPlants);
  };

  const dismissMigrationMessage = () => {
    setShowMigrationMessage(false);
  };

  // ============================================================================
  // FIRST-TIME SETUP CHECK
  // ============================================================================

  const refreshFirstTimeCheck = async () => {
    try {
      console.log('🔄 [AuthContext] Re-checking first-time setup...');
      const response = await callAPI('/auth/check-first-time', 'GET');
      
      if (response.success) {
        setIsFirstTime(response.isFirstTime);
        console.log(`🔄 [AuthContext] First-time status updated: ${response.isFirstTime ? 'YES' : 'NO'} (${response.userCount} users)`);
      }
    } catch (error) {
      console.error('Error checking first-time setup:', error);
    }
  };

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: AuthContextType = {
    user,
    currentPlant,
    allPlants,
    accessToken,
    isLoading,
    isFirstTime,
    showMigrationMessage,
    login,
    logout,
    selectPlant,
    updatePlant,
    createPlant,
    togglePlantStatus,
    dismissMigrationMessage,
    refreshUser,
    refreshFirstTimeCheck,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export { MOCK_PLANTS };
export type { User, SiloConfig };