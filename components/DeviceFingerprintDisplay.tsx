import React, { useState, useEffect } from 'react';
import { Copy, Check, Monitor, Shield, AlertTriangle } from 'lucide-react';
import { deviceFingerprint } from '../utils/deviceFingerprint';

interface DeviceFingerprintDisplayProps {
  onCopy?: (fingerprint: string) => void;
}

export const DeviceFingerprintDisplay: React.FC<DeviceFingerprintDisplayProps> = ({ onCopy }) => {
  const [fingerprint, setFingerprint] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateFingerprint();
  }, []);

  const generateFingerprint = async () => {
    try {
      setLoading(true);
      const fp = await deviceFingerprint.generateFingerprint();
      setFingerprint(fp);
    } catch (error) {
      console.error('Error generando fingerprint:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (fingerprint) {
      try {
        await navigator.clipboard.writeText(fingerprint);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        if (onCopy) {
          onCopy(fingerprint);
        }
      } catch (error) {
        console.error('Error copiando fingerprint:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <Monitor className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold">Identificador de Dispositivo</h3>
            <p className="text-sm text-gray-600">
              Este código identifica únicamente tu computadora
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Fingerprint Display */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Código del Dispositivo:</span>
            <button
              onClick={handleCopy}
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
          <div className="font-mono text-sm bg-white border rounded px-3 py-2 break-all select-all">
            {fingerprint}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">¿Cómo usar este código?</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Copia este código único de tu dispositivo</li>
                <li>Envíalo a soporte@tudte.com</li>
                <li>Recibirás una licencia atada a esta computadora</li>
                <li>La licencia solo funcionará en este dispositivo</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Security Note */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Shield className="w-4 h-4" />
          <span>
            Este identificador se genera a partir de características únicas de tu navegador y sistema.
            No contiene información personal sensible.
          </span>
        </div>

        {/* Regenerate Button */}
        <button
          onClick={generateFingerprint}
          className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          Regenerar Código
        </button>
      </div>
    </div>
  );
};
