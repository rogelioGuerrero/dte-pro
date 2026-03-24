import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { useToast } from '../Toast';
import { useEmisor } from '../../contexts/EmisorContext';
import { getEmisor, type EmisorData } from '../../utils/emisorDb';
import { checkLicense } from '../../utils/licenseValidator';
import { getCertificate } from '../../utils/secureStorage';
import { limpiarDteParaFirma, transmitirDocumento, type TransmitDTEResponse } from '../../utils/firmaApiClient';
import { buildFe01EmissionRequest } from '../../utils/dte01Builder';
import { redondear } from '../../utils/formatters';

interface SaleLine {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
}

const createLine = (): SaleLine => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `line-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  descripcion: '',
  cantidad: 1,
  precioUnitario: 0,
  descuento: 0,
});

const formatCurrency = (value: number): string => `$${redondear(value || 0, 2).toFixed(2)}`;
const safeText = (value: string): string => value.trim();

const Factura01Page: React.FC = () => {
  const { addToast } = useToast();
  const { businessId, operationalBusinessId } = useEmisor();

  const [emisor, setEmisor] = useState<EmisorData | null>(null);
  const [ambiente, setAmbiente] = useState<'00' | '01'>(() => {
    const stored = localStorage.getItem('dte_ambiente');
    return stored === '01' ? '01' : '00';
  });
  const [receptorEmail, setReceptorEmail] = useState('');
  const [lines, setLines] = useState<SaleLine[]>([createLine()]);
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<TransmitDTEResponse | { error: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const stored = await getEmisor();
      if (mounted) setEmisor(stored);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('dte_ambiente', ambiente);
  }, [ambiente]);

  const lineTotals = useMemo(() => {
    const gross = lines.reduce((sum, line) => {
      const qty = redondear(Number(line.cantidad) || 0, 8);
      const price = redondear(Number(line.precioUnitario) || 0, 8);
      const discount = redondear(Number(line.descuento) || 0, 8);
      return sum + Math.max(0, redondear((qty * price) - discount, 8));
    }, 0);

    const base = gross > 0 ? redondear(gross / 1.13, 8) : 0;
    const iva = gross > 0 ? redondear(base * 0.13, 2) : 0;
    const total = redondear(gross, 2);

    return { gross, base, iva, total };
  }, [lines]);

  const resolvedBusinessId = businessId || operationalBusinessId || emisor?.nit || null;
  const canSend = Boolean(
    emisor &&
      resolvedBusinessId &&
      lines.some((line) => safeText(line.descripcion) && Number(line.cantidad) > 0)
  );

  const updateLine = (id: string, patch: Partial<SaleLine>) => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const addLine = () => setLines((current) => [...current, createLine()]);

  const removeLine = (id: string) => {
    setLines((current) => {
      const next = current.filter((line) => line.id !== id);
      return next.length > 0 ? next : [createLine()];
    });
  };

  const resetForm = () => {
    setLines([createLine()]);
    setReceptorEmail('');
    setResponse(null);
  };

  const handleSend = async () => {
    if (!emisor) {
      addToast('Primero guarda los datos del emisor.', 'error');
      return;
    }

    if (!resolvedBusinessId) {
      addToast('No se pudo resolver el negocio activo.', 'error');
      return;
    }

    const validLines = lines.filter((line) => safeText(line.descripcion));
    if (!validLines.length) {
      addToast('Agrega al menos una línea con descripción.', 'error');
      return;
    }

    setIsSending(true);
    try {
      const licensed = await checkLicense();
      if (!licensed) {
        addToast('Necesitas licencia activa para transmitir.', 'error');
        return;
      }

      const certificate = await getCertificate();
      const request = buildFe01EmissionRequest({
        ambiente,
        businessId: resolvedBusinessId,
        receptorEmail: safeText(receptorEmail) || null,
        emisor,
        items: validLines.map((line) => ({
          cantidad: Number(line.cantidad) || 0,
          descripcion: safeText(line.descripcion),
          precioUnitario: Number(line.precioUnitario) || 0,
          descuento: Number(line.descuento) || 0,
        })),
      });

      const transmitted = await transmitirDocumento({
        dte: limpiarDteParaFirma(request.dte as unknown as Record<string, unknown>),
        passwordPri: certificate?.password || '',
        ambiente: request.ambiente,
        flowType: request.flowType,
        businessId: request.businessId,
        receptorEmail: request.receptorEmail,
      });

      setResponse(transmitted);

      const ok = transmitted.transmitted === true && transmitted.mhResponse?.success === true;
      if (ok) {
        addToast('Factura 01 enviada correctamente.', 'success');
        resetForm();
      } else if (transmitted.isOffline) {
        addToast(transmitted.contingencyReason || 'Documento enviado en contingencia.', 'info');
      } else {
        addToast(transmitted.mhResponse?.mensaje || 'No se pudo transmitir la factura.', 'error');
      }
    } catch (error: any) {
      const message = error?.message || 'Error al transmitir la factura 01';
      setResponse({ error: message });
      addToast(message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const mhMessage = response
    ? ('mhResponse' in response
      ? response.mhResponse?.mensaje || 'Respuesta recibida del backend.'
      : typeof response.error === 'string'
        ? response.error
        : response.error?.message || 'Error al transmitir la factura 01')
    : '';

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-4 md:space-y-6 md:px-6 md:py-6">
      <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-4 md:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-600">
              Factura 01
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Consumidor final</h1>
              <p className="text-sm text-gray-500">Captura lo esencial y envía.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Líneas</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{lines.length}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">IVA</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(lineTotals.iva)}</div>
            </div>
            <div className="col-span-2 rounded-2xl border border-gray-900 bg-gray-900 px-4 py-3 text-white sm:col-span-1">
              <div className="text-[11px] uppercase tracking-wide text-gray-300">Total</div>
              <div className="mt-1 text-lg font-semibold">{formatCurrency(lineTotals.total)}</div>
            </div>
          </div>
        </div>

        {!emisor && (
          <div className="mx-4 mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 md:mx-5 md:mt-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>Guarda el emisor antes de emitir.</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 p-4 md:p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <section className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)] md:items-end">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Ambiente</span>
                  <select
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value as '00' | '01')}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                  >
                    <option value="00">Pruebas</option>
                    <option value="01">Producción</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Correo del cliente</span>
                  <input
                    type="email"
                    value={receptorEmail}
                    onChange={(e) => setReceptorEmail(e.target.value)}
                    placeholder="opcional@correo.com"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 md:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Líneas</h2>
                </div>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" />
                  Agregar línea
                </button>
              </div>

              <div className="space-y-3 p-4 md:p-5">
                {lines.map((line, index) => (
                  <div key={line.id} className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-[minmax(0,1.6fr)_96px_116px_96px_auto] md:items-end">
                    <label className="space-y-1 md:col-span-1">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Producto</span>
                      <input
                        type="text"
                        value={line.descripcion}
                        onChange={(e) => updateLine(line.id, { descripcion: e.target.value })}
                        placeholder={`Producto ${index + 1}`}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Cant.</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={line.cantidad}
                        onChange={(e) => updateLine(line.id, { cantidad: Number(e.target.value) })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Precio</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.precioUnitario}
                        onChange={(e) => updateLine(line.id, { precioUnitario: Number(e.target.value) })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Desc.</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.descuento}
                        onChange={(e) => updateLine(line.id, { descuento: Number(e.target.value) })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-400 transition hover:border-red-200 hover:text-red-600"
                      title="Eliminar línea"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
              <h2 className="text-sm font-semibold text-gray-900">Resumen</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between text-gray-600">
                  <span>Base gravada estimada</span>
                  <span className="font-medium text-gray-900">{formatCurrency(lineTotals.base)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>IVA 13%</span>
                  <span className="font-medium text-gray-900">{formatCurrency(lineTotals.iva)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-gray-900 px-4 py-3 text-white">
                  <span>Total a pagar</span>
                  <span className="text-base font-semibold">{formatCurrency(lineTotals.total)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <h2 className="text-sm font-semibold text-gray-900">Acciones</h2>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend || isSending}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSending ? 'Enviando...' : 'Enviar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Nueva factura
              </button>
              {mhMessage && (
                <div className={`mt-3 rounded-2xl border px-3 py-2 text-xs ${response && 'error' in response ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-200 bg-white text-gray-700'}`}>
                  {mhMessage}
                </div>
              )}
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
};

export default Factura01Page;
