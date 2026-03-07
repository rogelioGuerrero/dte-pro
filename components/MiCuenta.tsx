import React, { useState, useEffect, useRef } from 'react';
import { Download, Bell, Shield, Key, Store, Upload, LogOut, UserRound } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { downloadBackup, restoreBackupFromText } from '../utils/backup';
import { notify } from '../utils/notifications';
import { Settings } from 'lucide-react';
import { EmisorConfigModal } from './EmisorConfigModal';
import { useCertificateManager } from '../hooks/useCertificateManager';
import { EmisorData } from '../utils/emisorDb';
import { useEmisor } from '../contexts/EmisorContext';
import { getEmisor, saveEmisor } from '../utils/emisorDb';
import { hasCertificate } from '../utils/secureStorage';
import { DeviceFingerprintDisplay } from './DeviceFingerprintDisplay';
import { apiFetch } from '../utils/apiClient';
import { TeamPanel } from './TeamPanel';
import { useAuth } from '../contexts/AuthContext';
import { APP_TAB_LABELS, MANAGED_APP_TABS, ManagedAppTab } from '../utils/appTabs';
import { BusinessSettings, normalizeBusinessSettings, saveBusinessSettingsToBackend } from '../utils/businessSettings';
import { EmisorSelector } from './EmisorSelector';

interface MiCuentaProps {
  onBack?: () => void;
  onOpenAdvancedSettings?: () => void;
  businessSettings?: BusinessSettings;
  onBusinessSettingsChange?: (updater: (current: BusinessSettings) => BusinessSettings) => void;
}

