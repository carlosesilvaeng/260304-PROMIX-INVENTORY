import React from 'react';
import { Power } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useInventory } from '../contexts/InventoryContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './Button';

interface TopBarProps {
  onChangePlant: () => void;
}

export function TopBar({ onChangePlant }: TopBarProps) {
  const { user, currentPlant, logout } = useAuth();
  const inventoryContext = useInventory();
  const { language, setLanguage, t } = useLanguage();
  
  // Safely access currentInventory with fallback
  const currentInventory = inventoryContext?.currentInventory;
  const shouldShowInventoryInfo = !!currentPlant && !!currentInventory && currentInventory.plantId === currentPlant.id;

  const getStatusBadge = () => {
    if (!currentInventory) return null;

    const statusStyles = {
      draft: { bg: 'bg-[#9D9B9A]', text: t('status.draft') },
      'in-progress': { bg: 'bg-[#2475C7]', text: t('status.inProgress') },
      completed: { bg: 'bg-[#2ecc71]', text: t('status.completed') },
      approved: { bg: 'bg-[#2ecc71]', text: t('status.approved') },
    };

    const style = statusStyles[currentInventory.status];

    return (
      <div className={`${style.bg} text-white px-3 py-1 rounded text-sm`}>
        {style.text}
      </div>
    );
  };

  const getRoleLabel = (role: string) => {
    if (role === 'super_admin') return t('role.superAdmin');
    if (role === 'admin') return t('role.admin');
    return t('role.plantManager');
  };

  return (
    <div className="relative bg-white border-b border-[#9D9B9A] px-3 py-3 sm:px-6 sm:py-4">
      <Button
        variant="destructive"
        size="sm"
        onClick={logout}
        aria-label={t('topbar.logout')}
        title={t('topbar.logout')}
        className="absolute right-3 top-3 z-10 h-11 w-11 rounded-full p-0 shadow-lg sm:right-4 sm:top-4 lg:static lg:h-auto lg:w-auto lg:rounded lg:px-3 lg:py-1.5 lg:shadow-none"
      >
        <Power className="h-4 w-4" />
        <span className="hidden lg:inline">{t('topbar.logout')}</span>
      </Button>

      <div className="flex flex-col gap-3 pr-16 lg:flex-row lg:items-center lg:justify-between lg:pr-0">
        {/* Left side - Plant and Inventory Info */}
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 lg:gap-6">
          {/* Plant info or Global access indicator */}
          {currentPlant ? (
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-[#3B3A36]">{currentPlant.name}</h2>
              <p className="truncate text-sm text-[#5F6773]">{currentPlant.code} • {currentPlant.location}</p>
            </div>
          ) : (
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-[#3B3A36]">PROMIX PLANT INVENTORY</h2>
              <p className="truncate text-sm font-medium text-[#2475C7]">🌐 Acceso Global - {getRoleLabel(user?.role || '')}</p>
            </div>
          )}
          
          {shouldShowInventoryInfo && (
            <>
              <div className="hidden h-10 w-px bg-[#9D9B9A] lg:block" />
              <div>
                <p className="text-sm text-[#5F6773]">{t('sidebar.inventory')}</p>
                <p className="text-[#3B3A36] font-medium">
                  {currentInventory.month} {currentInventory.year}
                </p>
              </div>
              <div className="hidden h-10 w-px bg-[#9D9B9A] lg:block" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#5F6773]">{t('settings.status')}:</span>
                {getStatusBadge()}
              </div>
            </>
          )}
          
          {/* Show "Change Plant" button for Plant Managers or if a plant is selected */}
          {(user?.role === 'plant_manager' || currentPlant) && (
            <Button variant="ghost" size="sm" onClick={onChangePlant}>
              {t('topbar.changePlant')}
            </Button>
          )}
        </div>

        {/* Right side - Language Selector & User Info */}
        <div className="flex items-center gap-2 sm:gap-4 lg:justify-end">
          {/* Language Selector */}
          <div className="flex items-center gap-2 bg-[#F2F3F5] rounded-lg p-1">
            <button
              onClick={() => setLanguage('es')}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                language === 'es'
                  ? 'bg-[#2475C7] text-white'
                  : 'text-[#5F6773] hover:text-[#3B3A36]'
              }`}
            >
              🇪🇸 ES
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                language === 'en'
                  ? 'bg-[#2475C7] text-white'
                  : 'text-[#5F6773] hover:text-[#3B3A36]'
              }`}
            >
              🇺🇸 EN
            </button>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-[#3B3A36]">{user?.name}</p>
            <p className="text-xs text-[#5F6773]">
              {user && getRoleLabel(user.role)}
            </p>
          </div>
          <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-[#2475C7] text-white font-medium sm:flex">
            {user?.name.charAt(0)}
          </div>
        </div>
      </div>
    </div>
  );
}
