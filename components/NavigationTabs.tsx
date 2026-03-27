import React from 'react';
import { LayoutDashboard, Users, FileText, History, Boxes, PieChart, Zap } from 'lucide-react';
import { isTabAllowed } from '../utils/userMode';
import { isTabAllowedForRole, firstAllowedTab, Role, normalizeRole } from '../utils/roleAccess';
import { useEmisor } from '../contexts/EmisorContext';
import { BusinessSettings, DEFAULT_BUSINESS_SETTINGS, isManagedTabEnabled } from '../utils/businessSettings';
import { AppTab } from '../utils/appTabs';
import Tooltip from './Tooltip';

interface NavigationTabsProps {
  activeTab: string;
  onTabChange: (tab: AppTab) => void;
  isMobile?: boolean;
  businessSettings?: BusinessSettings;
}

const TABS_CONFIG = [
  { key: 'batch', label: 'Libros IVA', icon: LayoutDashboard, color: 'indigo' },
  { key: 'fiscal', label: 'Impuestos', icon: PieChart, color: 'emerald' },
  { key: 'clients', label: 'Clientes', icon: Users, color: 'blue' },
  { key: 'inventory', label: 'Inventario', icon: Boxes, color: 'amber' },
  { key: 'factura', label: 'Crédito Fiscal', icon: FileText, color: 'green', tooltip: 'Contribuyentes DTE-03' },
  { key: 'historial', label: 'Historial', icon: History, color: 'purple' },
  { key: 'simple', label: 'Test DTE', icon: Zap, color: 'pink' },
  { key: 'fe01', label: 'Factura 01', icon: FileText, color: 'sky', tooltip: 'Factura Electrónica 01 limpia' },
  { key: 'fe01v2', label: 'Factura 01 V2', icon: FileText, color: 'cyan', tooltip: 'Nueva variante separada de FE 01' },
  { key: 'ccftester', label: 'CCF Tester', icon: Zap, color: 'rose', tooltip: 'Payload limpio DTE-03' },
];

export const NavigationTabs: React.FC<NavigationTabsProps> = ({ 
  activeTab, 
  onTabChange, 
  isMobile = false,
  businessSettings = DEFAULT_BUSINESS_SETTINGS,
}) => {
  const { currentRole } = useEmisor();
  const role: Role = normalizeRole(currentRole);
  // Filtrar pestañas según el modo de usuario
  const allowedTabs = TABS_CONFIG.filter((tab) => (
    isTabAllowed(tab.key)
    && isTabAllowedForRole(tab.key, role)
    && isManagedTabEnabled(businessSettings, tab.key as AppTab)
  ));

  // Encontrar la primera pestaña permitida si la actual no está permitida (y no es micuenta)
  React.useEffect(() => {
    if (activeTab !== 'micuenta' && !allowedTabs.find((t) => t.key === activeTab) && allowedTabs.length > 0) {
      const next = firstAllowedTab(role, allowedTabs[0].key, allowedTabs.map((t) => t.key));
      onTabChange(next as AppTab);
    }
  }, [activeTab, allowedTabs, onTabChange, role]);

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
        
        const button = (
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

        if (!tab.tooltip || isMobile) {
          return button;
        }

        return (
          <Tooltip key={tab.key} content={tab.tooltip} position="bottom">
            {button}
          </Tooltip>
        );
      })}
    </>
  );
};
