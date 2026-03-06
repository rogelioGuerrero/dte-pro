import React, { useState, useEffect, useRef } from 'react';
import { Download, Bell, Shield, Key, Store, Upload } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { downloadBackup, restoreBackupFromText } from '../utils/backup';
import { notify } from '../utils/notifications';
import { Settings } from 'lucide-react';
import { EmisorConfigModal } from './EmisorConfigModal';
import { useCertificateManager } from '../hooks/useCertificateManager';
import { EmisorData } from '../utils/emisorDb';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useEmisor } from '../contexts/EmisorContext';
import { normalizeRole } from '../utils/roleAccess';
import { TeamPanel } from './TeamPanel';
import { AuthGate } from './AuthGate';
import { apiFetch } from '../utils/apiClient';

interface MiCuentaProps {
  onBack?: () => void;
}

const MiCuenta: React.FC<MiCuentaProps> = ({ onBack }) => {
  const { isSupported, permission, requestPermission, subscribeToPush, unsubscribeFromPush } = usePushNotifications();
  const { user, session } = useAuth();
  const { businessId, currentRole, reload: reloadEmisores, setBusinessId } = useEmisor();
  const normalizedRole = normalizeRole(currentRole);
  const canManage = normalizedRole === 'owner' || normalizedRole === 'admin';
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showEmisorConfig, setShowEmisorConfig] = useState(false);
  const [showAssociateEmisor, setShowAssociateEmisor] = useState(false);
  const [associateMode, setAssociateMode] = useState<'create' | 'claim'>('create');
  const [associateBusinessId, setAssociateBusinessId] = useState('');
  const [associateNombre, setAssociateNombre] = useState('');
  const [isAssociating, setIsAssociating] = useState(false);
  const [emisorForm, setEmisorForm] = useState<Omit<EmisorData, 'id'> & { logoUrl?: string }>({
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
    codPuntoVentaMH: null,
    logoUrl: ''
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

    const loadBusinessFromSupabase = async () => {
      if (!user || !businessId) {
        setBusinessData({ nombre: 'Sin emisor', nit: 'No definido', ambiente: localStorage.getItem('dte_ambiente') || '00' });
        setCredentialsStatus({ hasCert: false, hasPassword: false });
        return;
      }

      const storedAmbiente = localStorage.getItem('dte_ambiente') || '00';
      const { data, error } = await supabase
        .from('businesses')
        .select('id, nombre, nombre_comercial, correo, telefono, nrc, dir_departamento, dir_municipio, dir_complemento')
        .eq('id', businessId)
        .maybeSingle();

      if (error) {
        console.error('Error cargando negocio:', error);
        notify('No se pudo cargar el emisor', 'error');
        return;
      }

      if (data) {
        setBusinessData({
          nombre: data.nombre_comercial || data.nombre || 'Empresa No Configurada',
          nit: data.id,
          ambiente: storedAmbiente
        });
        setEmisorForm((prev) => ({
          ...prev,
          nombre: data.nombre || '',
          nombreComercial: data.nombre_comercial || '',
          correo: data.correo || '',
          telefono: data.telefono || '',
          nrc: data.nrc || '',
          departamento: data.dir_departamento || '',
          municipio: data.dir_municipio || '',
          direccion: data.dir_complemento || ''
        }));
      }
    };

    const loadCredentialsFromSupabase = async () => {
      if (!businessId) {
        setCredentialsStatus({ hasCert: false, hasPassword: false });
        return;
      }
      const { data, error } = await supabase
        .from('mh_credentials')
        .select('certificate_b64, password_pri')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error) {
        console.error('Error cargando credenciales MH:', error);
        return;
      }

      setCredentialsStatus({
        hasCert: !!data?.certificate_b64,
        hasPassword: !!data?.password_pri,
      });
    };
    
    loadBusinessFromSupabase();
    loadCredentialsFromSupabase();
  }, [permission, showEmisorConfig, businessId, user]);

  const handleOpenConfig = () => {
    setShowEmisorConfig(true);
  };

  const handleAssociateEmisor = async () => {
    setIsAssociating(true);
    try {
      const payload = {
        business_id: associateBusinessId.trim(),
        nombre: associateNombre.trim(),
      };

      const json = associateMode === 'create'
        ? await apiFetch<any>('/api/business/businesses', { method: 'POST', body: payload })
        : await apiFetch<any>('/api/business/business_users/claim', { method: 'POST', body: { business_id: associateBusinessId.trim() } });

      const newBusinessId =
        (json && typeof json.business_id === 'string' && json.business_id) ||
        (json && json.businessUser && typeof json.businessUser.business_id === 'string' && json.businessUser.business_id) ||
        null;

      await reloadEmisores();
      if (newBusinessId) {
        setBusinessId(newBusinessId);
      }

      notify(associateMode === 'create' ? 'Emisor creado y asociado' : 'Emisor asociado', 'success');
      setShowAssociateEmisor(false);
      setAssociateBusinessId('');
      setAssociateNombre('');
    } catch (err: any) {
      console.error(err);
      notify(err?.message || 'No se pudo asociar el emisor', 'error');
    } finally {
      setIsAssociating(false);
    }
  };

  const handleSaveEmisor = async () => {
    if (!businessId) {
      notify('Selecciona un emisor para actualizar', 'error');
      return;
    }

    setIsSavingEmisor(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: emisorForm.nombre?.trim() || null,
        nombre_comercial: emisorForm.nombreComercial?.trim() || null,
        correo: emisorForm.correo?.trim() || null,
        telefono: emisorForm.telefono?.trim() || null,
        nrc: emisorForm.nrc?.trim() || null,
        dir_departamento: emisorForm.departamento?.trim() || null,
        dir_municipio: emisorForm.municipio?.trim() || null,
        dir_complemento: emisorForm.direccion?.trim() || null,
        logo_url: emisorForm.logoUrl?.trim() || null,
      };

      const { error } = await supabase
        .from('businesses')
        .update(payload)
        .eq('id', businessId);

      if (error) {
        throw error;
      }

      notify('Datos del emisor guardados', 'success');
      setShowEmisorConfig(false);
      setBusinessData((prev) => ({ ...prev, nombre: payload.nombre_comercial as string || payload.nombre as string || prev.nombre }));
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

  if (!session) {
    return (
      <AuthGate>
        <div />
      </AuthGate>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Cuenta</h1>
          <p className="text-sm text-gray-600 mt-1">Configura tu negocio y habilita la transmisión.</p>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium md:hidden">
            Volver
          </button>
        )}
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Estado de configuración</p>
            <p className="text-sm text-gray-600">
              {businessId ? 'Emisor seleccionado: puedes configurar datos y credenciales.' : 'Aún no hay emisor asociado a tu cuenta.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleOpenConfig}
              disabled={!businessId || !canManage}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <Settings className="w-4 h-4" />
              Configurar emisor
            </button>
            <button
              onClick={() => setShowAssociateEmisor(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50"
            >
              <Store className="w-4 h-4" />
              Asociar emisor
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase">1. Emisor</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{businessId ? 'Listo para configurar' : 'Pendiente'}</p>
            <p className="text-xs text-gray-600 mt-1">{businessId ? 'Datos del negocio y códigos MH.' : 'Vincula un emisor a tu cuenta.'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase">2. Credenciales</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {credentialsStatus.hasCert && credentialsStatus.hasPassword ? 'Listo' : 'Pendiente'}
            </p>
            <p className="text-xs text-gray-600 mt-1">Certificado y contraseña para firma/transmisión.</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase">3. Equipo</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{businessId ? 'Disponible' : 'Pendiente'}</p>
            <p className="text-xs text-gray-600 mt-1">Roles y usuarios por emisor.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Store className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-medium text-gray-900">Negocio</h2>
              </div>
              {canManage ? (
                <button
                  onClick={handleOpenConfig}
                  disabled={!businessId}
                  className="text-indigo-700 hover:text-indigo-800 text-sm font-medium flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  <Settings className="w-4 h-4" />
                  Editar
                </button>
              ) : (
                <span className="text-xs text-gray-500">Solo lectura (rol {normalizedRole || 'sin rol'})</span>
              )}
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Nombre</label>
                <p className="text-gray-900 font-medium mt-1">{businessData.nombre}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">NIT</label>
                <p className="text-gray-900 font-medium mt-1">{businessData.nit}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Ambiente</label>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    businessData.ambiente === '01' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {businessData.ambiente === '01' ? 'Producción' : 'Pruebas'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {businessId ? (
            <TeamPanel />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-600">
              Selecciona o asocia un emisor para ver y gestionar el equipo.
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
              <Shield className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900">Credenciales</h2>
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
              <p className="text-xs text-gray-500">Se configuran dentro de “Configurar emisor”.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
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
              <p className="text-sm text-gray-600">Recibe alertas importantes sobre mantenimiento y estado del sistema.</p>
              {!isSupported && <p className="mt-2 text-xs text-red-500">Tu navegador no soporta notificaciones.</p>}
              {permission === 'denied' && <p className="mt-2 text-xs text-orange-500">Permiso bloqueado. Debes habilitarlo en tu navegador.</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
              <Download className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900">Copia de seguridad</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Guarda o restaura tu configuración y datos locales.</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleExportBackup}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Download className="w-4 h-4" />
                  Descargar
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
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-indigo-600 shadow-sm text-sm font-medium rounded-xl text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Upload className="w-4 h-4" />
                  Restaurar
                </button>
              </div>
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
          handleSaveCertificate={(nit, nrc, ambiente) =>
            handleSaveCertificate({ nit, nrc }, ambiente || businessData.ambiente)
          }
          fileInputRef={fileInputRef}
        />
      )}

      {showAssociateEmisor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Asociar emisor</h3>
              <button
                type="button"
                onClick={() => setShowAssociateEmisor(false)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cerrar
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssociateMode('create')}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border ${associateMode === 'create' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                >
                  Crear nuevo
                </button>
                <button
                  type="button"
                  onClick={() => setAssociateMode('claim')}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border ${associateMode === 'claim' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                >
                  Asociar existente
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">NIT o UUID del emisor</label>
                <input
                  type="text"
                  value={associateBusinessId}
                  onChange={(e) => setAssociateBusinessId(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="0614-... o UUID"
                />
              </div>

              {associateMode === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre comercial</label>
                  <input
                    type="text"
                    value={associateNombre}
                    onChange={(e) => setAssociateNombre(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="Mi Tienda"
                  />
                </div>
              )}

              <p className="text-xs text-gray-500">
                {associateMode === 'create'
                  ? 'Crea un negocio nuevo y te lo asigna como owner.'
                  : 'Asocia un negocio existente a tu cuenta (según reglas del backend).'}
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAssociateEmisor(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!associateBusinessId.trim() || isAssociating || (associateMode === 'create' && !associateNombre.trim())}
                onClick={handleAssociateEmisor}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {isAssociating ? 'Guardando...' : associateMode === 'create' ? 'Crear y asociar' : 'Asociar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MiCuenta;
