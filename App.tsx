import React, { useState, useRef, useEffect } from 'react';
import BatchDashboard from './components/BatchDashboard';
import FiscalDashboard from './components/dashboard/FiscalDashboard';
import ClientManager from './components/ClientManager';
import SistemaInventario from './components/inventario/SistemaInventario';
import FacturaGenerator from './components/FacturaGenerator';
import DTEDashboard from './components/DTEDashboard';
import AdminModal from './components/AdminModal';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import ClientFormPage from './components/ClientFormPage';
import GlobalToastHost from './components/GlobalToastHost';
import PushNotificationManager from './components/PushNotificationManager';
import { LicenseManager } from './components/LicenseManager';
import { MagicLicenseActivator } from './components/MagicLicenseActivator';
import { LicenseStatus } from './components/LicenseStatus';
import { UserModeSetup } from './components/UserModeSetup';
import { shouldShowUserModeSelection } from './utils/remoteLicensing';
import { licenseValidator } from './utils/licenseValidator';
import { NavigationTabs } from './components/NavigationTabs';
import { LayoutDashboard, CheckCircle } from 'lucide-react';
import ForceUpdateModal from './components/ForceUpdateModal';
import { usePushNotifications } from './hooks/usePushNotifications';
import MiCuenta from './components/MiCuenta';

type AppTab = 'batch' | 'clients' | 'products' | 'inventory' | 'factura' | 'historial' | 'fiscal' | 'micuenta';

// Detectar si estamos en la pagina publica del cliente
const isClientFormPage = (): boolean => {
  return window.location.pathname === '/cliente';
};

const getVendorIdFromUrl = (): string | undefined => {
  const params = new URLSearchParams(window.location.search);
  return params.get('v') || undefined;
};

