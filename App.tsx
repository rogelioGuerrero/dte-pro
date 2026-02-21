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
import { LicenseManager } from './components/LicenseManager';
import { MagicLicenseActivator } from './components/MagicLicenseActivator';
import { LicenseStatus } from './components/LicenseStatus';
import { UserModeSetup } from './components/UserModeSetup';
import { shouldShowUserModeSelection } from './utils/remoteLicensing';
import { licenseValidator } from './utils/licenseValidator';
import { NavigationTabs } from './components/NavigationTabs';
import { LayoutDashboard, CheckCircle, Download } from 'lucide-react';
import { downloadBackup, restoreBackupFromText } from './utils/backup';
import { notify } from './utils/notifications';
import ForceUpdateModal from './components/ForceUpdateModal';

type AppTab = 'batch' | 'clients' | 'products' | 'inventory' | 'factura' | 'historial' | 'fiscal';

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
  const [showBackupMenu, setShowBackupMenu] = useState(false);
  const [forceUpdateInfo, setForceUpdateInfo] = useState<{ minVersion: string; message?: string } | null>(null);
  // TODO: Implementar modal de restauración
  // const [showRestoreModal, setShowRestoreModal] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);
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

  // Ejecutar backup automático mensual (deshabilitado)
  // useEffect(() => {
  //   createMonthlyAutoBackup();
  // }, []);

  // Compatibilidad: si alguien quedó en la pestaña antigua de Productos, redirigir a Inventario
  useEffect(() => {
    if (activeTab === 'products') setActiveTab('inventory');
  }, [activeTab]);

  // Cerrar dropdown de backup al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showBackupMenu) {
        const target = event.target as Element;
        if (!target.closest('.backup-dropdown')) {
          setShowBackupMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBackupMenu]);

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

  const handleExportBackup = () => {
    setShowBackupMenu(false);
    (async () => {
      try {
        await downloadBackup();
        notify('Backup descargado', 'success');
      } catch (e: any) {
        notify(e?.message || 'No se pudo descargar el backup', 'error');
      }
    })();
  };

  const handleRestoreBackup = () => {
    setShowBackupMenu(false);
    const ok = confirm('Restaurar un backup reemplazará los datos locales (inventario, clientes, historial y configuración). ¿Continuar?');
    if (!ok) return;
    restoreFileInputRef.current?.click();
  };

  const handleRestoreBackupFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      await restoreBackupFromText(text);
      notify('Backup restaurado. Recargando...', 'success');
      setTimeout(() => window.location.reload(), 400);
    } catch (e: any) {
      notify(e?.message || 'No se pudo restaurar el backup', 'error');
    }
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
          </div>
          
          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Backup Button */}
            <div className="relative backup-dropdown">
              <input
                ref={restoreFileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleRestoreBackupFile}
              />
              <button
                onClick={() => setShowBackupMenu(!showBackupMenu)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Backup</span>
              </button>
              
              {/* Backup Dropdown */}
              {showBackupMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] z-50">
                  <button
                    onClick={handleExportBackup}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Descargar Backup
                  </button>
                  <button
                    onClick={handleRestoreBackup}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Restaurar Backup
                  </button>
                </div>
              )}
            </div>
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
    </div>
  );
};

export default App;