const MiCuenta: React.FC<MiCuentaProps> = ({ onBack, onOpenAdvancedSettings, businessSettings, onBusinessSettingsChange }) => {
  const { isSupported, permission, subscription, requestPermission, subscribeToPush, unsubscribeFromPush } = usePushNotifications();
  const { user, isConfigured, signOut } = useAuth();
  const { businessId, operationalBusinessId, emisores, reload, currentRole, setBusinessId, selectedEmisor } = useEmisor();
  const isPlatformAdmin = Boolean(user && businessId && !currentRole);
  const canManageLocal = currentRole === 'owner' || currentRole === 'admin' || isPlatformAdmin || !currentRole;
  const canManageRemote = (currentRole === 'owner' || currentRole === 'admin' || isPlatformAdmin) && Boolean(operationalBusinessId);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showEmisorConfig, setShowEmisorConfig] = useState(false);
  const [manualBusinessId, setManualBusinessId] = useState('');
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
  const [remoteDraft, setRemoteDraft] = useState<BusinessSettings | null>(businessSettings || null);
  const [isSavingRemoteSettings, setIsSavingRemoteSettings] = useState(false);
  
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRemoteDraft(businessSettings || null);
  }, [businessSettings]);

  useEffect(() => {
    setManualBusinessId(businessId || '');
  }, [businessId]);

  const handleSignOut = async () => {
    try {
      await signOut();
      notify('Sesión cerrada correctamente', 'success');
    } catch (error) {
      console.error(error);
      notify('No se pudo cerrar sesión', 'error');
    }
  };

  const handleRemoteFeatureToggle = (tab: ManagedAppTab, enabled: boolean) => {
    setRemoteDraft((current) => {
      if (!current) return current;
      const nextFeatures = {
        ...current.features,
        [tab]: enabled,
      };
      const defaultStillVisible = nextFeatures[current.defaultTab];
      const nextDefaultTab = defaultStillVisible
        ? current.defaultTab
        : MANAGED_APP_TABS.find((candidate) => nextFeatures[candidate]) || 'factura';

      return normalizeBusinessSettings({
        ...current,
        features: nextFeatures,
        defaultTab: nextDefaultTab,
      });
    });
  };

  const handleRemoteDefaultTabChange = (tab: ManagedAppTab) => {
    setRemoteDraft((current) => current ? normalizeBusinessSettings({ ...current, defaultTab: tab }) : current);
  };

  const handleRemoteSave = async () => {
    if (!remoteDraft || !operationalBusinessId || !onBusinessSettingsChange) return;

    setIsSavingRemoteSettings(true);
    try {
      const normalized = normalizeBusinessSettings({
        ...remoteDraft,
        businessId: operationalBusinessId,
        source: 'remote',
      });
      const saved = await saveBusinessSettingsToBackend(normalized);
      onBusinessSettingsChange(() => saved);
      setRemoteDraft(saved);
      notify('Configuración remota del negocio actualizada', 'success');
    } catch (error) {
      console.error(error);
      notify('No se pudo guardar la configuración remota del negocio', 'error');
    } finally {
      setIsSavingRemoteSettings(false);
    }
  };

  useEffect(() => {
    // Cargar estado inicial
    const dismissed = localStorage.getItem('push-notification-dismissed');
    setNotificationsEnabled(permission === 'granted' && dismissed !== 'true');

    const loadLocal = async () => {
      const storedAmbiente = localStorage.getItem('dte_ambiente') || '00';
      const localEmisor = await getEmisor();

      if (operationalBusinessId) {
        try {
          const remote = await apiFetch<{ success: boolean; business: {
            id: string;
            nit?: string;
            nombre?: string;
            nombre_comercial?: string;
            telefono?: string;
            correo?: string;
            dir_departamento?: string;
            dir_municipio?: string;
            dir_complemento?: string;
            cod_actividad?: string;
            desc_actividad?: string;
            tipo_establecimiento?: string | null;
            cod_estable_mh?: string | null;
            cod_punto_venta_mh?: string | null;
            nrc?: string;
            logo_url?: string | null;
          } }>(`/api/business/businesses/${operationalBusinessId}`);

          setBusinessData({
            nombre: remote.business.nombre_comercial || remote.business.nombre || selectedEmisor?.nombre || 'Empresa',
            nit: remote.business.nit || 'No definido',
            ambiente: storedAmbiente,
          });

          setEmisorForm((prev) => ({
            ...prev,
            nit: remote.business.nit || prev.nit,
            nrc: remote.business.nrc || prev.nrc,
            nombre: remote.business.nombre || prev.nombre,
            nombreComercial: remote.business.nombre_comercial || prev.nombreComercial,
            actividadEconomica: remote.business.cod_actividad || prev.actividadEconomica,
            descActividad: remote.business.desc_actividad || prev.descActividad,
            tipoEstablecimiento: remote.business.tipo_establecimiento || prev.tipoEstablecimiento,
            departamento: remote.business.dir_departamento || prev.departamento,
            municipio: remote.business.dir_municipio || prev.municipio,
            direccion: remote.business.dir_complemento || prev.direccion,
            telefono: remote.business.telefono || prev.telefono,
            correo: remote.business.correo || prev.correo,
            codEstableMH: remote.business.cod_estable_mh ?? prev.codEstableMH,
            codPuntoVentaMH: remote.business.cod_punto_venta_mh ?? prev.codPuntoVentaMH,
            logoUrl: remote.business.logo_url || prev.logoUrl,
          }));
        } catch (error) {
          console.warn('No se pudo cargar el negocio remoto; usando fallback local.', error);
        }
      }

      if (!localEmisor) {
        setBusinessData((prev) => ({
          nombre: prev.nombre || selectedEmisor?.nombre || 'Sin emisor',
          nit: prev.nit || 'No definido',
          ambiente: storedAmbiente,
        }));
      } else {
        const nit = (localEmisor.nit || '').replace(/[-\s]/g, '');
        setBusinessData((prev) => ({
          nombre: prev.nombre || localEmisor.nombreComercial || localEmisor.nombre || 'Empresa',
          nit: prev.nit || nit || localEmisor.nit,
          ambiente: storedAmbiente,
        }));
        setEmisorForm((prev) => ({
          ...prev,
          ...localEmisor,
          logoUrl: (localEmisor as any).logo || prev.logoUrl,
        }));
      }

      const hasCert = await hasCertificate();
      setCredentialsStatus({ hasCert, hasPassword: hasCert });
    };

    loadLocal();
  }, [permission, showEmisorConfig, operationalBusinessId, selectedEmisor?.nombre]);

  const handleOpenConfig = () => {
    setShowEmisorConfig(true);
  };

  const handleSaveEmisor = async () => {
    setIsSavingEmisor(true);
    try {
      await saveEmisor({
        nit: emisorForm.nit,
        nrc: emisorForm.nrc,
        nombre: emisorForm.nombre,
        nombreComercial: emisorForm.nombreComercial,
        actividadEconomica: emisorForm.actividadEconomica,
        descActividad: emisorForm.descActividad,
        tipoEstablecimiento: emisorForm.tipoEstablecimiento,
        departamento: emisorForm.departamento,
        municipio: emisorForm.municipio,
        direccion: emisorForm.direccion,
        telefono: emisorForm.telefono,
        correo: emisorForm.correo,
        codEstableMH: emisorForm.codEstableMH,
        codPuntoVentaMH: emisorForm.codPuntoVentaMH,
        logo: emisorForm.logoUrl || undefined,
      });
      localStorage.setItem('emisor_nombre', emisorForm.nombreComercial || emisorForm.nombre || '');
      await reload();
      notify('Datos del emisor guardados', 'success');
      setShowEmisorConfig(false);
      setBusinessData((prev) => ({
        ...prev,
        nombre: emisorForm.nombreComercial || emisorForm.nombre || prev.nombre,
        nit: (emisorForm.nit || '').replace(/[\s-]/g, '') || prev.nit
      }));
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
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Cuenta</h1>
          <p className="text-sm text-gray-600 mt-1">Administra tu negocio y deja al equipo enfocado en facturar, POS e inventario.</p>
        </div>
        <div className="flex items-center gap-3">
          {isConfigured && user && (
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          )}
          {onBack && (
            <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium md:hidden">
              Volver
            </button>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Estado de configuración</p>
            <p className="text-sm text-gray-600">
              {businessId ? 'Administra la tienda seleccionada desde aquí.' : 'Primero elige una tienda o escribe su código.'}
            </p>
            {businessId && !operationalBusinessId && (
              <p className="text-xs text-amber-700 mt-2">
                El backend aún devuelve este emisor por NIT en `/businesses/me`. Para sincronización remota completa todavía hace falta el UUID real del negocio.
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {canManageLocal && (
              <button
                onClick={handleOpenConfig}
                disabled={!canManageLocal}
                title="Editar datos del negocio seleccionado"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <Settings className="w-4 h-4" />
                Configurar emisor
              </button>
            )}
            {onOpenAdvancedSettings && (
              <button
                onClick={onOpenAdvancedSettings}
                disabled={!canManageLocal}
                title="Ajustes de este equipo"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50"
              >
                <Settings className="w-4 h-4" />
                Configuración local del dispositivo
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-indigo-200 bg-white px-4 py-3 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-700 uppercase">Tienda activa</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{selectedEmisor?.nombre || businessData.nombre || 'Sin seleccionar'}</p>
            </div>
            {emisores.length > 0 && <EmisorSelector className="flex-wrap" />}
          </div>

          {emisores.length === 0 && user && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <input
                type="text"
                value={manualBusinessId}
                onChange={(e) => setManualBusinessId(e.target.value)}
                placeholder="Pega aquí el código de la tienda"
                title="Usa el businessId de la tienda que quieres administrar"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={() => setBusinessId(manualBusinessId.trim() || null)}
                disabled={!manualBusinessId.trim()}
                title="Abrir esta tienda"
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                Abrir tienda
              </button>
            </div>
          )}
        </div>

        {businessId && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-indigo-700 uppercase">Código de tienda</p>
              <p className="text-sm font-medium text-gray-900 mt-1 break-all">{businessId}</p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${isPlatformAdmin ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-700'}`}
              title={isPlatformAdmin ? 'Puedes administrar esta tienda aunque no tengas rol local' : 'Tu acceso depende del rol asignado a esta tienda'}
            >
              {isPlatformAdmin ? 'Admin global' : (currentRole || 'Tienda activa')}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase">Cuenta</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {isConfigured ? (user?.email || 'Sin sesión') : 'Auth opcional desactivada'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {isConfigured ? (user ? 'Sesión activa con Supabase.' : 'Inicia sesión para sincronización remota.') : 'La app puede operar sin login mientras se configura Supabase.'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase">1. Emisor</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{businessId ? 'Listo para configurar' : 'Pendiente'}</p>
            <p className="text-xs text-gray-600 mt-1">{businessId ? 'Datos fiscales y comerciales del emisor.' : 'Vincula un emisor a tu cuenta.'}</p>
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
            <p className="text-xs text-gray-600 mt-1">Roles y usuarios que operan este negocio.</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase">4. Push</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {subscription ? 'Suscrito' : permission === 'granted' ? 'Permiso activo' : 'Pendiente'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {subscription ? 'Este dispositivo ya está listo para recibir alertas.' : 'Activa notificaciones para suscribir este dispositivo.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DeviceFingerprintDisplay />
          <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-blue-900">Administración remota</h2>
              <p className="text-xs text-blue-700 mt-1">Los cambios aplican a la tienda activa.</p>
            </div>
            <span className="text-xs text-blue-700" title="Si cambias de tienda, ajustas otra configuración">Ayuda</span>
          </div>
          {businessSettings && remoteDraft && onBusinessSettingsChange && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Administración remota del negocio</h2>
                  <p className="text-sm text-gray-500 mt-1">Visible para toda la tienda activa.</p>
                </div>
                <div className={`text-xs font-medium px-2.5 py-1 rounded-full ${businessSettings.source === 'remote' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {businessSettings.source === 'remote' ? 'Sincronizado con backend' : 'Usando fallback local'}
                </div>
              </div>
              <div className="p-6 space-y-5">
                {!canManageRemote && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Elige una tienda con acceso para editar esta sección.
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Tab inicial</p>
                  <select
                    value={remoteDraft.defaultTab}
                    onChange={(e) => handleRemoteDefaultTabChange(e.target.value as ManagedAppTab)}
                    disabled={!canManageRemote}
                    className="mt-2 w-full md:w-72 px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {MANAGED_APP_TABS.filter((tab) => remoteDraft.features[tab]).map((tab) => (
                      <option key={tab} value={tab}>{APP_TAB_LABELS[tab]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Módulos visibles</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {MANAGED_APP_TABS.map((tab) => (
                      <label key={tab} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{APP_TAB_LABELS[tab]}</div>
                          <div className="text-xs text-gray-500">{tab}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={remoteDraft.features[tab]}
                          onChange={(e) => handleRemoteFeatureToggle(tab, e.target.checked)}
                          disabled={!canManageRemote}
                          className="h-4 w-4"
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 items-center justify-between pt-2">
                  <p className="text-xs text-gray-500">
                    Se guarda por tienda.
                  </p>
                  <button
                    onClick={handleRemoteSave}
                    disabled={isSavingRemoteSettings || !businessId || !canManageRemote}
                    title="Guardar cambios para la tienda activa"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Settings className="w-4 h-4" />
                    {isSavingRemoteSettings ? 'Guardando...' : 'Guardar cambios remotos'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {isConfigured && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
                <UserRound className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-medium text-gray-900">Sesión</h2>
              </div>
              <div className="p-6 space-y-3 text-sm text-gray-700">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Correo</span>
                  <span className="font-medium text-gray-900 break-all">{user?.email || 'Sin sesión activa'}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Estado</span>
                  <span className={`font-medium ${user ? 'text-green-600' : 'text-amber-600'}`}>{user ? 'Autenticado' : 'Sin autenticación'}</span>
                </div>
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Store className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-medium text-gray-900">Negocio</h2>
              </div>
              {canManageLocal ? (
                <button
                  onClick={handleOpenConfig}
                  disabled={false}
                  title="Editar datos del negocio seleccionado"
                  className="text-indigo-700 hover:text-indigo-800 text-sm font-medium flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  <Settings className="w-4 h-4" />
                  Editar
                </button>
              ) : (
                <span className="text-xs text-gray-500">Selecciona una tienda</span>
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
                <label className="text-xs text-gray-500 uppercase font-semibold">Business ID</label>
                <p className="text-gray-900 font-medium mt-1 break-all">{businessId || 'No asignado'}</p>
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

          <TeamPanel />
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
              {permission === 'granted' && !subscription && <p className="mt-2 text-xs text-amber-600">Permiso concedido, pero el dispositivo aún no tiene una suscripción activa.</p>}
              {subscription && <p className="mt-2 text-xs text-green-600 break-all">Suscripción activa en este dispositivo.</p>}
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
    </div>
  );
};

export default MiCuenta;
