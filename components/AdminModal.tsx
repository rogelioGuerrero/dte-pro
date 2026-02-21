import React, { useState, useEffect } from 'react';
import { Lock, Save, Settings, Shield, X, Key, LayoutTemplate, CheckCircle2, ShieldCheck, Smartphone, Trash2, Bell } from 'lucide-react';
import QRCode from 'qrcode';
import { loadSettings, saveSettings, AppSettings } from '../utils/settings';
import { validateAdminPin, hasAdminPin } from '../utils/adminPin';
import { getUserModeConfig, setUserMode, UserMode } from '../utils/userMode';
import { generateSecret, getTotpUri, verifyToken, saveSecret, hasTotpConfigured, clearTotpConfig, getStoredSecret } from '../utils/auth/totp';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

import { LicenseGeneratorTab } from './LicenseGeneratorTab';
import { PushBroadcastTab } from './PushBroadcastTab';

const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [error, setError] = useState('');
  const [currentMode, setCurrentMode] = useState<UserMode>('negocio');
  
  // TOTP State
  const [isTotpEnabled, setIsTotpEnabled] = useState(false);
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [newSecret, setNewSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [setupToken, setSetupToken] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSettings(loadSettings());
      setIsAuthenticated(false);
      setPinInput('');
      setError('');
      setActiveTab('general');
      setCurrentMode(getUserModeConfig().mode);
      setIsTotpEnabled(hasTotpConfigured());
      setShowTotpSetup(false);
      setNewSecret('');
      setQrCodeUrl('');
      setSetupToken('');
    }
  }, [isOpen]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isTotpEnabled) {
      // Verificar TOTP
      const secret = getStoredSecret();
      if (secret && verifyToken(pinInput, secret)) {
        setIsAuthenticated(true);
        // Guardar el PIN estático en memoria para mandarlo en peticiones de Admin si aplica
        localStorage.setItem('admin_secret', pinInput);
      } else {
        setError('Código incorrecto');
      }
    } else {
      // Verificar PIN estático
      if (validateAdminPin(pinInput)) {
        setIsAuthenticated(true);
        // Guardar la contraseña maestra para mandarla en peticiones a la API
        localStorage.setItem('admin_secret', pinInput);
      } else {
        setError('PIN incorrecto');
      }
    }
  };

  const handleStartTotpSetup = async () => {
    const secret = generateSecret();
    setNewSecret(secret);
    const uri = getTotpUri(secret);
    try {
      const url = await QRCode.toDataURL(uri);
      setQrCodeUrl(url);
      setShowTotpSetup(true);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Error generando QR');
    }
  };

  const handleVerifySetup = () => {
    if (verifyToken(setupToken, newSecret)) {
      saveSecret(newSecret);
      setIsTotpEnabled(true);
      setShowTotpSetup(false);
      setError('');
      // Switch to security tab to show success
      setActiveTab('security');
    } else {
      setError('Código inválido. Intente nuevamente.');
    }
  };

  const handleDisableTotp = () => {
    if (window.confirm('¿Seguro que deseas desactivar la autenticación de dos pasos? Volverás a usar el PIN estático.')) {
      clearTotpConfig();
      setIsTotpEnabled(false);
    }
  };

  const handleSave = () => {
    saveSettings(settings);
    onClose();
  };

  const handleModeChange = (mode: UserMode) => {
    setUserMode(mode);
    setCurrentMode(mode);
    window.location.reload();
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'modo', label: 'Modo de Uso', icon: LayoutTemplate },
    { id: 'security', label: 'Seguridad', icon: ShieldCheck },
    { id: 'licencias', label: 'Licencias', icon: Shield },
    { id: 'push', label: 'Push', icon: Bell }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-500" />
            Configuración Avanzada
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {!isAuthenticated ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${isTotpEnabled ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                    {isTotpEnabled ? (
                      <Smartphone className="w-8 h-8 text-indigo-600" />
                    ) : (
                      <Key className="w-8 h-8 text-gray-500" />
                    )}
                </div>
                <h4 className="text-lg font-semibold text-gray-900">
                  {isTotpEnabled ? 'Autenticación de 2 Pasos' : 'Acceso Administrativo'}
                </h4>
                <p className="text-sm text-gray-500 mt-1">
                  {isTotpEnabled 
                    ? 'Ingresa el código de 6 dígitos de tu aplicación autenticadora.'
                    : 'Ingresa el PIN de seguridad para acceder.'}
                </p>
              </div>
              
              <div>
                <input
                  type={isTotpEnabled ? "text" : "password"}
                  inputMode={isTotpEnabled ? "numeric" : "text"}
                  pattern={isTotpEnabled ? "[0-9]*" : undefined}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setError('');
                  }}
                  className="w-full text-center text-2xl tracking-widest font-mono py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder={isTotpEnabled ? "000000" : "••••••"}
                  maxLength={isTotpEnabled ? 6 : 10}
                  autoFocus
                  autoComplete={isTotpEnabled ? "one-time-code" : "current-password"}
                />
                {error && <p className="text-xs text-red-500 text-center mt-2 font-medium">{error}</p>}
              </div>

              <button
                type="submit"
                className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
              >
                {isTotpEnabled ? 'Verificar Código' : 'Desbloquear'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Tabs Navigation */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg flex-shrink-0">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-2 px-2 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                        activeTab === tab.id
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title={tab.label}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className="min-h-[300px]">
                {activeTab === 'general' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700">General</h4>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>Modo Actual:</strong> {hasAdminPin() ? 'Producción' : 'Desarrollo'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Versión del sistema: {import.meta.env.VITE_APP_VERSION || '1.0.0'}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'modo' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Seleccione la interfaz que mejor se adapte a su actividad.
                    </p>
                    
                    <div className="grid gap-3">
                      <button
                        onClick={() => handleModeChange('profesional')}
                        className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                          currentMode === 'profesional' 
                            ? 'border-indigo-500 bg-indigo-50' 
                            : 'border-gray-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className="font-semibold text-gray-900 flex justify-between items-center">
                          Profesional
                          {currentMode === 'profesional' && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Sin inventario ni productos. Ideal para servicios.
                        </p>
                      </button>

                      <button
                        onClick={() => handleModeChange('negocio')}
                        className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                          currentMode === 'negocio' 
                            ? 'border-indigo-500 bg-indigo-50' 
                            : 'border-gray-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className="font-semibold text-gray-900 flex justify-between items-center">
                          Negocio
                          {currentMode === 'negocio' && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Completo con inventario y productos.
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="space-y-6">
                    {!isTotpEnabled && !showTotpSetup ? (
                      <div className="text-center py-6">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Smartphone className="w-8 h-8 text-gray-400" />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">Activar Autenticación 2FA</h4>
                        <p className="text-sm text-gray-500 mb-6">
                          Mejora la seguridad requiriendo un código de tu celular (Google Authenticator) además del PIN.
                        </p>
                        <button
                          onClick={handleStartTotpSetup}
                          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                        >
                          Configurar Ahora
                        </button>
                      </div>
                    ) : showTotpSetup ? (
                      <div className="space-y-6 text-center">
                        <h4 className="font-semibold text-gray-900">Escanea el código QR</h4>
                        <div className="bg-white p-4 rounded-xl border-2 border-dashed border-gray-200 inline-block">
                          {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />}
                        </div>
                        <p className="text-sm text-gray-500 px-4">
                          Abre Google Authenticator, escanea este código y escribe el número que aparece abajo.
                        </p>
                        
                        <div className="max-w-xs mx-auto">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={setupToken}
                            onChange={(e) => {
                              setSetupToken(e.target.value);
                              setError('');
                            }}
                            className="w-full text-center text-2xl tracking-widest font-mono py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="000000"
                            maxLength={6}
                          />
                          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                        </div>

                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setShowTotpSetup(false)}
                            className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleVerifySetup}
                            disabled={setupToken.length !== 6}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Verificar y Activar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-50 rounded-xl p-6 border border-green-100 text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <ShieldCheck className="w-6 h-6 text-green-600" />
                        </div>
                        <h4 className="text-lg font-semibold text-green-800 mb-1">Protección Activada</h4>
                        <p className="text-sm text-green-700 mb-6">
                          Tu cuenta está protegida con autenticación de dos pasos.
                        </p>
                        <button
                          onClick={handleDisableTotp}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 mx-auto transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Desactivar 2FA
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'licencias' && (
                  <LicenseGeneratorTab />
                )}

                {activeTab === 'push' && (
                  <PushBroadcastTab />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-auto">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminModal;
