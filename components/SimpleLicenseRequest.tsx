import React, { useState } from 'react';
import { QrCode, Download, Mail, Shield, Key, Check, AlertCircle } from 'lucide-react';
import { deviceFingerprint } from '../utils/deviceFingerprint';

interface SimpleLicenseRequestProps {
  onLicenseReceived?: (license: any) => void;
}

export const SimpleLicenseRequest: React.FC<SimpleLicenseRequestProps> = ({ onLicenseReceived }) => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'form' | 'qr' | 'waiting' | 'revealed'>('form');
  const [requestId, setRequestId] = useState('');
  const [licenseData, setLicenseData] = useState<any>(null);

  // Generar solicitud y QR
  const handleGenerateRequest = async () => {
    if (!email.trim()) return;

    try {
      // Generar fingerprint y request ID
      const fingerprint = await deviceFingerprint.generateFingerprint();
      const id = Math.random().toString(36).substr(2, 9);
      setRequestId(id);

      // Crear datos de la solicitud
      const requestData = {
        id,
        email: email.trim(),
        fingerprint,
        timestamp: new Date().toISOString()
      };

      // Generar QR con los datos
      await generateQRCode(requestData);

      setStep('qr');
    } catch (error) {
      console.error('Error generando solicitud:', error);
    }
  };

  // Generar QR code (simulado - en producción usarías una librería)
  const generateQRCode = async (data: any) => {
    // En producción, usarías qrcode.js o similar
    // Por ahora, simulamos que se genera
    console.log('QR Data:', data);
  };

  // Simular recepción de la licencia
  const simulateLicenseReceived = () => {
    // Simular que recibimos una licencia
    const mockLicense = {
      data: {
        id: 'license-' + Math.random().toString(36).substr(2, 9),
        userId: requestId,
        email: email.trim(),
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        maxExports: -1,
        features: ['basic'],
        deviceFingerprint: 'generated-fingerprint',
        version: '1.0'
      },
      signature: 'mock-signature'
    };

    setLicenseData(mockLicense);
    setStep('revealed');
    
    if (onLicenseReceived) {
      onLicenseReceived(mockLicense);
    }
  };

  // Descargar archivo de solicitud
  const downloadRequestFile = () => {
    const requestData = {
      id: requestId,
      email: email.trim(),
      fingerprint: 'hidden-in-qr',
      instructions: 'Envía este archivo a soporte@tudte.com'
    };

    const blob = new Blob([JSON.stringify(requestData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solicitud-licencia-${requestId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (step === 'form') {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold">Activar Licencia</h3>
              <p className="text-sm text-gray-600">
                Ingresa tu correo para comenzar
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateRequest}
            disabled={!email.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <QrCode className="w-5 h-5" />
            <span>Generar Solicitud</span>
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">¿Cómo funciona?</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Ingresa tu correo</li>
                  <li>Escanea el código QR o descarga el archivo</li>
                  <li>Recibirás tu licencia automáticamente</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'qr' || step === 'waiting') {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <QrCode className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold">Envía tu Solicitud</h3>
              <p className="text-sm text-gray-600">
                Escanea el código o descarga el archivo
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* QR Code Placeholder */}
          <div className="flex justify-center">
            <div className="w-48 h-48 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500">QR Code</p>
                <p className="text-xs text-gray-400 mt-1">ID: {requestId}</p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Opciones para enviar:</p>
                <ol className="list-decimal list-inside space-y-1 text-yellow-700">
                  <li>Escanea este código con tu cámara</li>
                  <li>Descarga el archivo y envíalo por correo</li>
                  <li>Espera mientras procesamos tu solicitud</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Download Button */}
          <button
            onClick={downloadRequestFile}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Archivo de Solicitud</span>
          </button>

          {/* Waiting Message */}
          {step === 'waiting' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm">Esperando licencia...</span>
              </div>
            </div>
          )}

          {/* Simulate Button (solo para desarrollo) */}
          <button
            onClick={() => {
              setStep('waiting');
              setTimeout(simulateLicenseReceived, 3000);
            }}
            className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Simular recepción de licencia
          </button>
        </div>
      </div>
    );
  }

  if (step === 'revealed' && licenseData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-600">¡Licencia Recibida!</h3>
              <p className="text-sm text-gray-600">
                Tu licencia ha sido activada automáticamente
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* License Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Detalles de la Licencia:</h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-600">ID:</span> {licenseData.data.id}</p>
              <p><span className="text-gray-600">Correo:</span> {licenseData.data.email}</p>
              <p><span className="text-gray-600">Expira:</span> {new Date(licenseData.data.expiresAt).toLocaleDateString('es-ES')}</p>
              <p><span className="text-gray-600">Exportaciones:</span> Ilimitadas</p>
            </div>
          </div>

          {/* Success Message */}
          <div className="text-center py-4">
            <Shield className="w-12 h-12 text-green-600 mx-auto mb-2" />
            <p className="text-gray-700">
              ¡Listo! Ahora puedes usar todas las funciones de la aplicación
            </p>
          </div>

          {/* Download License Button */}
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(licenseData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `licencia-${licenseData.data.id}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Guardar Licencia</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};
