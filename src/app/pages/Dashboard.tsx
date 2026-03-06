import React, { useEffect } from 'react';
import { Card, SectionCard } from '../components/Card';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { useInventory } from '../contexts/InventoryContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useModules } from '../contexts/ModulesContext';
import { usePlantPrefill } from '../contexts/PlantPrefillContext';
import { getInventoryMonth, getReports, ReportSummary } from '../utils/api';
import { getSectionTranslation } from '../utils/sectionTranslations';
import { PromixLogo } from '../components/PromixLogo';

interface DashboardProps {
  onNavigate: (view: string, sectionId?: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { currentPlant, user } = useAuth();
  const { currentInventory, initializeInventory, clearCurrentInventory } = useInventory();
  const { t, language } = useLanguage();
  const { isModuleEnabled } = useModules();
  const { setSelectedYearMonth, loadPlantData, getCurrentYearMonth } = usePlantPrefill();
  const isPlantManager = String(user?.role || '').toLowerCase() === 'plant_manager';
  const [selectedStartMonth, setSelectedStartMonth] = React.useState<string>(getCurrentYearMonth());
  const [existingReport, setExistingReport] = React.useState<ReportSummary | null>(null);
  const [startingInventory, setStartingInventory] = React.useState(false);

  const MONTH_TO_NUM: Record<string, string> = {
    enero: '01',
    febrero: '02',
    marzo: '03',
    abril: '04',
    mayo: '05',
    junio: '06',
    julio: '07',
    agosto: '08',
    septiembre: '09',
    octubre: '10',
    noviembre: '11',
    diciembre: '12',
  };

  const getYearMonthFromDate = (date: Date): string => (
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  );

  const startMonthOptions = React.useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    for (let i = 0; i <= 3; i += 1) {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - i);
      const value = getYearMonthFromDate(date);
      const label = date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
        month: 'long',
        year: 'numeric',
      });
      options.push({ value, label });
    }
    return options;
  }, [language]);

  const getInventoryYearMonth = (inventory: typeof currentInventory): string | null => {
    if (!inventory) return null;
    if (inventory.yearMonth) return inventory.yearMonth;

    const normalizedMonth = String(inventory.month || '').toLowerCase().trim();
    const monthNumber = MONTH_TO_NUM[normalizedMonth];
    if (!monthNumber || !inventory.year) return null;

    return `${inventory.year}-${monthNumber}`;
  };

  useEffect(() => {
    if (!currentPlant || !currentInventory) return;

    if (currentInventory.plantId !== currentPlant.id) {
      clearCurrentInventory();
      return;
    }

    const targetYearMonth = getInventoryYearMonth(currentInventory);
    if (!targetYearMonth) {
      clearCurrentInventory();
      return;
    }

    let cancelled = false;

    const syncInventory = async () => {
      const response = await getInventoryMonth(currentPlant.id, targetYearMonth);
      if (cancelled) return;

      if (response.success && response.data?.month) {
        setSelectedYearMonth(targetYearMonth);
        return;
      }

      clearCurrentInventory();
      setSelectedYearMonth(getYearMonthFromDate(new Date()));
    };

    syncInventory();

    return () => {
      cancelled = true;
    };
  }, [currentPlant, currentInventory, clearCurrentInventory, setSelectedYearMonth]);

  useEffect(() => {
    if (!currentPlant) {
      setExistingReport(null);
      return;
    }

    let cancelled = false;

    const loadExistingReport = async () => {
      const response = await getReports({
        plantId: currentPlant.id,
        yearMonth: selectedStartMonth,
      });

      if (cancelled) return;

      const inProgressReport = (response.data || []).find((report) => report.status === 'IN_PROGRESS') || null;
      setExistingReport(inProgressReport);
    };

    loadExistingReport();

    return () => {
      cancelled = true;
    };
  }, [currentPlant, selectedStartMonth]);

  // Mapeo de IDs de sección a claves de módulo
  const sectionToModuleKey = (sectionId: string): string | null => {
    const mapping: Record<string, string> = {
      'agregados': 'aggregates',
      'silos': 'silos',
      'aditivos': 'additives',
      'diesel': 'diesel',
      'aceites': 'products',
      'utilidades': 'utilities',
      'petty-cash': 'petty_cash',
    };
    return mapping[sectionId] || null;
  };

  // Filtrar secciones basadas en módulos activos
  const activeSections = currentInventory?.sections.filter(section => {
    const moduleKey = sectionToModuleKey(section.id);
    return moduleKey ? isModuleEnabled(moduleKey as any) : false;
  }) || [];

  const handleStartInventory = async () => {
    if (currentPlant && user) {
      const roleLabel = user.role === 'super_admin' 
        ? t('role.superAdmin')
        : user.role === 'admin' 
          ? t('role.admin')
          : t('role.plantManager');
      const targetMonth = isPlantManager ? selectedStartMonth : getYearMonthFromDate(new Date());
      setStartingInventory(true);

      try {
        setSelectedYearMonth(targetMonth);
        await loadPlantData(currentPlant.id, targetMonth);
        initializeInventory(currentPlant.id, user.name, roleLabel, targetMonth);
      } finally {
        setStartingInventory(false);
      }
    }
  };

  const getOverallProgress = () => {
    if (!currentInventory || activeSections.length === 0) return 0;
    const total = activeSections.reduce((sum, s) => sum + s.progress, 0);
    return Math.round(total / activeSections.length);
  };

  const completedSections = activeSections.filter(s => s.status === 'complete').length;
  const totalSections = activeSections.length;

  // If Admin/Super Admin without plant selected, show welcome screen
  if (!currentPlant && (user?.role === 'admin' || user?.role === 'super_admin')) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Logo Header */}
          <div className="flex justify-center mb-6">
            <PromixLogo size="lg" />
          </div>
          
          <Card className="text-center py-12">
            <div className="mb-6">
              <div className="w-20 h-20 bg-[#F2F3F5] rounded-full mx-auto flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-[#2475C7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-2xl text-[#3B3A36] mb-2">
                Bienvenido, {user?.name}
              </h2>
              <p className="text-[#5F6773] mb-4">
                {user?.role === 'super_admin' ? 'Super Administrador' : 'Administrador'} - Acceso Global
              </p>
              <p className="text-[#5F6773] text-sm max-w-lg mx-auto">
                Tienes acceso completo a todas las funciones del sistema. Usa el menú lateral para:
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto mt-8">
              <button
                onClick={() => onNavigate('settings')}
                className="p-6 bg-[#F2F3F5] rounded-lg hover:bg-[#E4E4E4] transition-colors text-left"
              >
                <div className="text-3xl mb-2">⚙️</div>
                <h3 className="font-semibold text-[#3B3A36] mb-1">Configuración</h3>
                <p className="text-sm text-[#5F6773]">Gestionar usuarios, plantas y permisos</p>
              </button>

              <button
                onClick={() => onNavigate('reports')}
                className="p-6 bg-[#F2F3F5] rounded-lg hover:bg-[#E4E4E4] transition-colors text-left"
              >
                <div className="text-3xl mb-2">📊</div>
                <h3 className="font-semibold text-[#3B3A36] mb-1">Reportes</h3>
                <p className="text-sm text-[#5F6773]">Ver reportes consolidados de todas las plantas</p>
              </button>

              <button
                onClick={() => onNavigate('photos-report')}
                className="p-6 bg-[#F2F3F5] rounded-lg hover:bg-[#E4E4E4] transition-colors text-left"
              >
                <div className="text-3xl mb-2">🖼️</div>
                <h3 className="font-semibold text-[#3B3A36] mb-1">Reporte de Fotos</h3>
                <p className="text-sm text-[#5F6773]">Ver todas las fotos capturadas en inventarios</p>
              </button>

              {user?.role === 'super_admin' && (
                <button
                  onClick={() => onNavigate('database-setup')}
                  className="p-6 bg-[#F2F3F5] rounded-lg hover:bg-[#E4E4E4] transition-colors text-left"
                >
                  <div className="text-3xl mb-2">🗄️</div>
                  <h3 className="font-semibold text-[#3B3A36] mb-1">Base de Datos</h3>
                  <p className="text-sm text-[#5F6773]">Configurar datos iniciales del sistema</p>
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!currentInventory) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Logo Header */}
          <div className="flex justify-center mb-6">
            <PromixLogo size="lg" />
          </div>
          
          <Card className="text-center py-12">
            <div className="mb-6">
              <div className="w-20 h-20 bg-[#F2F3F5] rounded-full mx-auto flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-[#5F6773]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="text-2xl text-[#3B3A36] mb-2">
                {t('dashboard.startInventory')}
              </h2>
              <p className="text-[#5F6773] mb-6">
                {t('dashboard.noInventory')} {currentPlant?.name}
              </p>
              {isPlantManager && (
                <div className="max-w-md mx-auto mb-6 text-left">
                  <label htmlFor="start-month" className="block text-sm font-semibold text-[#3B3A36] mb-2">
                    Período de inventario
                  </label>
                  <select
                    id="start-month"
                    value={selectedStartMonth}
                    onChange={(e) => setSelectedStartMonth(e.target.value)}
                    className="w-full rounded-md border border-[#9D9B9A] bg-white px-3 py-2 text-[#3B3A36]"
                  >
                    {startMonthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[#5F6773] mt-2">
                    Puedes iniciar inventario en el mes actual o en cualquiera de los 3 meses anteriores (4 periodos en total).
                  </p>
                </div>
              )}
            </div>
            <Button size="lg" onClick={handleStartInventory} disabled={startingInventory}>
              {startingInventory
                ? 'Preparando inventario...'
                : existingReport
                  ? `Continuar inventario de ${new Date((selectedStartMonth || getYearMonthFromDate(new Date())) + '-01T12:00:00').toLocaleDateString(
                      language === 'es' ? 'es-ES' : 'en-US',
                      { month: 'long', year: 'numeric' }
                    )}`
                  : `${t('dashboard.startInventoryOf')} ${new Date((selectedStartMonth || getYearMonthFromDate(new Date())) + '-01T12:00:00').toLocaleDateString(
                      language === 'es' ? 'es-ES' : 'en-US',
                      { month: 'long', year: 'numeric' }
                    )}`}
            </Button>
            {existingReport && (
              <p className="text-sm text-[#5F6773] mt-3">
                Ya existe un inventario en progreso para este periodo. Usa continuar para retomarlo.
              </p>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Logo Header */}
      <div className="flex justify-center mb-2">
        <PromixLogo size="lg" />
      </div>
      
      {/* Summary Cards - First Row: Progress, Sections, Date, Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#2475C7]/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-[#2475C7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[#5F6773]">{t('dashboard.overallProgress')}</p>
              <p className="text-2xl font-bold text-[#3B3A36]">{getOverallProgress()}%</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#2ecc71]/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-[#2ecc71]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[#5F6773]">{t('dashboard.completedSections')}</p>
              <p className="text-2xl font-bold text-[#3B3A36]">{completedSections}/{totalSections}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#f59e0b]/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[#5F6773]">{t('dashboard.period')}</p>
              <p className="text-sm font-bold text-[#3B3A36]">
                {currentInventory.month} {currentInventory.year}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              currentInventory.status === 'approved' ? 'bg-[#2ecc71]/10' :
              currentInventory.status === 'completed' ? 'bg-[#2475C7]/10' : 'bg-[#f59e0b]/10'
            }`}>
              <svg className={`w-6 h-6 ${
                currentInventory.status === 'approved' ? 'text-[#2ecc71]' :
                currentInventory.status === 'completed' ? 'text-[#2475C7]' : 'text-[#f59e0b]'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[#5F6773]">{t('settings.status')}</p>
              <p className="text-sm font-bold text-[#3B3A36]">
                {currentInventory.status === 'approved' ? t('status.approved') :
                 currentInventory.status === 'completed' ? t('status.completed') : 
                 currentInventory.status === 'in-progress' ? t('status.inProgress') : t('status.draft')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Second Row: Start Timestamp and End Timestamp */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-[#2475C7]/5 to-[#2475C7]/10 border-[#2475C7]/20">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#2475C7] rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#5F6773] mb-1">{t('dashboard.startTimestamp')}</p>
              {currentInventory.startTimestamp && (
                <>
                  <p className="text-2xl font-bold text-[#2475C7] leading-tight">
                    {currentInventory.startTimestamp.toLocaleTimeString(language === 'es' ? 'es' : 'en', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </p>
                  <p className="text-sm text-[#5F6773] mt-1">
                    {currentInventory.startTimestamp.toLocaleDateString(language === 'es' ? 'es' : 'en', { 
                      weekday: 'short',
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>

        <Card className={`border-2 ${
          currentInventory.endTimestamp 
            ? 'bg-gradient-to-br from-[#2ecc71]/5 to-[#2ecc71]/10 border-[#2ecc71]/20' 
            : 'bg-[#F2F3F5] border-[#9D9B9A]/20'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 ${
              currentInventory.endTimestamp ? 'bg-[#2ecc71]' : 'bg-[#9D9B9A]/30'
            }`}>
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {currentInventory.endTimestamp ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#5F6773] mb-1">{t('dashboard.endTimestamp')}</p>
              {currentInventory.endTimestamp ? (
                <>
                  <p className="text-2xl font-bold text-[#2ecc71] leading-tight">
                    {currentInventory.endTimestamp.toLocaleTimeString(language === 'es' ? 'es' : 'en', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </p>
                  <p className="text-sm text-[#5F6773] mt-1">
                    {currentInventory.endTimestamp.toLocaleDateString(language === 'es' ? 'es' : 'en', { 
                      weekday: 'short',
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-[#9D9B9A] leading-tight">
                    --:--
                  </p>
                  <p className="text-sm text-[#9D9B9A] mt-1">
                    {t('status.pending')}
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <h3 className="text-lg text-[#3B3A36] mb-4">{t('dashboard.inventoryProgress')}</h3>
        <div className="w-full bg-[#F2F3F5] rounded-full h-4">
          <div 
            className="bg-[#2475C7] h-4 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
            style={{ width: `${getOverallProgress()}%` }}
          >
            <span className="text-xs text-white font-medium">{getOverallProgress()}%</span>
          </div>
        </div>
      </Card>

      {/* Sections Checklist */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl text-[#3B3A36]">{t('dashboard.checklist')}</h3>
          {currentInventory.status !== 'completed' && (
            <Button 
              size="sm"
              onClick={() => onNavigate('review')}
              disabled={getOverallProgress() < 100}
            >
              {t('dashboard.reviewAndApprove')}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeSections.map((section) => (
            <SectionCard
              key={section.id}
              title={getSectionTranslation(section.name, t)}
              status={section.status}
              progress={section.progress}
              onClick={() => onNavigate('section', section.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
