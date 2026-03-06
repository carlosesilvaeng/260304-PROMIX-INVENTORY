import React from 'react';
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
    <div className="bg-white border-b border-[#9D9B9A] px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Plant and Inventory Info */}
        <div className="flex items-center gap-6">
          {/* Plant info or Global access indicator */}
          {currentPlant ? (
            <div>
              <h2 className="text-lg font-bold text-[#3B3A36]">{currentPlant.name}</h2>
              <p className="text-sm text-[#5F6773]">{currentPlant.code} • {currentPlant.location}</p>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-bold text-[#3B3A36]">PROMIX PLANT INVENTORY</h2>
              <p className="text-sm text-[#2475C7] font-medium">🌐 Acceso Global - {getRoleLabel(user?.role || '')}</p>
            </div>
          )}
          
          {shouldShowInventoryInfo && (
            <>
              <div className="h-10 w-px bg-[#9D9B9A]" />
              <div>
                <p className="text-sm text-[#5F6773]">{t('sidebar.inventory')}</p>
                <p className="text-[#3B3A36] font-medium">
                  {currentInventory.month} {currentInventory.year}
                </p>
              </div>
              <div className="h-10 w-px bg-[#9D9B9A]" />
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
        <div className="flex items-center gap-4">
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

          <div className="text-right">
            <p className="text-sm font-medium text-[#3B3A36]">{user?.name}</p>
            <p className="text-xs text-[#5F6773]">
              {user && getRoleLabel(user.role)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#2475C7] flex items-center justify-center text-white font-medium">
            {user?.name.charAt(0)}
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            {t('topbar.logout')}
          </Button>
        </div>
      </div>
    </div>
  );
}
