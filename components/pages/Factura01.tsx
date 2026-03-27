import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { useToast } from '../Toast';
import { useEmisor } from '../../contexts/EmisorContext';
import { getEmisor, type EmisorData } from '../../utils/emisorDb';
import { checkLicense } from '../../utils/licenseValidator';
import { getCertificate } from '../../utils/secureStorage';
import { limpiarDteParaFirma, transmitirDocumento, type TransmitDTEResponse } from '../../utils/firmaApiClient';
import { buildFe01EmissionRequest } from '../../utils/fe01Builder';
import { redondear } from '../../utils/formatters';

interface SaleLine {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
}

type Fe01BuilderResult = ReturnType<typeof buildFe01EmissionRequest>;
type Fe01BuilderError = { error: string };
type Fe01BuilderState = Fe01BuilderResult | Fe01BuilderError | null;

const createLine = (): SaleLine => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `line-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  descripcion: '',
  cantidad: 1,
  precioUnitario: 0,
  descuento: 0,
});

const formatCurrency = (value: number): string => `$${redondear(value || 0, 2).toFixed(2)}`;
const safeText = (value: string): string => value.trim();

const buildDebugPayloadText = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return 'No se pudo serializar el payload de diagnóstico.';
  }
};

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
  const [showDebugPanel, setShowDebugPanel] = useState(false);

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

  const resolvedBusinessId = businessId || operationalBusinessId || emisor?.nit || null;

  const builderResult = useMemo<Fe01BuilderState>(() => {
    const validLines = lines
      .filter((line) => safeText(line.descripcion))
      .map((line) => ({
        cantidad: Number(line.cantidad) || 0,
        descripcion: safeText(line.descripcion),
        precioUnitario: Number(line.precioUnitario) || 0,
        descuento: Number(line.descuento) || 0,
      }));

    if (!emisor || !resolvedBusinessId || !validLines.length) {
      return null;
    }

    try {
      return buildFe01EmissionRequest({
        ambiente,
        businessId: resolvedBusinessId,
        receptorEmail: safeText(receptorEmail) || null,
        emisor,
        items: validLines,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo generar el payload de diagnóstico.';
      return {
        error: message,
      };
    }
  }, [ambiente, emisor, lines, receptorEmail, resolvedBusinessId]);

  const debugPayload = useMemo(() => {
    if (!builderResult || 'error' in builderResult) {
      return builderResult;
    }

    return {
      request: {
        ambiente: builderResult.ambiente,
        flowType: builderResult.flowType,
        businessId: builderResult.businessId,
        receptorEmail: builderResult.receptorEmail,
      },
      dte: limpiarDteParaFirma(builderResult.dte as unknown as Record<string, unknown>),
    };
  }, [builderResult]);

  const debugPayloadText = useMemo(() => buildDebugPayloadText(debugPayload), [debugPayload]);
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
      const request = builderResult && !('error' in builderResult)
        ? builderResult
        : buildFe01EmissionRequest({
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
        setShowDebugPanel(true);
      } else {
        addToast(transmitted.mhResponse?.mensaje || 'No se pudo transmitir la factura.', 'error');
        setShowDebugPanel(true);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al transmitir la factura 01';
      setResponse({ error: message });
      setShowDebugPanel(true);
      addToast(message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const copyDebugPayload = async () => {
    try {
      await navigator.clipboard.writeText(debugPayloadText);
      addToast('Payload de diagnóstico copiado.', 'success');
    } catch {
      addToast('No se pudo copiar el payload.', 'error');
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
    <div className="mx-auto max-w-4xl px-3 py-3 sm:px-4 md:px-6 md:py-6">
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-3">
            <div className="inline-flex w-fit items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">
              Factura 01
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">Consumidor final</h1>
              <p className="mt-1 text-sm text-gray-500 md:text-base">Escribe lo mínimo y pulsa enviar.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-gray-600">
              <span className="rounded-full bg-gray-100 px-3 py-1">Líneas: {lines.length}</span>
              <span className="rounded-full bg-gray-100 px-3 py-1">IVA: {formatCurrency(builderResult && !('error' in builderResult) ? builderResult.dte.resumen.totalIva : 0)}</span>
              <span className="rounded-full bg-gray-900 px-3 py-1 font-semibold text-white">Total: {formatCurrency(builderResult && !('error' in builderResult) ? builderResult.dte.resumen.totalPagar : 0)}</span>
            </div>
          </div>
        </div>

        {!emisor && (
          <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 md:mx-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span>Primero guarda el emisor para poder emitir.</span>
            </div>
          </div>
        )}

        <div className="space-y-5 px-4 py-4 md:px-6 md:py-6">
          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-gray-700">Ambiente</span>
                <select
                  value={ambiente}
                  onChange={(e) => setAmbiente(e.target.value as '00' | '01')}
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-800 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                >
                  <option value="00">Pruebas</option>
                  <option value="01">Producción</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-medium text-gray-700">Correo del cliente</span>
                <input
                  type="email"
                  value={receptorEmail}
                  onChange={(e) => setReceptorEmail(e.target.value)}
                  placeholder="opcional@correo.com"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-800 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 md:px-5">
              <h2 className="text-base font-semibold text-gray-900">Líneas</h2>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </div>

            <div className="space-y-4 px-4 py-4 md:px-5 md:py-5">
              {lines.map((line, index) => (
                <div key={line.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">Línea {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-gray-500 transition hover:bg-white hover:text-red-600"
                      title="Eliminar línea"
                    >
                      <Trash2 className="h-4 w-4" />
                      Quitar
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <label className="space-y-2 md:col-span-2">
                      <span className="block text-sm font-medium text-gray-700">Producto</span>
                      <input
                        type="text"
                        value={line.descripcion}
                        onChange={(e) => updateLine(line.id, { descripcion: e.target.value })}
                        placeholder={`Producto ${index + 1}`}
                        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-800 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="block text-sm font-medium text-gray-700">Cant.</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={line.cantidad}
                        onChange={(e) => updateLine(line.id, { cantidad: Number(e.target.value) })}
                        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-800 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="block text-sm font-medium text-gray-700">Precio</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.precioUnitario}
                        onChange={(e) => updateLine(line.id, { precioUnitario: Number(e.target.value) })}
                        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-800 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="block text-sm font-medium text-gray-700">Desc.</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.descuento}
                        onChange={(e) => updateLine(line.id, { descuento: Number(e.target.value) })}
                        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-800 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5">
            <div className="flex items-center justify-between text-sm text-gray-700">
              <span>Base gravada</span>
              <span className="font-medium text-gray-900">{formatCurrency(builderResult && !('error' in builderResult) ? builderResult.dte.resumen.totalGravada : 0)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-gray-700">
              <span>IVA 13%</span>
              <span className="font-medium text-gray-900">{formatCurrency(builderResult && !('error' in builderResult) ? builderResult.dte.resumen.totalIva : 0)}</span>
            </div>
            <div className="mt-4 rounded-2xl bg-gray-900 px-4 py-4 text-white">
              <div className="text-sm text-gray-300">Total a pagar</div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(builderResult && !('error' in builderResult) ? builderResult.dte.resumen.totalPagar : 0)}</div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || isSending}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 text-base font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {isSending ? 'Enviando...' : 'Enviar factura'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Nueva factura
            </button>

            <button
              type="button"
              onClick={() => setShowDebugPanel((current) => !current)}
              className="h-11 w-full rounded-2xl border border-dashed border-gray-300 bg-white px-4 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              {showDebugPanel ? 'Ocultar diagnóstico' : 'Ver diagnóstico'}
            </button>

            {mhMessage && (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${response && 'error' in response ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                {mhMessage}
              </div>
            )}

            {showDebugPanel && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Diagnóstico</h3>
                    <p className="text-xs text-gray-500">Payload limpio antes de enviar y últimos datos útiles para depurar.</p>
                  </div>
                  <button
                    type="button"
                    onClick={copyDebugPayload}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Copiar
                  </button>
                </div>
                <pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-white p-3 text-[11px] leading-5 text-gray-700">
                  {debugPayloadText}
                </pre>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
};

export default Factura01Page;
