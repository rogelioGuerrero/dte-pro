import React from 'react';
import { LayoutDashboard, Users, FileText, History, Boxes, PieChart, Zap } from 'lucide-react';
import { isTabAllowed } from '../utils/userMode';

type AppTab = 'batch' | 'clients' | 'products' | 'inventory' | 'factura' | 'historial' | 'fiscal' | 'micuenta' | 'simple' | 'simple-ccf';

interface NavigationTabsProps {
  activeTab: string;
  onTabChange: (tab: AppTab) => void;
  isMobile?: boolean;
}

const TABS_CONFIG = [
  { key: 'batch', label: 'Libros IVA', icon: LayoutDashboard, color: 'indigo' },
  { key: 'fiscal', label: 'Impuestos', icon: PieChart, color: 'emerald' },
  { key: 'clients', label: 'Clientes', icon: Users, color: 'blue' },
  { key: 'inventory', label: 'Inventario', icon: Boxes, color: 'amber' },
  { key: 'factura', label: 'Facturar', icon: FileText, color: 'green' },
  { key: 'historial', label: 'Historial', icon: History, color: 'purple' },
  { key: 'simple', label: 'Test DTE', icon: Zap, color: 'pink' },
  { key: 'simple-ccf', label: 'Test CCF', icon: Zap, color: 'orange' }
];

export const NavigationTabs: React.FC<NavigationTabsProps> = ({ 
  activeTab, 
  onTabChange, 
  isMobile = false 
}) => {
  // Filtrar pestañas según el modo de usuario
  const allowedTabs = TABS_CONFIG.filter(tab => isTabAllowed(tab.key));

  // Encontrar la primera pestaña permitida si la actual no está permitida (y no es micuenta)
  React.useEffect(() => {
    if (activeTab !== 'micuenta' && !isTabAllowed(activeTab) && allowedTabs.length > 0) {
      onTabChange(allowedTabs[0].key as AppTab);
    }
  }, [activeTab, allowedTabs, onTabChange]);

  const baseClasses = isMobile
    ? 'flex flex-col items-center justify-center flex-1 h-full transition-colors'
    : 'flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200';

  const activeClasses = isMobile
    ? 'text-'
    : 'bg-white text-';

  const inactiveClasses = isMobile
    ? 'text-gray-400'
    : 'text-gray-500 hover:text-gray-900';

  return (
    <>
      {allowedTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key as AppTab)}
            className={`${baseClasses} ${
              isActive 
                ? `${activeClasses}${tab.color}-600 ${isMobile ? 'scale-110' : 'shadow-sm'}` 
                : inactiveClasses
            }`}
          >
            <Icon className={`w-${isMobile ? '5' : '4'} h-${isMobile ? '5' : '4'} ${isActive && isMobile ? 'scale-110' : ''} transition-transform`} />
            {!isMobile && <span>{tab.label}</span>}
            {isMobile && <span className="text-[10px] mt-1 font-medium">{tab.label}</span>}
          </button>
        );
      })}
    </>
  );
};
