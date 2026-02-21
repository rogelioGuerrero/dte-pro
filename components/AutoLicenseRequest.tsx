import React, { useState } from 'react';
import { Mail, Send, Check, AlertCircle, Loader2, Shield, Key, Copy, MessageCircle } from 'lucide-react';
import { deviceFingerprint } from '../utils/deviceFingerprint';

interface AutoLicenseRequestProps {
  onRequestSent?: () => void;
}

export const AutoLicenseRequest: React.FC<AutoLicenseRequestProps> = () => {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'generating' | 'ready'>('idle');
  const [fingerprint, setFingerprint] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateRequest = async () => {
    if (!email.trim()) {
      setStatus('idle');
      return;
    }

    setIsLoading(true);
    setStatus('generating');

    try {
      // Generar fingerprint automáticamente
      const fp = await deviceFingerprint.generateFingerprint();
      setFingerprint(fp);
      setStatus('ready');
    } catch (error) {
      console.error('Error generando solicitud:', error);
      setStatus('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyFingerprint = async () => {
    if (fingerprint) {
      try {
        await navigator.clipboard.writeText(fingerprint);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Error copiando fingerprint:', error);
      }
    }
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent('Solicitud de Licencia - DTE App');
    const body = encodeURIComponent(`
Datos de Solicitud de Licencia:

Correo Electrónico: ${email.trim()}
Empresa: ${company.trim() || 'N/A'}
Fecha: ${new Date().toLocaleString('es-ES')}

Identificador de Dispositivo:
${fingerprint}

Información del Sistema:
${navigator.userAgent}

---
Este es un mensaje generado automáticamente desde la aplicación DTE.
    `.trim());

    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=soporte@tudte.com&su=${subject}&body=${body}`, '_blank');
  };

  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(`Hola, solicito mi licencia para DTE App

Datos:
- Correo: ${email.trim()}
- Empresa: ${company.trim() || 'N/A'}
- ID Dispositivo: ${fingerprint}

Por favor, envíenme mi licencia a este correo.`);
    
    window.open(`https://wa.me/503XXXXXXXXX?text=${text}`, '_blank');
  };

  if (status === 'idle') {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold">Obtener Licencia</h3>
              <p className="text-sm text-gray-600">
                Solicita tu licencia para desbloquear todas las funciones
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo Electrónico *
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

          {/* Company Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Empresa (opcional)
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nombre de tu empresa"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateRequest}
            disabled={isLoading || !email.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generando solicitud...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Generar Solicitud</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-green-600" />
          <div>
            <h3 className="text-lg font-semibold">Tu Solicitud está Lista</h3>
            <p className="text-sm text-gray-600">
              Envía estos datos para obtener tu licencia
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* User Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Tus Datos:</h4>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-600">Correo:</span> {email}</p>
            {company && <p><span className="text-gray-600">Empresa:</span> {company}</p>}
          </div>
        </div>

        {/* Fingerprint */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">ID del Dispositivo:</h4>
            <button
              onClick={handleCopyFingerprint}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
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
          <div className="font-mono text-xs bg-white border rounded px-3 py-2 break-all select-all">
            {fingerprint}
          </div>
        </div>

        {/* Send Options */}
        <div className="space-y-2">
          <button
            onClick={handleSendEmail}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Mail className="w-4 h-4" />
            <span>Enviar por Gmail</span>
          </button>

          <button
            onClick={handleSendWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Enviar por WhatsApp</span>
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Instrucciones:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Copia tu ID de dispositivo (botón amarillo)</li>
                <li>Envía tus datos por Gmail, WhatsApp o tu medio preferido</li>
                <li>Recibirás tu licencia personalizada en 24-48 horas</li>
                <li>Arrastra el archivo .json a esta aplicación para activarla</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={() => {
            setStatus('idle');
            setFingerprint('');
            setEmail('');
            setCompany('');
          }}
          className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          Generar nueva solicitud
        </button>
      </div>
    </div>
  );
};
