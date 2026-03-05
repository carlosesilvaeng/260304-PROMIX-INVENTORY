import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { InventoryProvider } from "./contexts/InventoryContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { PlantPrefillProvider } from "./contexts/PlantPrefillContext";
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
import { ReviewAndApprove } from "./pages/ReviewAndApprove";
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
import { UnitsProvider } from "./contexts/UnitsContext";
import { projectId, publicAnonKey } from '/utils/supabase/info';

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
// 26/02/18 20:00 = February 18, 2026 at 8:00 PM
const BUILD_VERSION = '2603050601';

function AppContent() {
  const { user, currentPlant, showMigrationMessage, dismissMigrationMessage, isLoading, isFirstTime, refreshFirstTimeCheck } = useAuth();
  const [currentView, setCurrentView] =
    useState<string>("dashboard");
  const [currentSection, setCurrentSection] = useState<
    string | null
  >(null);
  const [reportContext, setReportContext] = useState<{ plantId: string; yearMonth: string } | null>(null);

  const handleNavigate = (view: string, sectionId?: string, context?: { plantId?: string; yearMonth?: string }) => {
    setCurrentView(view);
    if (sectionId) {
      setCurrentSection(sectionId);
    }
    if (context?.plantId && context?.yearMonth) {
      setReportContext({ plantId: context.plantId, yearMonth: context.yearMonth });
    } else if (!context) {
      setReportContext(null);
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView("dashboard");
    setCurrentSection(null);
  };

  const handleSetupComplete = async () => {
    console.log('✅ [App] Initial setup completed, re-checking system status...');
    // Re-verificar el estado después de crear el primer usuario
    await refreshFirstTimeCheck();
  };

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

  // Show plant selection ONLY for Plant Managers (they MUST select a plant)
  // Admins and Super Admins can access the app without selecting a plant
  if (!currentPlant && user.role === 'plant_manager') {
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
          onViewChange={setCurrentView}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          onChangePlant={() => window.location.reload()}
        />

        <div className="flex-1 overflow-y-auto">
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
            <ReviewAndApproveSection reportContext={reportContext} />
          )}

          {currentView === "reports" && <Reports onNavigate={handleNavigate} />}

          {currentView === "settings" && <Settings />}

          {currentView === "documentation" && <Documentation />}
          
          {currentView === "database-setup" && user?.role === 'super_admin' && <DatabaseSetup />}

          {currentView === "photos-report" &&
            (user?.role === 'admin' || user?.role === 'super_admin') &&
            <PhotosReport />}
          
          {currentView === "connection-test" && <ConnectionTest />}
          
          {currentView === "history" && (
            <div className="p-6">
              <div className="bg-white rounded-lg border border-[#9D9B9A] p-12 text-center">
                <h2 className="text-2xl text-[#3B3A36] mb-2">
                  Historial
                </h2>
                <p className="text-[#5F6773]">
                  Vista de historial de inventarios
                </p>
              </div>
            </div>
          )}

          {currentView === "inventory" && (
            <Dashboard onNavigate={handleNavigate} />
          )}
        </div>

        {/* Mobile bottom navigation */}
        <div className="lg:hidden bg-[#3B3A36] border-t border-[#5F6773] p-2">
          <div className="flex justify-around">
            <button
              onClick={() => setCurrentView("dashboard")}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded ${
                currentView === "dashboard"
                  ? "text-[#2475C7]"
                  : "text-white/70"
              }`}
            >
              <span className="text-xl">📊</span>
              <span className="text-xs">Dashboard</span>
            </button>
            <button
              onClick={() => setCurrentView("inventory")}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded ${
                currentView === "inventory"
                  ? "text-[#2475C7]"
                  : "text-white/70"
              }`}
            >
              <span className="text-xl">📝</span>
              <span className="text-xs">Inventario</span>
            </button>
            <button
              onClick={() => setCurrentView("reports")}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded ${
                currentView === "reports"
                  ? "text-[#2475C7]"
                  : "text-white/70"
              }`}
            >
              <span className="text-xl">📈</span>
              <span className="text-xs">Reportes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <UnitsProvider>
          <AuthProvider>
            <InventoryProvider>
              <PlantPrefillProvider>
                <ModulesProvider>
                  <AppContent key={APP_KEY} />
                </ModulesProvider>
              </PlantPrefillProvider>
            </InventoryProvider>
          </AuthProvider>
        </UnitsProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}