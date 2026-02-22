import React, { useState, useEffect, useRef } from 'react';
import { Download, Bell, Shield, Key, Store, Upload } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { downloadBackup, restoreBackupFromText } from '../utils/backup';
import { loadSettings } from '../utils/settings';
import { getEmisor } from '../utils/emisorDb';
import { getCertificate } from '../utils/secureStorage';
import { notify } from '../utils/notifications';
import { Settings } from 'lucide-react';
import { EmisorConfigModal } from './EmisorConfigModal';
import { useCertificateManager } from '../hooks/useCertificateManager';
import { EmisorData } from '../utils/emisorDb';

interface MiCuentaProps {
  onBack?: () => void;
}

const MiCuenta: React.FC<MiCuentaProps> = ({ onBack }) => {
  const { isSupported, permission, requestPermission, subscribeToPush, unsubscribeFromPush } = usePushNotifications();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showEmisorConfig, setShowEmisorConfig] = useState(false);
  const [emisorForm, setEmisorForm] = useState<Omit<EmisorData, 'id'>>({
    nit: '',
    nrc: '',
    nombre: '',
    nombreComercial: '',
    actividadEconomica: '',
    descActividad: '',
    tipoEstablecimiento: '',
    departamento: '',
    municipio: '',
    direccion: '',
    telefono: '',
    correo: '',
    codEstableMH: null,
    codPuntoVentaMH: null
  });
  const [isSavingEmisor, setIsSavingEmisor] = useState(false);

  const {
    apiPassword,
    certificatePassword,
    showCertPassword,
    certificateError,
    isSavingCert,
    certificateFile,
    setApiPassword,
    setCertificatePassword,
    setShowCertPassword,
    handleCertFileSelect,
    handleSaveCertificate,
    fileInputRef
  } = useCertificateManager({ 
    onToast: (msg, type) => notify(msg, type)
  });

  const [businessData, setBusinessData] = useState({
    nombre: '',
    nit: '',
    ambiente: '00'
  });
  const [credentialsStatus, setCredentialsStatus] = useState({
    hasCert: false,
    hasPassword: false
  });
  
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Cargar estado inicial
    const dismissed = localStorage.getItem('push-notification-dismissed');
    setNotificationsEnabled(permission === 'granted' && dismissed !== 'true');

    // Cargar datos de negocio desde IndexedDB (fuente de verdad principal)
    const loadEmisorData = async () => {
      try {
        const emisor = await getEmisor();
        const settings = loadSettings();
        const storedAmbiente = localStorage.getItem('dte_ambiente') || '00';
        
        if (emisor) {
          setBusinessData({
            nombre: emisor.nombreComercial || emisor.nombre || 'Empresa No Configurada',
            nit: emisor.nit || 'No definido',
            ambiente: storedAmbiente
          });
        } else {
          // Fallback a localStorage si no hay en DB
          setBusinessData({
            nombre: localStorage.getItem('emisor_nombre') || 'Empresa No Configurada',
            nit: settings.myNit || localStorage.getItem('emisor_nit') || 'No definido',
            ambiente: storedAmbiente
          });
        }
      } catch (err) {
        console.error('Error cargando datos del emisor:', err);
      }
    };
    
    loadEmisorData();

    // Cargar estado de credenciales desde IndexedDB (secureStorage)
    const loadCredentials = async () => {
      try {
        const cert = await getCertificate();
        setCredentialsStatus({ 
          hasCert: !!cert?.certificate, 
          hasPassword: !!cert?.password 
        });
      } catch (err) {
        console.error('Error cargando credenciales:', err);
      }
    };

    loadCredentials();
  }, [permission, showEmisorConfig]);

  const loadEmisorParaConfig = async () => {
    try {
      const emisor = await getEmisor();
      if (emisor) {
        const { id, ...rest } = emisor;
        setEmisorForm(rest);
      }
    } catch (err) {
      console.error('Error cargando emisor para form:', err);
    }
  };

  const handleOpenConfig = () => {
    loadEmisorParaConfig();
    setShowEmisorConfig(true);
  };

  const handleSaveEmisor = async () => {
    setIsSavingEmisor(true);
    try {
      const { saveEmisor } = await import('../utils/emisorDb');
      await saveEmisor(emisorForm);
      notify('Datos del emisor guardados', 'success');
      setShowEmisorConfig(false);
    } catch (error) {
      console.error(error);
      notify('Error guardando emisor', 'error');
    } finally {
      setIsSavingEmisor(false);
    }
  };

  const handleNotificationToggle = async (checked: boolean) => {
    if (checked) {
      if (permission === 'default') {
        const granted = await requestPermission();
        if (granted) {
          localStorage.removeItem('push-notification-dismissed');
          setNotificationsEnabled(true);
          await subscribeToPush();
        }
      } else if (permission === 'granted') {
        localStorage.removeItem('push-notification-dismissed');
        setNotificationsEnabled(true);
        await subscribeToPush();
      } else {
        alert('Debes habilitar las notificaciones en la configuración de tu navegador.');
      }
    } else {
      localStorage.setItem('push-notification-dismissed', 'true');
      setNotificationsEnabled(false);
      await unsubscribeFromPush();
    }
  };

  const handleExportBackup = async () => {
    try {
      await downloadBackup();
      notify('Backup exportado exitosamente', 'success');
    } catch (e) {
      notify('Error al exportar el backup', 'error');
      console.error(e);
    }
  };

  const handleRestoreBackup = () => {
    if (restoreFileInputRef.current) {
      restoreFileInputRef.current.click();
    }
  };

  const handleRestoreBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await restoreBackupFromText(text);
      notify('Backup restaurado exitosamente. Recargando...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error(err);
      notify('Error al restaurar el backup. Verifica el archivo.', 'error');
    } finally {
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mi Cuenta</h1>
        {onBack && (
          <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium md:hidden">
            Volver
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Información del Negocio */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900">Información del Negocio</h2>
            </div>
            <button
              onClick={handleOpenConfig}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configurar
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold">Nombre Comercial</label>
              <p className="text-gray-900 font-medium">{businessData.nombre}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold">NIT</label>
              <p className="text-gray-900 font-medium">{businessData.nit}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold">Ambiente</label>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  businessData.ambiente === '01' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {businessData.ambiente === '01' ? 'Producción' : 'Pruebas'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Estado de Credenciales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
            <Shield className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-medium text-gray-900">Estado de Credenciales</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Certificado Digital</span>
              </div>
              <span className={`text-sm font-medium ${credentialsStatus.hasCert ? 'text-green-600' : 'text-red-600'}`}>
                {credentialsStatus.hasCert ? '✅ Cargado' : '❌ No cargado'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Contraseña</span>
              </div>
              <span className={`text-sm font-medium ${credentialsStatus.hasPassword ? 'text-green-600' : 'text-red-600'}`}>
                {credentialsStatus.hasPassword ? '✅ Configurada' : '❌ No configurada'}
              </span>
            </div>
          </div>
        </div>

        {/* Notificaciones */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900">Notificaciones</h2>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={notificationsEnabled}
                onChange={(e) => handleNotificationToggle(e.target.checked)}
                disabled={!isSupported}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600">
              Recibe alertas importantes sobre mantenimiento, actualizaciones y estado del sistema.
            </p>
            {!isSupported && (
              <p className="mt-2 text-xs text-red-500">Tu navegador no soporta notificaciones.</p>
            )}
            {permission === 'denied' && (
              <p className="mt-2 text-xs text-orange-500">Permiso bloqueado. Debes habilitarlo en tu navegador.</p>
            )}
          </div>
        </div>

        {/* Backup / Restaurar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
            <Download className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-medium text-gray-900">Copia de Seguridad</h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Guarda o restaura tu configuración y datos locales.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleExportBackup}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Download className="w-4 h-4" />
                Descargar Backup
              </button>
              
              <input
                ref={restoreFileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleRestoreBackupFile}
              />
              <button
                onClick={handleRestoreBackup}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-indigo-600 shadow-sm text-sm font-medium rounded-lg text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Upload className="w-4 h-4" />
                Restaurar Backup
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEmisorConfig && (
        <EmisorConfigModal
          isOpen={showEmisorConfig}
          onClose={() => setShowEmisorConfig(false)}
          emisorForm={emisorForm}
          setEmisorForm={setEmisorForm}
          nitValidation={{ isValid: true, message: '' }} // Basic mock for validation
          nrcValidation={{ isValid: true, message: '' }}
          telefonoValidation={{ isValid: true, message: '' }}
          correoValidation={{ isValid: true, message: '' }}
          formatTextInput={(v) => v}
          formatMultilineTextInput={(v) => v}
          handleSaveEmisor={handleSaveEmisor}
          isSavingEmisor={isSavingEmisor}
          apiPassword={apiPassword}
          certificatePassword={certificatePassword}
          showCertPassword={showCertPassword}
          certificateError={certificateError}
          isSavingCert={isSavingCert}
          certificateFile={certificateFile}
          setApiPassword={setApiPassword}
          setCertificatePassword={setCertificatePassword}
          setShowCertPassword={setShowCertPassword}
          handleCertFileSelect={handleCertFileSelect}
          handleSaveCertificate={() => handleSaveCertificate(emisorForm.nit, emisorForm.nrc)}
          fileInputRef={fileInputRef}
        />
      )}
    </div>
  );
};

export default MiCuenta;
