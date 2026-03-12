import React, { useState, useEffect, useRef } from 'react';
import { Download, Bell, Shield, Key, Upload, LogOut, CheckCircle2, AlertCircle, Settings, Building2 } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { downloadBackup, restoreBackupFromText } from '../utils/backup';
import { notify } from '../utils/notifications';
import { EmisorConfigModal } from './EmisorConfigModal';
import { useCertificateManager } from '../hooks/useCertificateManager';
import { EmisorData } from '../utils/emisorDb';
import { useEmisor } from '../contexts/EmisorContext';
import { getEmisor, saveEmisor } from '../utils/emisorDb';
import { hasCertificate } from '../utils/secureStorage';
import { DeviceFingerprintDisplay } from './DeviceFingerprintDisplay';
import { apiFetch } from '../utils/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { EmisorSelector } from './EmisorSelector';

interface MiCuentaProps {
  onBack?: () => void;
}

const MiCuenta: React.FC<MiCuentaProps> = ({ onBack }) => {
  const { isSupported, permission, subscription, requestPermission, subscribeToPush, unsubscribeFromPush } = usePushNotifications();
  const { user, isConfigured, signOut } = useAuth();
  const { businessId, operationalBusinessId, emisores, reload, currentRole, selectedEmisor } = useEmisor();
  const isPlatformAdmin = Boolean(user && businessId && !currentRole);
  const canManageLocal = currentRole === 'owner' || currentRole === 'admin' || isPlatformAdmin || !currentRole;
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showEmisorConfig, setShowEmisorConfig] = useState(false);
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
  const negocioNombre = selectedEmisor?.nombre || businessData.nombre || 'Tu negocio';
  const cuentaTexto = isConfigured ? (user?.email || 'Cuenta sin iniciar sesión') : 'Uso sin cuenta';
  const negocioVinculado = Boolean(businessId);
  const negocioCompleto = Boolean(
    negocioNombre &&
    businessData.nit &&
    businessData.nit !== 'No definido'
  );
  const dispositivoListo = credentialsStatus.hasCert && credentialsStatus.hasPassword;
  const notificacionesListas = Boolean(subscription) || permission === 'granted';

  const handleSignOut = async () => {
    try {
      await signOut();
      notify('Sesión cerrada correctamente', 'success');
    } catch (error) {
      console.error(error);
      notify('No se pudo cerrar sesión', 'error');
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

  const renderStatusPill = (
    label: string,
    tone: 'green' | 'amber' | 'gray'
  ) => {
    const styles = {
      green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      amber: 'bg-amber-50 text-amber-700 border-amber-200',
      gray: 'bg-gray-100 text-gray-700 border-gray-200',
    } as const;

    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>
        {label}
      </span>
    );
  };

  const renderChecklistItem = (
    title: string,
    description: string,
    status: 'ready' | 'review' | 'device'
  ) => {
    const config = {
      ready: {
        icon: CheckCircle2,
        iconClass: 'text-emerald-600',
        badge: renderStatusPill('Listo', 'green'),
      },
      review: {
        icon: AlertCircle,
        iconClass: 'text-amber-600',
        badge: renderStatusPill('En revisión', 'amber'),
      },
      device: {
        icon: AlertCircle,
        iconClass: 'text-gray-500',
        badge: renderStatusPill('Falta en este dispositivo', 'gray'),
      },
    } as const;

    const Icon = config[status].icon;

    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Icon className={`w-5 h-5 ${config[status].iconClass}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              <p className="text-xs text-gray-600 mt-1">{description}</p>
            </div>
          </div>
          {config[status].badge}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Cuenta</h1>
          <p className="text-sm text-gray-600 mt-1">Aquí puedes revisar tu negocio, este dispositivo y tu respaldo sin complicarte.</p>
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
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Tu negocio</p>
              <p className="text-sm text-gray-600 mt-1">Revisa rápidamente si ya estás listo para trabajar desde esta computadora.</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-white px-4 py-3 space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold text-indigo-700 uppercase">Negocio activo</p>
                  <p className="text-base font-semibold text-gray-900 mt-1">{negocioNombre}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {negocioVinculado ? renderStatusPill('Negocio encontrado', 'green') : renderStatusPill('En revisión', 'amber')}
                    {isPlatformAdmin
                      ? renderStatusPill('Admin global', 'gray')
                      : renderStatusPill(currentRole || 'Tienda activa', 'gray')}
                  </div>
                </div>
                {emisores.length > 0 && <EmisorSelector className="flex-wrap" />}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {canManageLocal && (
              <button
                onClick={handleOpenConfig}
                disabled={!canManageLocal}
                title="Editar datos del negocio seleccionado"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <Settings className="w-4 h-4" />
                Editar datos
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
          {renderChecklistItem(
            'Negocio vinculado',
            negocioVinculado ? 'Tu negocio ya está asociado a esta cuenta.' : 'Estamos revisando la información de tu negocio.',
            negocioVinculado ? 'ready' : 'review'
          )}
          {renderChecklistItem(
            'Datos del negocio',
            negocioCompleto ? 'Nombre y NIT disponibles para trabajar.' : 'Todavía estamos revisando algunos datos del negocio.',
            negocioCompleto ? 'ready' : 'review'
          )}
          {renderChecklistItem(
            'Firma en esta computadora',
            dispositivoListo ? 'Esta computadora ya está lista para firmar y enviar.' : 'Falta cargar el certificado en esta computadora.',
            dispositivoListo ? 'ready' : 'device'
          )}
          {renderChecklistItem(
            'Alertas del dispositivo',
            notificacionesListas ? 'Este dispositivo ya puede mostrar avisos importantes.' : 'Puedes activar alertas en esta computadora si lo deseas.',
            notificacionesListas ? 'ready' : 'device'
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-medium text-gray-900">Resumen del negocio</h2>
              </div>
              {businessData.ambiente === '01'
                ? renderStatusPill('Producción', 'green')
                : renderStatusPill('Pruebas', 'gray')}
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Nombre del negocio</label>
                <p className="text-gray-900 font-medium mt-1">{negocioNombre}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">NIT</label>
                <p className="text-gray-900 font-medium mt-1">{businessData.nit}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Código de tienda</label>
                <p className="text-gray-900 font-medium mt-1 break-all">{businessId || 'En revisión'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Estado de tu cuenta</label>
                <p className="text-gray-900 font-medium mt-1">{cuentaTexto}</p>
              </div>
              {isConfigured && (
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold">Sesión</label>
                  <p className="text-gray-900 font-medium mt-1">{user ? 'Activa' : 'Sin iniciar'}</p>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Acceso</label>
                <p className="text-gray-900 font-medium mt-1">{isPlatformAdmin ? 'Admin global' : (currentRole || 'Tienda activa')}</p>
              </div>
            </div>
          </div>

          <DeviceFingerprintDisplay />
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
              <Shield className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900">Firma y certificado</h2>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600">
                La firma electrónica se almacena en Supabase y el backend la usa al generar DTE.
                Solo necesitas cargar un certificado local si quieres firmar desde esta computadora;
                de lo contrario el backend procesa todo automáticamente.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Certificado local</span>
                <span className={`text-sm font-medium ${credentialsStatus.hasCert ? 'text-green-600' : 'text-amber-600'}`}>
                  {credentialsStatus.hasCert ? 'Subido' : 'Opcional'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Clave del certificado</span>
                <span className={`text-sm font-medium ${credentialsStatus.hasPassword ? 'text-green-600' : 'text-amber-600'}`}>
                  {credentialsStatus.hasPassword ? 'Subida' : 'Opcional'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-medium text-gray-900">Alertas</h2>
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
              <p className="text-sm text-gray-600">Activa avisos importantes para esta computadora.</p>
              {!isSupported && <p className="mt-2 text-xs text-red-500">Tu navegador no permite alertas.</p>}
              {permission === 'denied' && <p className="mt-2 text-xs text-orange-500">El permiso está bloqueado en este navegador.</p>}
              {permission === 'granted' && !subscription && <p className="mt-2 text-xs text-amber-600">El permiso ya está dado, pero este dispositivo aún no termina de activarse.</p>}
              {subscription && <p className="mt-2 text-xs text-green-600 break-all">Este dispositivo ya recibe alertas.</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
              <Download className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900">Respaldo</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Guarda una copia de tus datos de esta computadora o recupérala cuando lo necesites.</p>
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
