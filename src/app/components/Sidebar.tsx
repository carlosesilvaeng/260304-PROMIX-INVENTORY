import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { canAccessPhotosReport, canManageModules, isPlantManagerLike } from '../utils/permissions';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isOperationalUser = isPlantManagerLike(user?.role);
  
  const mainMenuItems = [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: '📊' },
    { id: 'reports', label: t('sidebar.reports'), icon: '📈' },
    { id: 'settings', label: t('sidebar.settings'), icon: '⚙️' },
  ];
  const toolsMenuItems: Array<{ id: string; label: string; icon: string }> = [];

  if (isOperationalUser) {
    mainMenuItems.splice(1, 0, { id: 'inventory', label: t('sidebar.inventory'), icon: '📝' });
  }

  if (canAccessPhotosReport(user?.role)) {
    mainMenuItems.push({ id: 'photos-report', label: t('sidebar.photosReport'), icon: '🖼️' });
  }

  if (canManageModules(user?.role)) {
    toolsMenuItems.push({ id: 'documentation', label: t('sidebar.documentation'), icon: '📄' });
    toolsMenuItems.push({ id: 'database-setup', label: t('sidebar.databaseSetup'), icon: '🔧' });
    toolsMenuItems.push({ id: 'connection-test', label: t('sidebar.connectionTest'), icon: '🔍' });
  }

  return (
    <div className="w-64 bg-[#3B3A36] min-h-screen text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-[#5F6773]">
        <h1 className="text-2xl font-bold text-[#2475C7]">PROMIX</h1>
        <p className="text-sm text-white/70 mt-1">Plant Inventory</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {mainMenuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onViewChange(item.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded transition-all
                  ${currentView === item.id 
                    ? 'bg-[#2475C7] text-white' 
                    : 'text-white/80 hover:bg-[#5F6773] hover:text-white'
                  }
                `}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {toolsMenuItems.length > 0 && (
          <div className="mt-6 border-t border-[#5F6773] pt-4">
            <p className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              {t('sidebar.tools')}
            </p>
            <ul className="space-y-2">
              {toolsMenuItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onViewChange(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded transition-all
                      ${currentView === item.id
                        ? 'bg-[#2475C7] text-white'
                        : 'text-white/80 hover:bg-[#5F6773] hover:text-white'
                      }
                    `}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#5F6773]">
        <p className="text-xs text-white/50 text-center">
          © 2026 PROMIX
        </p>
      </div>
    </div>
  );
}
