import React, { useState, useEffect } from 'react';
import { QrCode, Copy, Check, AlertCircle, CreditCard, Smartphone, Monitor, RefreshCw } from 'lucide-react';
import { deviceFingerprint } from '../utils/deviceFingerprint';
import { licenseValidator, type License } from '../utils/licenseValidator';

interface UniversalLicenseRequestProps {
  onLicenseActivated?: () => void;
}

export const UniversalLicenseRequest: React.FC<UniversalLicenseRequestProps> = ({ onLicenseActivated }) => {
  const [step, setStep] = useState<'request' | 'pending' | 'activated'>('request');
  const [requestCode, setRequestCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [license, setLicense] = useState<License | null>(null);

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);
    };
    checkMobile();
  }, []);

  // Generar código de solicitud
  useEffect(() => {
    generateRequestCode();
  }, []);

  // Verificar periódicamente si la licencia está lista
  useEffect(() => {
    if (step === 'pending') {
      const interval = setInterval(checkLicenseStatus, 5000); // Cada 5 segundos
      return () => clearInterval(interval);
    }
  }, [step, requestCode]);

  const generateRequestCode = async () => {
    try {
      const fingerprint = await deviceFingerprint.generateFingerprint();
      const id = Math.random().toString(36).substr(2, 9).toUpperCase();
      const code = `DTE-${id}-${fingerprint.substring(0, 8)}`;
      setRequestCode(code);

      // Guardar en localStorage para persistencia
      localStorage.setItem('requestCode', code);
      localStorage.setItem('requestTimestamp', Date.now().toString());
    } catch (error) {
      console.error('Error generando código:', error);
    }
  };

  const checkLicenseStatus = async () => {
    try {
      // En producción, esto haría una llamada a tu API
      // GET /api/license/status?code=DTE-ABC123-XYZ789
      const response = await fetch(`https://tudte.com/api/license/status?code=${requestCode}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.license) {
          // Licencia encontrada, activarla
          const isValid = await licenseValidator.verifyLicense(data.license);
          if (isValid) {
            setLicense(data.license);
            setStep('activated');
            if (onLicenseActivated) {
              onLicenseActivated();
            }
          }
        }
      }
    } catch (error) {
      // Silencioso para no molestar al usuario
      console.log('Verificando estado de la licencia...');
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(requestCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copiando:', error);
    }
  };

  const handlePayNow = () => {
    // Abrir tu página de pagos con el código
    window.open(`https://tudte.com/pago?code=${requestCode}`, '_blank');
  };

  const handleRegenerate = () => {
    generateRequestCode();
    setCopied(false);
  };

  if (step === 'request') {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
              {isMobile ? <Smartphone className="w-4 h-4 text-blue-600" /> : <Monitor className="w-4 h-4 text-blue-600" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold">Activa tu Licencia</h3>
              <p className="text-sm text-gray-600">
                {isMobile ? 'Escanea o copia tu código' : 'Copia tu código único'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Device Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              {isMobile ? <Smartphone className="w-8 h-8 text-gray-600" /> : <Monitor className="w-8 h-8 text-gray-600" />}
            </div>
          </div>

          {/* Request Code */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Tu Código de Solicitud:</h4>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            <div className="font-mono text-lg bg-white border rounded px-3 py-2 text-center select-all">
              {requestCode}
            </div>
          </div>

          {/* QR for mobile */}
          {isMobile && (
            <div className="flex justify-center">
              <div className="w-32 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <QrCode className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">QR</p>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Pasos para activar:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>Copia tu código: <span className="font-mono text-xs">{requestCode}</span></li>
                  <li>Ve a <span className="underline">tudte.com/pago</span></li>
                  <li>Pega el código y completa el pago</li>
                  <li>Espera mientras activamos tu licencia</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handlePayNow}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <CreditCard className="w-5 h-5" />
              <span>Pagar y Activar Ahora</span>
            </button>

            <button
              onClick={() => setStep('pending')}
              className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Ya pagué, verificar mi licencia
            </button>

            <button
              onClick={handleRegenerate}
              className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-1" />
              Generar nuevo código
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'pending') {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="p-6 border-b text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full mb-3">
            <RefreshCw className="w-6 h-6 text-yellow-600 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold">Verificando Pago</h3>
          <p className="text-sm text-gray-600 mt-1">
            Estamos activando tu licencia...
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Status */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
              <p className="text-sm text-yellow-800">
                Código: <span className="font-mono">{requestCode}</span>
              </p>
            </div>
            <p className="text-xs text-yellow-700 mt-2">
              Verificando cada 5 segundos...
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Mientras esperas:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✅ Tu pago está siendo procesado</li>
              <li>✅ Tu licencia se activará automáticamente</li>
              <li>✅ No necesitas hacer nada más</li>
            </ul>
          </div>

          {/* Refresh Button */}
          <button
            onClick={checkLicenseStatus}
            className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Verificar ahora
          </button>
        </div>
      </div>
    );
  }

  if (step === 'activated' && license) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="p-6 border-b text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-green-600">¡Licencia Activada!</h3>
          <p className="text-sm text-gray-600 mt-1">
            Todo listo para usar
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* License Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Detalles:</h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-600">Tipo:</span> Premium</p>
              <p><span className="text-gray-600">Válida hasta:</span> {new Date(license.data.expiresAt).toLocaleDateString('es-ES')}</p>
              <p><span className="text-gray-600">Exportaciones:</span> Ilimitadas</p>
            </div>
          </div>

          {/* Success Message */}
          <div className="text-center py-2">
            <p className="text-gray-700 font-medium">
              ¡Gracias por tu compra!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
