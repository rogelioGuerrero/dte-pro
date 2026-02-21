import React, { useState } from 'react';
import { Shield, Key, Calendar, Mail, User, Smartphone, Copy, Check, ExternalLink } from 'lucide-react';
import { notify } from '../utils/notifications';

export const LicenseGeneratorTab: React.FC = () => {
  // Form State
  const [formData, setFormData] = useState({
    email: '',
    companyName: '',
    userId: '',
    daysValid: 365,
    maxExports: -1,
    deviceFingerprint: ''
  });

  // Result State
  const [generatedResult, setGeneratedResult] = useState<{
    licenseBase64: string;
    magicLink: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGeneratedResult(null);

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + formData.daysValid);

      // Obtener token JWT y business_id del localStorage
      const token = localStorage.getItem('dte_token') || 'dev-token-temporal';
      const businessId = localStorage.getItem('dte_business_id') || localStorage.getItem('emisor_nit') || 'uuid-business-temporal';
      
      // Permitimos token temporal para pruebas locales. Backend validará.

      const payload = {
        id: crypto.randomUUID(),
        userId: formData.userId || `user-${Date.now()}`,
        email: formData.email,
        companyName: formData.companyName,
        expiresAt: expiresAt.toISOString(),
        maxExports: Number(formData.maxExports),
        deviceFingerprint: formData.deviceFingerprint || undefined,
        features: ['basic'],
        version: '1.0'
      };

      const apiUrl = import.meta.env.VITE_API_DTE_URL || '';
      const response = await fetch(`${apiUrl}/api/admin/generate-license`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-business-id': businessId,
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error generando licencia');
      }

      setGeneratedResult({
        licenseBase64: data.licenseBase64,
        magicLink: data.magicLink
      });
      notify('Licencia generada exitosamente', 'success');

    } catch (error) {
      console.error(error);
      notify((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, isLink: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isLink) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch (err) {
      notify('Error al copiar', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleGenerate} className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700">Generar Nueva Licencia</h4>
        
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Mail className="w-4 h-4" /> Email del Cliente
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="cliente@ejemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <User className="w-4 h-4" /> Nombre / Empresa
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({...formData, companyName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Empresa S.A. de C.V."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Smartphone className="w-4 h-4" /> Fingerprint (ID Dispositivo)
            </label>
            <input
              type="text"
              value={formData.deviceFingerprint}
              onChange={(e) => setFormData({...formData, deviceFingerprint: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 font-mono text-xs"
              placeholder="Pegar ID que envió el cliente..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">Obligatorio para vincular al dispositivo.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Calendar className="w-4 h-4" /> Días Validez
              </label>
              <input
                type="number"
                value={formData.daysValid}
                onChange={(e) => setFormData({...formData, daysValid: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Key className="w-4 h-4" /> Límite Diario
              </label>
              <select
                value={formData.maxExports}
                onChange={(e) => setFormData({...formData, maxExports: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="-1">Ilimitado</option>
                <option value="10">10 DTEs</option>
                <option value="50">50 DTEs</option>
                <option value="100">100 DTEs</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium ${loading ? 'opacity-70 cursor-wait' : ''}`}
        >
          {loading ? (
            <>Generando...</>
          ) : (
            <>
              <Shield className="w-5 h-5" /> Generar Licencia
            </>
          )}
        </button>
      </form>

      {generatedResult && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-sm font-semibold text-gray-700">Licencia Generada</h4>
          
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Opción 1: Enlace Mágico (Recomendado)
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={generatedResult.magicLink}
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-600 truncate"
              />
              <button
                onClick={() => copyToClipboard(generatedResult.magicLink, true)}
                className={`p-2 rounded-md transition-colors ${copiedLink ? 'bg-green-100 text-green-600' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                title="Copiar enlace"
              >
                {copiedLink ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
              <a 
                href={generatedResult.magicLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50"
                title="Probar enlace"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Envía este link por WhatsApp. Al abrirlo, la app se activará automáticamente.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Opción 2: Código de Texto
            </label>
            <div className="relative">
              <textarea
                readOnly
                value={generatedResult.licenseBase64}
                className="w-full h-24 px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-mono text-gray-600 resize-none focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(generatedResult.licenseBase64, false)}
                className={`absolute top-2 right-2 p-1.5 rounded-md transition-colors ${copiedCode ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Si el link falla, envía este código para que lo peguen manualmente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
