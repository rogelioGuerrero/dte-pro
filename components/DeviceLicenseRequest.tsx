import React, { useState, useEffect } from 'react';
import { Copy, Check, Key, Mail, Download, Zap } from 'lucide-react';
import { deviceFingerprint } from '../utils/deviceFingerprint';

interface DeviceLicenseRequestProps {
  onLicenseUploaded?: () => void;
}

export const DeviceLicenseRequest: React.FC<DeviceLicenseRequestProps> = ({ onLicenseUploaded }) => {
  const [fingerprint, setFingerprint] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [licenseCode, setLicenseCode] = useState('');
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    generateFingerprint();
  }, []);

  const generateFingerprint = async () => {
    try {
      setLoading(true);
      const fp = await deviceFingerprint.generateFingerprint();
      setFingerprint(fp);
    } catch (error) {
      console.error('Error:', error);
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
      } catch (error) {
        console.error('Error copiando:', error);
      }
    }
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent('Solicitud de Licencia DTE - Mi Dispositivo');
    const body = encodeURIComponent(`
Hola,

Solicito mi licencia para DTE App.

Mi código de dispositivo es:
${fingerprint}

Por favor, envíenme mi código de activación.

Gracias.
    `.trim());

    // Detectar si es móvil y abrir cliente de correo por defecto
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      // En móviles, abrir cliente de correo por defecto
      window.location.href = `mailto:info@agtisa.com?subject=${subject}&body=${body}`;
    } else {
      // En desktop, intentar múltiples opciones
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=info@agtisa.com&su=${subject}&body=${body}`;
      
      // Primero intentar Gmail
      window.open(gmailUrl, '_blank');
      
      // Mostrar instrucciones fallback
      setTimeout(() => {
        if (!confirm('¿No se abrió Gmail? También puedes usar Outlook o cualquier otro cliente de correo para enviar tu solicitud a info@agtisa.com')) {
          // Fallback a mailto si cancela
          window.location.href = `mailto:info@agtisa.com?subject=${subject}&body=${body}`;
        }
      }, 1000);
    }
  };

  const processLicenseData = async (licenseData: any) => {
    try {
      // Validar estructura básica
      if (!licenseData.data || !licenseData.signature) {
        throw new Error('Formato de licencia inválido');
      }
      
      // Intentar guardar (la validación real ocurre en el componente padre o Validator)
      // Aquí simulamos guardado para que el padre lo valide
      localStorage.setItem('dte-license', JSON.stringify(licenseData));
      
      if (onLicenseUploaded) {
        onLicenseUploaded();
      }
    } catch (error) {
      alert('Licencia inválida: ' + (error as Error).message);
      localStorage.removeItem('dte-license');
    }
  };

  const handleActivateCode = async () => {
    if (!licenseCode.trim()) return;
    
    setActivating(true);
    try {
      // Decodificar Base64
      const jsonStr = atob(licenseCode.trim());
      const license = JSON.parse(jsonStr);
      await processLicenseData(license);
    } catch (error) {
      alert('Código de activación inválido. Verifica que lo hayas copiado completo.');
    } finally {
      setActivating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const license = JSON.parse(event.target?.result as string);
          await processLicenseData(license);
        } catch (error) {
          alert('Archivo de licencia inválido: ' + (error as Error).message);
        }
      };
      reader.readAsText(file);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-base font-semibold">Activa tu Licencia</h3>
            <p className="text-xs text-gray-600">
              Tu licencia estará atada a este dispositivo
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Fingerprint Display */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-gray-700">Paso 1: Copia tu Código de Dispositivo</h4>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-xs bg-white border rounded px-2 py-1 break-all select-all">
            {fingerprint}
          </div>
        </div>

        {/* Send Options */}
        <button
          onClick={handleSendEmail}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm"
        >
          <Mail className="w-4 h-4" />
          <span>Paso 2: Enviar código por Correo</span>
        </button>

        <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">Paso 3: Activar</span>
            <div className="flex-grow border-t border-gray-200"></div>
        </div>

        {/* Activate Code Area */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700 block">
            Opción A: Pegar Código de Activación
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={licenseCode}
              onChange={(e) => setLicenseCode(e.target.value)}
              placeholder="Pega aquí el código que recibiste..."
              className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button
              onClick={handleActivateCode}
              disabled={!licenseCode || activating}
              className={`px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium flex items-center gap-1 ${(!licenseCode || activating) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Zap className="w-3 h-3" />
              {activating ? '...' : 'Activar'}
            </button>
          </div>
        </div>

        {/* Upload Area */}
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-2">- o -</p>
          <label className="cursor-pointer inline-flex flex-col items-center">
            <span className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-xs border border-gray-200">
              <Download className="w-3 h-3" />
              Opción B: Subir Archivo .json
            </span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Note */}
        <div className="text-[10px] text-gray-400 text-center pt-2">
          Esta licencia es única e intransferible para este dispositivo.
        </div>
      </div>
    </div>
  );
};
