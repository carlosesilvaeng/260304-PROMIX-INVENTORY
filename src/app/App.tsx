import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { InventoryProvider, useInventory } from "./contexts/InventoryContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { PlantPrefillProvider, usePlantPrefill } from "./contexts/PlantPrefillContext";
import { ModulesProvider } from "./contexts/ModulesContext";
import { Login } from "./pages/Login";
import { InitialSetup } from "./pages/InitialSetup";
import { PlantSelection } from "./pages/PlantSelection";
import { Dashboard } from "./pages/Dashboard";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { MigrationAlert } from "./components/MigrationAlert";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";
import { Documentation } from "./pages/Documentation";
import { DatabaseSetup } from "./pages/DatabaseSetup";
import { ConnectionTest } from "./pages/ConnectionTest";
import { PhotosReport } from "./pages/PhotosReport";
import { AggregatesSection } from "./pages/sections/AggregatesSection";
import { SilosSection } from "./pages/sections/SilosSection";
import { AdditivesSection } from "./pages/sections/AdditivesSection";
import { DieselSection } from "./pages/sections/DieselSection";
import { UtilitiesSection } from "./pages/sections/UtilitiesSection";
import { PettyCashSection } from "./pages/sections/PettyCashSection";
import { ProductsSection } from "./pages/sections/ProductsSection";
import { ReviewAndApproveSection } from "./pages/sections/ReviewAndApproveSection";
import { ErrorBoundary } from "./utils/errorBoundary";
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { isPlantManagerLike } from "./utils/permissions";

// ============================================================================
// AUTO-CLEANUP: Clear expired tokens on app start
// ============================================================================
(() => {
  const token = localStorage.getItem('promix_access_token');
  if (token) {
    try {
      // Decode JWT payload to check expiration
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const exp = payload.exp;
        const now = Math.floor(Date.now() / 1000);
        
        if (exp && now > exp) {
          console.warn('⚠️ [App] Expired token detected on startup, clearing session...');
          localStorage.removeItem('promix_access_token');
          localStorage.removeItem('promix_user');
          localStorage.removeItem('promix_plant');
        }
      }
    } catch (e) {
      console.error('❌ [App] Error checking token expiration:', e);
      // If token is malformed, clear it anyway
      localStorage.removeItem('promix_access_token');
      localStorage.removeItem('promix_user');
      localStorage.removeItem('promix_plant');
    }
  }
})();

// Key para forzar remount durante desarrollo
const APP_KEY = Date.now();

// Build version for tracking - Format: YYMMDDHHMM (GMT-5 Puerto Rico Time)
// 26/09/01 15:13 = September 1, 2026 at 3:13 PM
const BUILD_VERSION = '2609011514';

