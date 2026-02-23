/**
 * ModulesContext
 * Manages which modules/sections are enabled for the entire application
 * Only Super Admin can modify these settings
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ModuleKey, ModuleConfig, ModuleSettings, DEFAULT_MODULE_CONFIG } from '../config/moduleConfig';
import { getModuleSettings, updateModuleSettings } from '../utils/api';

interface ModulesContextType {
  moduleSettings: ModuleSettings;
  isModuleEnabled: (moduleKey: ModuleKey) => boolean;
  toggleModule: (moduleKey: ModuleKey, enabled: boolean, updatedBy: string) => Promise<void>;
  refreshModules: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const ModulesContext = createContext<ModulesContextType | undefined>(undefined);

export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const [moduleSettings, setModuleSettings] = useState<ModuleSettings>(DEFAULT_MODULE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load module settings on mount
  useEffect(() => {
    loadModuleSettings();
  }, []);

  const loadModuleSettings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[ModulesContext] Loading module settings...');
      const response = await getModuleSettings();
      
      if (response.success && response.data) {
        console.log('[ModulesContext] Module settings loaded:', response.data);
        setModuleSettings(response.data);
      } else {
        // If no settings exist yet, use defaults and save them
        console.log('[ModulesContext] No settings found, using defaults');
        setModuleSettings(DEFAULT_MODULE_CONFIG);
        
        // Save defaults to backend
        await updateModuleSettings(DEFAULT_MODULE_CONFIG);
      }
    } catch (err) {
      console.error('[ModulesContext] Error loading module settings:', err);
      setError('Error al cargar configuración de módulos');
      // Use defaults on error
      setModuleSettings(DEFAULT_MODULE_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  const isModuleEnabled = (moduleKey: ModuleKey): boolean => {
    return moduleSettings.modules[moduleKey]?.enabled ?? false;
  };

  const toggleModule = async (moduleKey: ModuleKey, enabled: boolean, updatedBy: string) => {
    try {
      console.log(`[ModulesContext] Toggling module ${moduleKey} to ${enabled}`);
      
      const updatedSettings: ModuleSettings = {
        ...moduleSettings,
        modules: {
          ...moduleSettings.modules,
          [moduleKey]: {
            ...moduleSettings.modules[moduleKey],
            enabled,
          },
        },
        lastUpdatedBy: updatedBy,
        lastUpdatedAt: new Date().toISOString(),
      };

      // Update in backend
      const response = await updateModuleSettings(updatedSettings);
      
      if (response.success) {
        setModuleSettings(updatedSettings);
        console.log(`[ModulesContext] Module ${moduleKey} updated successfully`);
      } else {
        throw new Error(response.error || 'Error al actualizar módulo');
      }
    } catch (err) {
      console.error('[ModulesContext] Error toggling module:', err);
      throw err;
    }
  };

  const refreshModules = async () => {
    await loadModuleSettings();
  };

  return (
    <ModulesContext.Provider
      value={{
        moduleSettings,
        isModuleEnabled,
        toggleModule,
        refreshModules,
        loading,
        error,
      }}
    >
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  const context = useContext(ModulesContext);
  if (context === undefined) {
    throw new Error('useModules must be used within a ModulesProvider');
  }
  return context;
}
