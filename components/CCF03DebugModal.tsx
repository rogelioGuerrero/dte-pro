import React, { useMemo, useState } from 'react';
import { Copy, FileJson, Layers3, ShieldCheck, Sparkles, X } from 'lucide-react';
import { numeroALetras, redondear, type DTEJSON } from '../utils/dteGenerator';

interface CCF03DebugModalProps {
  open: boolean;
  onClose: () => void;
  payloadText: string;
  currentPayload: unknown;
  generatedDTE: DTEJSON | null;
  mhResult: any;
  totalGravada: number;
  totalPagar: number;
  businessId: string | null;
  receptorEmail: string | null;
}

const TabButton: React.FC<{
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
  >
    {children}
  </button>
);

const InfoChip: React.FC<{ label: string; value: string | number | null | undefined }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
    <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-mono text-slate-800 break-all">{value === null || value === undefined || value === '' ? '—' : String(value)}</p>
  </div>
);

const CCF03DebugModal: React.FC<CCF03DebugModalProps> = ({
  open,
  onClose,
  payloadText,
  currentPayload,
  generatedDTE,
  mhResult,
  totalGravada,
  totalPagar,
  businessId,
  receptorEmail,
}) => {
  const [tab, setTab] = useState<'payload' | 'resumen' | 'reglas'>('payload');
  const [copied, setCopied] = useState(false);

  const payableLabel = useMemo(() => numeroALetras(totalPagar) || '', [totalPagar]);

  if (!open) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(currentPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl bg-slate-50 shadow-2xl border border-slate-200 flex flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-semibold">
              <FileJson className="w-3.5 h-3.5" />
              Depuración técnica
            </div>
            <h2 className="mt-2 text-lg font-bold text-slate-900">Panel técnico del CCF 03</h2>
            <p className="text-sm text-slate-500">Úsalo solo para revisar payload, resumen y reglas internas.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
          <TabButton active={tab === 'payload'} onClick={() => setTab('payload')}>Payload final</TabButton>
          <TabButton active={tab === 'resumen'} onClick={() => setTab('resumen')}>Resumen MH</TabButton>
          <TabButton active={tab === 'reglas'} onClick={() => setTab('reglas')}>Reglas clave</TabButton>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === 'payload' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <InfoChip label="Business ID" value={businessId} />
                <InfoChip label="Receptor email" value={receptorEmail} />
                <InfoChip label="tipoDte" value="03" />
                <InfoChip label="version" value={3} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-950 text-slate-100 p-4 max-h-[48vh] overflow-auto">
                <pre className="text-[11px] leading-5 font-mono whitespace-pre-wrap break-words">{payloadText}</pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 text-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-200 transition"
                >
                  <Copy className="w-4 h-4" /> {copied ? '¡Copiado!' : 'Copiar payload'}
                </button>
              </div>
            </div>
          )}

          {tab === 'resumen' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <InfoChip label="Total gravada" value={generatedDTE ? generatedDTE.resumen.totalGravada.toFixed(2) : totalGravada.toFixed(2)} />
                <InfoChip label="Total a pagar" value={generatedDTE ? generatedDTE.resumen.totalPagar.toFixed(2) : totalPagar.toFixed(2)} />
                <InfoChip label="Total en letras" value={payableLabel} />
                <InfoChip label="Código generación" value={generatedDTE?.identificacion.codigoGeneracion || '—'} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900 mb-3">Flujo resumido</p>
                <div className="space-y-3 text-sm text-slate-600">
                  <p>1. Se valida el formulario y se construye el DTE.</p>
                  <p>2. Se genera el wrapper de transmisión con `businessId` y `receptorEmail`.</p>
                  <p>3. Se envía al backend para firma y transmisión a MH.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900 mb-3">Respuesta backend</p>
                {mhResult ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InfoChip label="Estado" value={mhResult?.mhResponse?.estado || mhResult?.estado || '—'} />
                    <InfoChip label="Mensaje" value={mhResult?.mhResponse?.mensaje || mhResult?.message || mhResult?.error || '—'} />
                    <InfoChip label="Sello recepción" value={mhResult?.mhResponse?.selloRecepcion || '—'} />
                    <InfoChip label="Código generación" value={mhResult?.mhResponse?.codigoGeneracion || generatedDTE?.identificacion.codigoGeneracion || '—'} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Aún no hay respuesta MH. Genera y transmite el payload para ver el resultado aquí.</p>
                )}
              </div>
            </div>
          )}

          {tab === 'reglas' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Reglas activas</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">Versión fija <span className="font-semibold">3</span> para tipo DTE <span className="font-semibold">03</span>.</li>
                  <li className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">Precio unitario capturado <span className="font-semibold">sin IVA</span>.</li>
                  <li className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">Tributo <span className="font-semibold">20</span> aplicado por defecto en líneas gravadas.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Uso recomendado</p>
                <p className="mt-3 text-sm text-slate-600">Este panel es para depuración y revisión técnica, no para el uso cotidiano del operador de tienda.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CCF03DebugModal;
