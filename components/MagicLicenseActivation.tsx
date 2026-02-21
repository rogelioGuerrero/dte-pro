import React, { useState, useEffect } from 'react';
import { QrCode, Sparkles, Shield, Check, Loader2 } from 'lucide-react';
import { deviceFingerprint } from '../utils/deviceFingerprint';
import { licenseValidator, type License } from '../utils/licenseValidator';

interface MagicLicenseActivationProps {
  onLicenseActivated?: () => void;
}

export const MagicLicenseActivation: React.FC<MagicLicenseActivationProps> = ({ onLicenseActivated }) => {
  const [step, setStep] = useState<'scan' | 'processing' | 'activated'>('scan');
  const [requestId, setRequestId] = useState('');
  const [license, setLicense] = useState<License | null>(null);

  // Generar QR al montar
  useEffect(() => {
    generateQRRequest();
  }, []);

  const generateQRRequest = async () => {
    try {
      // Generar fingerprint único
      const fingerprint = await deviceFingerprint.generateFingerprint();
      const id = Math.random().toString(36).substr(2, 9);
      setRequestId(id);

      // En producción, esto enviaría los datos a tu servidor
      // y generaría un QR único con toda la información
      console.log('QR Request Data:', {
        id,
        fingerprint,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Simular activación cuando se "escanea" el QR
  const handleQRScanned = async () => {
    setStep('processing');
    
    // Simular tiempo de procesamiento
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generar licencia automáticamente
    const mockLicense: License = {
      data: {
        id: 'license-' + requestId,
        userId: 'user-' + requestId,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        maxExports: -1,
        features: ['basic'],
        email: 'usuario@ejemplo.com',
        companyName: 'Empresa S.A.',
        deviceFingerprint: await deviceFingerprint.generateFingerprint(),
        version: '1.0'
      },
      signature: 'digital-signature-' + requestId
    };

    // Activar la licencia
    const isValid = await licenseValidator.verifyLicense(mockLicense);
    
    if (isValid) {
      setLicense(mockLicense);
      setStep('activated');
      
      if (onLicenseActivated) {
        onLicenseActivated();
      }
    }
  };

  if (step === 'scan') {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="p-6 border-b text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
            <QrCode className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold">Escanea para Activar</h3>
          <p className="text-sm text-gray-600 mt-1">
            Apunta tu cámara al código
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* QR Code */}
          <div className="flex justify-center">
            <div 
              onClick={handleQRScanned}
              className="w-56 h-56 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-lg"
            >
              <div className="text-center text-white">
                <QrCode className="w-24 h-24 mx-auto mb-2 opacity-90" />
                <p className="text-xs font-medium">ID: {requestId || '...'}</p>
                <p className="text-xs opacity-75 mt-1">Click para simular</p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Magia en 3 pasos:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>Escanea este código con tu cámara</li>
                  <li>Espera un momento...</li>
                  <li>¡Listo! Tu licencia se activará sola</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Alternative Option */}
          <div className="text-center">
            <button
              onClick={handleQRScanned}
              className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              No tienes cámara? Click aquí
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="p-6 border-b text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full mb-3">
            <Loader2 className="w-6 h-6 text-yellow-600 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold">Procesando...</h3>
          <p className="text-sm text-gray-600 mt-1">
            Estamos activando tu licencia
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex justify-center py-8">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Un momento por favor...</p>
            </div>
          </div>
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
          <h3 className="text-lg font-semibold text-green-600">¡Activado!</h3>
          <p className="text-sm text-gray-600 mt-1">
            Tu licencia está lista
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Success Animation */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <Shield className="w-10 h-10 text-green-600" />
              </div>
              <div className="absolute -inset-2 bg-green-200 rounded-full animate-ping opacity-20"></div>
            </div>
          </div>

          {/* License Details */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Licencia Activada:</h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-600">Tipo:</span> Premium</p>
              <p><span className="text-gray-600">Válida hasta:</span> {new Date(license.data.expiresAt).toLocaleDateString('es-ES')}</p>
              <p><span className="text-gray-600">Exportaciones:</span> Ilimitadas</p>
            </div>
          </div>

          {/* Success Message */}
          <div className="text-center py-2">
            <p className="text-gray-700 font-medium">
              ¡Disfruta de todas las funciones!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