const App: React.FC = () => {

  // Si estamos en /cliente, mostrar solo el formulario publico
  if (isClientFormPage()) {
    return (
      <>
        <ClientFormPage vendorId={getVendorIdFromUrl()} />
        <GlobalToastHost />
      </>
    );
  }

  const [activeTab, setActiveTab] = useState<AppTab>('factura');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showLicenseManager, setShowLicenseManager] = useState(false);
  const [showUserModeSetup, setShowUserModeSetup] = useState(false);
  const [forceUpdateInfo, setForceUpdateInfo] = useState<{ minVersion: string; message?: string } | null>(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readForceUpdateInfo = () => {
    try {
      const raw = localStorage.getItem('dte_force_update');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.required || !parsed?.minVersion) return null;
      return { minVersion: String(parsed.minVersion), message: parsed.message ? String(parsed.message) : undefined };
    } catch {
      return null;
    }
  };

  // Escuchar bandera de actualización forzada
  useEffect(() => {
    const apply = () => {
      const info = readForceUpdateInfo();
      setForceUpdateInfo(info);
    };

    apply();

    const onForceUpdate = () => apply();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dte_force_update') apply();
    };

    window.addEventListener('dte-force-update', onForceUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('dte-force-update', onForceUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Verificar si es primera vez que se usa la app o si se activó licenciamiento
  useEffect(() => {
    const checkSetup = async () => {
      const hasCompletedSetup = localStorage.getItem('dte_setup_completed');
      const shouldShow = await shouldShowUserModeSelection();
      
      if (!hasCompletedSetup || shouldShow) {
        setShowUserModeSetup(true);
      }
    };
    
    checkSetup();
  }, []);

  // Inicializar licencia al cargar la app
  useEffect(() => {
    licenseValidator.loadLicenseFromStorage();
  }, []);

  // Inicializar push notifications
  const { isSupported, permission, subscribeToPush } = usePushNotifications();
  
  useEffect(() => {
    if (isSupported && permission === 'granted') {
      // Auto-suscribir si ya tiene permiso
      subscribeToPush();
    }
  }, [isSupported, permission, subscribeToPush]);

  // Ejecutar backup automático mensual (deshabilitado)
  // useEffect(() => {
  //   createMonthlyAutoBackup();
  // }, []);

  // Compatibilidad: si alguien quedó en la pestaña antigua de Productos, redirigir a Inventario
  useEffect(() => {
    if (activeTab === 'products') setActiveTab('inventory');
  }, [activeTab]);

  // Cerrar dropdown de backup al hacer clic fuera (obsoleto, removido menú de backup)
  useEffect(() => {
    // Empty effect to satisfy hooks rules if needed, or we could remove it. 
    // I'll remove the code inside since showBackupMenu is gone.
  }, []);

  const handleLogoClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1500);
    if (clickCountRef.current >= 5) {
      clickCountRef.current = 0;
      setShowAdminModal(true);
    }
  };

  const handleSetupComplete = () => {
    localStorage.setItem('dte_setup_completed', 'true');
    setShowUserModeSetup(false);
  };

  // Si está en modo setup, mostrar pantalla completa
  if (showUserModeSetup) {
    return <UserModeSetup onComplete={handleSetupComplete} />;
  }

  // Actualización requerida: bloquear el uso de la app hasta recargar
  if (forceUpdateInfo) {
    return (
      <>
        <ForceUpdateModal
          isOpen={true}
          minVersion={forceUpdateInfo.minVersion}
          message={forceUpdateInfo.message}
          onReload={() => window.location.reload()}
        />
        <GlobalToastHost />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans text-slate-900">
      
      {/* Global Header - Desktop */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-2 md:space-x-3 cursor-pointer select-none" onClick={handleLogoClick}>
            <div className={`p-1.5 md:p-2 rounded-lg md:rounded-xl shadow-md transition-colors duration-500 ${
                activeTab === 'batch' ? 'bg-indigo-600 shadow-indigo-200' : 
                activeTab === 'clients' ? 'bg-blue-600 shadow-blue-200' : 
                'bg-green-600 shadow-green-200'
              }`}>
              <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">
              DTE <span className={`hidden sm:inline ${
                activeTab === 'batch' ? 'text-indigo-600' : 
                activeTab === 'clients' ? 'text-blue-600' : 
                'text-green-600'
              }`}>Pro</span>
            </h1>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center p-1 bg-gray-100/80 rounded-xl">
            <NavigationTabs 
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isMobile={false}
            />
          </nav>
          
          {/* Mobile: Current tab indicator */}
          <div className="md:hidden text-sm font-medium text-gray-600">
            {activeTab === 'batch' && 'Libros IVA'}
            {activeTab === 'clients' && 'Clientes'}
            {activeTab === 'inventory' && 'Inventario'}
            {activeTab === 'factura' && 'Facturar'}
            {activeTab === 'historial' && 'Historial'}
            {activeTab === 'micuenta' && 'Mi Cuenta'}
          </div>
          
          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Mi Cuenta Button */}
            <button
              onClick={() => setActiveTab('micuenta' as AppTab)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'micuenta'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-xs font-bold text-indigo-600">
                  {localStorage.getItem('emisor_nombre')?.charAt(0) || 'U'}
                </span>
              </div>
              <span className="hidden sm:inline">Mi Cuenta</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area - with bottom padding for mobile nav */}
      <main className="flex-grow px-3 sm:px-6 lg:px-8 py-4 md:py-10 pb-20 md:pb-10">
        <LicenseStatus onManageLicense={() => setShowLicenseManager(true)} />
        {activeTab === 'batch' && <BatchDashboard />}
        {activeTab === 'fiscal' && <FiscalDashboard />}
        {activeTab === 'clients' && <ClientManager />}
        {activeTab === 'inventory' && <SistemaInventario />}
        {activeTab === 'factura' && <FacturaGenerator />}
        {activeTab === 'historial' && <DTEDashboard />}
        {activeTab === 'micuenta' && <MiCuenta onBack={() => setActiveTab('factura')} />}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          <NavigationTabs 
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isMobile={true}
          />
        </div>
      </nav>

      <footer className="hidden md:block border-t border-gray-200 mt-auto bg-white/50">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex justify-between items-center gap-4">
          <div className="flex flex-col space-y-1">
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} Facturas DTE Pro.
            </p>
            <p className="text-xs text-gray-400">
              Formato diseñado para ser compatible con los lineamientos del Ministerio de Hacienda de El Salvador.
              <br />
              Revisa siempre tus archivos en{' '}
              <a
                href="https://factura.gob.sv/"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted text-indigo-500 hover:text-indigo-600"
                title="Ir al sitio oficial del Ministerio de Hacienda (factura.gob.sv) para consultar normativa y validar tus DTE."
              >
                factura.gob.sv
              </a>{' '}
              antes de presentarlos.
            </p>
          </div>
          <div className="flex flex-col space-y-1 items-end">
            <div className="flex items-center space-x-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
               <CheckCircle className="w-3 h-3" />
               <span>100% Seguro & Privado</span>
            </div>
            <div className="text-xs text-gray-400">
              v{import.meta.env.VITE_APP_VERSION || '1.0.0'}
            </div>
          </div>
        </div>
      </footer>
      <AdminModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} />
      {showLicenseManager && (
        <LicenseManager 
          onClose={() => setShowLicenseManager(false)}
          onLicenseValid={() => {
            // Opcional: recargar componentes o actualizar estado
            window.location.reload();
          }}
        />
      )}
      <MagicLicenseActivator />
      <PWAInstallPrompt />
      <GlobalToastHost />
      <PushNotificationManager />
    </div>
  );
};

export default App;