function AppContent() {
  const { user, currentPlant, clearSelectedPlant, showMigrationMessage, dismissMigrationMessage, isLoading, isFirstTime, refreshFirstTimeCheck } = useAuth();
  const { clearCurrentInventory } = useInventory();
  const { hasPendingChanges, hasPendingChangesForSection, currentYearMonth } = usePlantPrefill();
  const isOperationalUser = isPlantManagerLike(user?.role);
  const [currentView, setCurrentView] =
    useState<string>("dashboard");
  const [currentSection, setCurrentSection] = useState<
    string | null
  >(null);
  const [reportContext, setReportContext] = useState<{ plantId: string; yearMonth: string } | null>(null);
  const [inventoryContext, setInventoryContext] = useState<{ plantId: string; yearMonth: string } | null>(null);
  const [pendingExitAction, setPendingExitAction] = useState<(() => void) | null>(null);
  const currentSectionHasPendingChanges = hasPendingChangesForSection(currentSection);

  const handleNavigate = (view: string, sectionId?: string, context?: { plantId?: string; yearMonth?: string }) => {
    setCurrentView(view);
    setCurrentSection(view === 'section' && sectionId ? sectionId : null);

    if (view === 'review' && context?.plantId && context?.yearMonth) {
      setReportContext({ plantId: context.plantId, yearMonth: context.yearMonth });
    } else {
      setReportContext(null);
    }

    if (view === 'inventory' && context?.plantId && context?.yearMonth) {
      setInventoryContext({ plantId: context.plantId, yearMonth: context.yearMonth });
    } else {
      setInventoryContext(null);
    }
  };

  const handleViewChange = (view: string) => {
    const navigate = () => {
      const nextView = view === 'inventory' && !isOperationalUser ? 'dashboard' : view;
      setCurrentView(nextView);
      if (view !== 'section') {
        setCurrentSection(null);
      }
      if (nextView !== 'review') {
        setReportContext(null);
      }
      if (nextView !== 'inventory') {
        setInventoryContext(null);
      }
    };

    if (currentView === 'section' && currentSectionHasPendingChanges) {
      setPendingExitAction(() => navigate);
      return;
    }

    navigate();
  };

  const handleBackToDashboard = () => {
    handleViewChange("dashboard");
  };

  useEffect(() => {
    if (!hasPendingChanges) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasPendingChanges]);

  const sectionLabels: Record<string, string> = {
    agregados: 'Agregados',
    silos: 'Silos',
    aditivos: 'Aditivos',
    diesel: 'Diesel',
    aceites: 'Aceites y Productos',
    utilidades: 'Utilidades',
    'petty-cash': 'Petty Cash',
  };

  const handleChangePlant = () => {
    if (!currentPlant) return;

    const confirmed = window.confirm(
      '¿Deseas cambiar de planta? Volverás a la pantalla de selección de planta.'
    );

    if (!confirmed) return;

    clearCurrentInventory();
    clearSelectedPlant();
    setCurrentSection(null);
    setReportContext(null);
    setInventoryContext(null);
    setCurrentView('dashboard');
  };

  const handleSetupComplete = async () => {
    console.log('✅ [App] Initial setup completed, re-checking system status...');
    // Re-verificar el estado después de crear el primer usuario
    await refreshFirstTimeCheck();
  };

  const mobileNavItems = isOperationalUser
      ? [
        { id: 'dashboard', icon: '📊', label: 'Inicio' },
        { id: 'inventory', icon: '📝', label: 'Inventario' },
        { id: 'reports', icon: '📈', label: 'Reportes' },
        { id: 'settings', icon: '⚙️', label: 'Configuración' },
      ]
    : [
        { id: 'dashboard', icon: '📊', label: 'Inicio' },
        { id: 'reports', icon: '📈', label: 'Reportes' },
        { id: 'settings', icon: '⚙️', label: 'Configuración' },
      ];

  useEffect(() => {
    if ((user?.role === 'admin' || user?.role === 'super_admin') && !currentPlant) {
      clearCurrentInventory();
    }
  }, [user, currentPlant, clearCurrentInventory]);

  useEffect(() => {
    if (!isOperationalUser && currentView === 'inventory') {
      setCurrentView('dashboard');
      setInventoryContext(null);
    }
  }, [isOperationalUser, currentView]);

  // Show loading screen while verifying session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2B7DE9] to-[#1E5BB8] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white mb-4"></div>
          <p className="text-white text-lg">Cargando...</p>
        </div>
      </div>
    );
  }

  // Show initial setup if no users exist
  if (isFirstTime) {
    return <InitialSetup onSetupComplete={handleSetupComplete} />;
  }

  // Show login if no user
  if (!user) {
    return <Login />;
  }

  // Plant-manager-like roles must select a plant before using operational screens
  if (!currentPlant && isPlantManagerLike(user.role)) {
    return <PlantSelection />;
  }

  // Main application with sidebar
  return (
    <div className="flex h-screen bg-[#F2F3F5]">
      {/* Migration Alert */}
      <MigrationAlert 
        show={showMigrationMessage} 
        onClose={dismissMigrationMessage}
      />
      
      {/* Sidebar - Desktop only */}
      <div className="hidden lg:block">
        <Sidebar
          currentView={currentView}
          onViewChange={handleViewChange}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={currentView === 'section' ? 'hidden lg:block' : ''}>
          <TopBar
            onChangePlant={handleChangePlant}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {currentView === "section" && currentSection && (
            <div className="sticky top-0 z-30 border-b border-[#D4D2CF] bg-white/95 px-2 py-2 shadow-sm backdrop-blur sm:px-6">
              <div className="mx-auto flex max-w-7xl items-center gap-2 sm:justify-between">
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-[#2475C7] bg-white px-3 py-2 font-semibold text-[#2475C7] hover:bg-[#2475C7]/5 sm:flex-none"
              >
                <span aria-hidden="true">←</span>
                <span className="sm:hidden">Inventario</span>
                <span className="hidden sm:inline">Volver al inventario</span>
              </button>
                <div className="flex min-w-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="max-w-28 truncate text-xs font-semibold text-[#3B3A36] sm:max-w-none sm:text-sm">
                    {sectionLabels[currentSection] || 'Inventario'}
                  </span>
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:py-1 sm:text-xs ${
                    currentSectionHasPendingChanges
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {currentSectionHasPendingChanges ? 'Cambios sin guardar' : 'Datos sincronizados'}
                  </span>
                  {!currentSectionHasPendingChanges && currentPlant && (
                    <button
                      type="button"
                      onClick={() => handleNavigate('review', undefined, {
                        plantId: currentPlant.id,
                        yearMonth: currentYearMonth,
                      })}
                      className="whitespace-nowrap rounded-md bg-[#2475C7] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1f66ad]"
                    >
                      Ver reporte
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {currentView === "dashboard" && !currentSection && (
            <Dashboard onNavigate={handleNavigate} />
          )}

          {currentView === "section" &&
            currentSection === "agregados" && (
              <AggregatesSection onBack={handleBackToDashboard} />
            )}

          {currentView === "section" &&
            currentSection === "silos" && (
              <SilosSection onBack={handleBackToDashboard} />
            )}

          {currentView === "section" &&
            currentSection === "aditivos" && (
              <AdditivesSection />
            )}

          {currentView === "section" &&
            currentSection === "diesel" && <DieselSection />}

          {currentView === "section" &&
            currentSection === "aceites" && (
              <ProductsSection />
            )}

          {currentView === "section" &&
            currentSection === "utilidades" && (
              <UtilitiesSection />
            )}

          {currentView === "section" &&
            currentSection === "petty-cash" && (
              <PettyCashSection />
            )}

          {currentView === "review" && (
            <ReviewAndApproveSection reportContext={reportContext} onNavigate={handleNavigate} />
          )}

          {currentView === "reports" && <Reports onNavigate={handleNavigate} />}

          {currentView === "settings" && <Settings />}

          {currentView === "documentation" && <Documentation />}
          
          {currentView === "database-setup" && user?.role === 'super_admin' && <DatabaseSetup />}

          {currentView === "photos-report" &&
            (user?.role === 'admin' || user?.role === 'super_admin') &&
            <PhotosReport />}
          
          {currentView === "connection-test" && <ConnectionTest />}
          
          {currentView === "inventory" && isOperationalUser && (
            <Dashboard onNavigate={handleNavigate} initialContext={inventoryContext} />
          )}
        </div>

        {/* Mobile bottom navigation */}
        {currentView !== 'section' && (
        <div className="lg:hidden bg-[#3B3A36] border-t border-[#5F6773] p-2">
          <div className={`grid gap-1 ${mobileNavItems.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {mobileNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleViewChange(item.id)}
                className={`flex min-w-0 flex-col items-center gap-1 rounded px-2 py-2 ${
                  currentView === item.id
                    ? "text-[#2475C7]"
                    : "text-white/70"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="truncate text-[11px] leading-none">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        )}
      </div>

      {pendingExitAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="unsaved-changes-title">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 id="unsaved-changes-title" className="text-xl font-bold text-[#3B3A36]">Cambios sin guardar</h2>
            <p className="mt-3 text-[#5F6773]">
              Esta sección tiene cambios que todavía no se han guardado. Si sales ahora, esos cambios podrían perderse al cerrar o recargar el navegador.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingExitAction(null)}
                className="rounded-md border border-[#9D9B9A] px-4 py-2 font-semibold text-[#3B3A36] hover:bg-[#F2F3F5]"
              >
                Permanecer
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = pendingExitAction;
                  setPendingExitAction(null);
                  action();
                }}
                className="rounded-md bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <InventoryProvider>
            <PlantPrefillProvider>
              <ModulesProvider>
                <AppContent key={APP_KEY} />
              </ModulesProvider>
            </PlantPrefillProvider>
          </InventoryProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
