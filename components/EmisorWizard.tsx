import React, { useMemo, useState } from 'react';
import { Building2, FileSignature, Settings2 } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { useEmisor } from '../contexts/EmisorContext';

interface EmisorWizardProps {
  onCompleted?: () => void;
}

type Step = 'datos' | 'firma' | 'codigos';

export const EmisorWizard: React.FC<EmisorWizardProps> = ({ onCompleted }) => {
  const { user } = useAuth();
  const { setBusinessId, reload } = useEmisor();
  const [step, setStep] = useState<Step>('datos');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [datos, setDatos] = useState({
    nit: '',
    nombre: '',
    correo: '',
    telefono: '',
    direccion: '',
  });

  const [firma, setFirma] = useState({
    ambiente: '00',
    certificateB64: '',
    certificatePassword: '',
    apiPassword: '',
    apiToken: '',
  });

  const [codigos, setCodigos] = useState({
    codEstable: '',
    codPuntoVenta: '',
  });

  const progress = useMemo(() => {
    if (step === 'datos') return 33;
    if (step === 'firma') return 66;
    return 100;
  }, [step]);

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleCertSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await toBase64(file);
    setFirma((prev) => ({ ...prev, certificateB64: b64 }));
  };

  const canContinueDatos = datos.nit.trim() && datos.nombre.trim() && datos.correo.trim();
  const canContinueFirma = true; // opcional que cargue cert ahora

  const handleSubmit = async () => {
    if (!user) {
      setError('Sesión no disponible');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const business = await apiFetch<{ business_id: string }>('/businesses', {
        method: 'POST',
        body: {
          nit: datos.nit.trim(),
          nombre: datos.nombre.trim(),
          correo: datos.correo.trim(),
          telefono: datos.telefono.trim() || null,
          dir_complemento: datos.direccion.trim() || null,
        },
      });
      const businessId = business.business_id;

      await apiFetch(`/mh_credentials/${businessId}`, {
        method: 'PUT',
        body: {
          ambiente: firma.ambiente,
          certificate_b64: firma.certificateB64 || undefined,
          password_pri: firma.certificatePassword || undefined,
          api_password: firma.apiPassword || undefined,
          api_token: firma.apiToken || undefined,
          cod_estable: codigos.codEstable || undefined,
          cod_punto_venta: codigos.codPuntoVenta || undefined,
        },
      });

      await apiFetch('/business_users', {
        method: 'POST',
        body: { businessId, userId: user.id, role: 'owner' },
      });

      setBusinessId(businessId);
      await reload();
      onCompleted?.();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'No se pudo completar el alta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Configuración inicial</p>
            <h1 className="text-2xl font-bold text-gray-900">Crear emisor</h1>
          </div>
          <div className="text-sm text-gray-600">{progress}%</div>
        </div>
        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex gap-2 text-sm font-medium">
          <button
            className={`flex-1 px-3 py-2 rounded-lg border ${step === 'datos' ? 'border-indigo-500 text-indigo-600' : 'border-gray-200 text-gray-600'}`}
            onClick={() => setStep('datos')}
          >
            <span className="inline-flex items-center gap-2"><Building2 className="w-4 h-4" /> Datos</span>
          </button>
          <button
            className={`flex-1 px-3 py-2 rounded-lg border ${step === 'firma' ? 'border-indigo-500 text-indigo-600' : 'border-gray-200 text-gray-600'}`}
            onClick={() => setStep('firma')}
          >
            <span className="inline-flex items-center gap-2"><FileSignature className="w-4 h-4" /> Firma/Token</span>
          </button>
          <button
            className={`flex-1 px-3 py-2 rounded-lg border ${step === 'codigos' ? 'border-indigo-500 text-indigo-600' : 'border-gray-200 text-gray-600'}`}
            onClick={() => setStep('codigos')}
          >
            <span className="inline-flex items-center gap-2"><Settings2 className="w-4 h-4" /> Códigos MH</span>
          </button>
        </div>

        {step === 'datos' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm text-gray-700">NIT *</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={datos.nit}
                onChange={(e) => setDatos((p) => ({ ...p, nit: e.target.value }))}
                required
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-700">Nombre / Razón Social *</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={datos.nombre}
                onChange={(e) => setDatos((p) => ({ ...p, nombre: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Correo *</label>
              <input
                type="email"
                className="w-full border rounded-lg px-3 py-2"
                value={datos.correo}
                onChange={(e) => setDatos((p) => ({ ...p, correo: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Teléfono</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={datos.telefono}
                onChange={(e) => setDatos((p) => ({ ...p, telefono: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-700">Dirección</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2"
                rows={2}
                value={datos.direccion}
                onChange={(e) => setDatos((p) => ({ ...p, direccion: e.target.value }))}
              />
            </div>
          </div>
        )}

        {step === 'firma' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-700">Ambiente</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={firma.ambiente}
                  onChange={(e) => setFirma((p) => ({ ...p, ambiente: e.target.value }))}
                >
                  <option value="00">Sandbox</option>
                  <option value="01">Producción</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700">Password API</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={firma.apiPassword}
                  onChange={(e) => setFirma((p) => ({ ...p, apiPassword: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-700">Token API</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={firma.apiToken}
                  onChange={(e) => setFirma((p) => ({ ...p, apiToken: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-gray-700">Password del certificado</label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2"
                  value={firma.certificatePassword}
                  onChange={(e) => setFirma((p) => ({ ...p, certificatePassword: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-700">Certificado .p12</label>
              <input type="file" accept=".p12" onChange={handleCertSelect} />
              {firma.certificateB64 && <p className="text-xs text-green-600 mt-1">Certificado cargado</p>}
            </div>
          </div>
        )}

        {step === 'codigos' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-700">Código Establecimiento</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={codigos.codEstable}
                onChange={(e) => setCodigos((p) => ({ ...p, codEstable: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">Código Punto de Venta</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={codigos.codPuntoVenta}
                onChange={(e) => setCodigos((p) => ({ ...p, codPuntoVenta: e.target.value }))}
              />
            </div>
          </div>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">Paso {step === 'datos' ? '1/3' : step === 'firma' ? '2/3' : '3/3'}</div>
          <div className="flex gap-2">
            {step !== 'datos' && (
              <button
                type="button"
                onClick={() => setStep(step === 'firma' ? 'datos' : 'firma')}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
              >
                Atrás
              </button>
            )}
            {step !== 'codigos' && (
              <button
                type="button"
                disabled={step === 'datos' ? !canContinueDatos : !canContinueFirma}
                onClick={() => setStep(step === 'datos' ? 'firma' : 'codigos')}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60"
              >
                Continuar
              </button>
            )}
            {step === 'codigos' && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Finalizar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
