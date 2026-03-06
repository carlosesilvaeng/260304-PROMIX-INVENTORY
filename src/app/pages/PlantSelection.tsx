import React from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PromixLogo } from '../components/PromixLogo';

export function PlantSelection() {
  const { user, allPlants, selectPlant, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  // Filtrar plantas según usuario
  const availablePlants = allPlants.filter(plant => {
    // Super admin ve todas las plantas activas
    if (user?.role === 'super_admin') {
      return plant.isActive;
    }
    // Otros usuarios solo ven plantas asignadas y activas
    return plant.isActive && user?.assigned_plants?.includes(plant.id);
  });

  const getRoleLabel = (role: string) => {
    if (role === 'super_admin') return t('role.superAdmin');
    if (role === 'admin') return t('role.admin');
    return t('role.plantManager');
  };

  return (
    <div className="min-h-screen bg-[#F2F3F5]">
      {/* Header */}
      <div className="bg-[#3B3A36] text-white p-4 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-[#2475C7]">{t('login.title')}</h1>
            <span className="text-sm opacity-80">{t('login.subtitle')}</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Language Selector */}
            <div className="flex items-center gap-2 bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setLanguage('es')}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  language === 'es'
                    ? 'bg-[#2475C7] text-white'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                🇪🇸 ES
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  language === 'en'
                    ? 'bg-[#2475C7] text-white'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                🇺🇸 EN
              </button>
            </div>
            
            <div className="text-right">
              <p className="text-sm">{user?.name}</p>
              <p className="text-xs opacity-70">
                {user && getRoleLabel(user.role)}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-white hover:bg-white/10">
              {t('topbar.logout')}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Logo Header */}
        <div className="flex justify-center mb-6">
          <PromixLogo size="lg" />
        </div>
        
        <div className="mb-8">
          <h2 className="text-2xl text-[#3B3A36] mb-2">{t('plantSelection.title')}</h2>
          <p className="text-[#5F6773]">{t('plantSelection.description')}</p>
        </div>

        {availablePlants.length === 0 ? (
          <Card className="text-center py-12">
            <div className="space-y-4">
              <div className="flex justify-center">
                <svg className="w-16 h-16 text-[#9D9B9A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl text-[#3B3A36] mb-2">No tienes plantas asignadas</h3>
                <p className="text-[#5F6773] max-w-md mx-auto">
                  Contacta con tu administrador para que te asigne acceso a una o más plantas del sistema PROMIX.
                </p>
              </div>
              <div className="pt-4">
                <Button variant="secondary" onClick={logout}>
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availablePlants.map((plant) => (
              <Card key={plant.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl text-[#3B3A36] group-hover:text-[#2475C7] transition-colors">
                        {plant.name}
                      </h3>
                      <p className="text-sm text-[#5F6773]">{plant.code}</p>
                    </div>
                    <div className="bg-[#2475C7] text-white px-3 py-1 rounded text-sm">
                      {t('settings.active')}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-[#5F6773]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{plant.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#5F6773]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{plant.silos.length} {t('settings.silos')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#5F6773]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M6 7v10h12V7M9 11h6M9 14h6" />
                      </svg>
                      <span>{plant.cajones?.length || 0} cajones preconfigurados</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#5F6773]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l8 18H4L12 3z" />
                      </svg>
                      <span>{plant.conesCount || 0} conos preconfigurados</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#9D9B9A]">
                    <p className="text-xs text-[#5F6773] mb-2">{t('aggregates.method')}:</p>
                    <div className="flex gap-2">
                      {plant.methods.hasCajonMeasurement && (
                        <span className="px-2 py-1 bg-[#F2F3F5] text-[#3B3A36] text-xs rounded">
                          {t('aggregates.methodBox')}
                        </span>
                      )}
                      {plant.methods.hasConeMeasurement && (
                        <span className="px-2 py-1 bg-[#F2F3F5] text-[#3B3A36] text-xs rounded">
                          {t('aggregates.methodCone')}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button 
                    className="w-full"
                    onClick={() => selectPlant(plant.id)}
                  >
                    {t('plantSelection.button')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
