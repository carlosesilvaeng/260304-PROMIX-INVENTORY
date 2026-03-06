import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isPlantManager = user?.role === 'plant_manager';
  
  const menuItems = [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: '📊' },
    { id: 'reports', label: t('sidebar.reports'), icon: '📈' },
    { id: 'history', label: t('sidebar.history'), icon: '📋' },
    { id: 'settings', label: t('sidebar.settings'), icon: '⚙️' },
  ];

  if (isPlantManager) {
    menuItems.splice(1, 0, { id: 'inventory', label: t('sidebar.inventory'), icon: '📝' });
  }

  // Reporte de Fotos — admin + super_admin
  if (user?.role === 'admin' || user?.role === 'super_admin') {
    menuItems.push({ id: 'photos-report', label: 'Reporte de Fotos', icon: '🖼️' });
  }

  // Solo agregar Documentación y Database Setup si el usuario es super_admin
  if (user?.role === 'super_admin') {
    menuItems.push({ id: 'documentation', label: t('sidebar.documentation'), icon: '📄' });
    menuItems.push({ id: 'database-setup', label: 'Database Setup', icon: '🔧' });
    menuItems.push({ id: 'connection-test', label: 'Connection Test', icon: '🔍' });
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
          {menuItems.map((item) => (
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
