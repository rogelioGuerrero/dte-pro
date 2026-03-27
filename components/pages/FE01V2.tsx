import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Send, Trash2 } from 'lucide-react';
import { useToast } from '../Toast';
import { useEmisor } from '../../contexts/EmisorContext';
import { checkLicense } from '../../utils/licenseValidator';
import { limpiarDteParaFirma, transmitirDocumento, type TransmitDTEResponse } from '../../utils/firmaApiClient';
import { buildFe01EmissionRequest, type Fe01ItemInput } from '../../utils/fe01Builder';
import { numeroALetras, redondear } from '../../utils/formatters';
import { getEmisor, type EmisorData } from '../../utils/emisorDb';

interface Fe01LineState {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
}

const createLine = (): Fe01LineState => ({
  descripcion: '',
  cantidad: 1,
  precioUnitario: 0,
  descuento: 0,
});

const formatCurrency = (value: number): string => `$${redondear(value || 0, 2).toFixed(2)}`;

export const FE01V2: React.FC = () => {
  const { addToast } = useToast();
  const { businessId, operationalBusinessId } = useEmisor();
  const [emisor, setEmisor] = useState<EmisorData | null>(null);
  const [receptorEmail, setReceptorEmail] = useState('');
  const [lineas, setLineas] = useState<Fe01LineState[]>([createLine()]);
  const [isSending, setIsSending] = useState(false);
  const [respuesta, setRespuesta] = useState<TransmitDTEResponse | { error: string } | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const stored = await getEmisor();
      if (mounted) setEmisor(stored);
    })();

    return () => {
      mounted = false;
    };
  }, [businessId, operationalBusinessId]);

  const validItems: Fe01ItemInput[] = useMemo(() => (
    lineas
      .filter((linea) => linea.descripcion.trim())
      .map((linea) => ({
        descripcion: linea.descripcion.trim(),
        cantidad: Number(linea.cantidad) || 0,
        precioUnitario: Number(linea.precioUnitario) || 0,
        descuento: Number(linea.descuento) || 0,
      }))
  ), [lineas]);

  const request = useMemo(() => {
    if (!emisor || !businessId || validItems.length === 0) return null;
    try {
      return buildFe01EmissionRequest({
        ambiente: '00',
        businessId,
        receptorEmail: receptorEmail.trim() || null,
        emisor,
        items: validItems,
      });
    } catch (error: unknown) {
      return { error: error instanceof Error ? error.message : 'No se pudo construir el payload FE 01 V2' };
    }
  }, [businessId, emisor, receptorEmail, validItems]);

  const resumen = request && !('error' in request) ? request.dte.resumen : null;
  const builderError = request && 'error' in request ? request.error : null;

  const updateLine = (index: number, patch: Partial<Fe01LineState>) => {
    setLineas((current) => current.map((linea, i) => (i === index ? { ...linea, ...patch } : linea)));
  };

  const handleSend = async () => {
    if (!request || 'error' in request) {
      addToast(builderError || 'Completa el formulario FE 01 V2.', 'error');
      return;
    }

    setIsSending(true);
    try {
      const licensed = await checkLicense();
      if (!licensed) {
        addToast('Necesitas licencia activa para transmitir.', 'error');
        return;
      }

      const transmitted = await transmitirDocumento({
        dte: limpiarDteParaFirma(request.dte as unknown as Record<string, unknown>),
        passwordPri: '',
        ambiente: request.ambiente,
        flowType: request.flowType,
        businessId: request.businessId,
        receptorEmail: request.receptorEmail,
      });

      setRespuesta(transmitted);
      setShowDebug(true);

      if (transmitted.transmitted || transmitted.isOffline) {
        addToast(transmitted.isOffline ? 'FE 01 V2 enviado en contingencia.' : 'FE 01 V2 enviado correctamente.', transmitted.isOffline ? 'info' : 'success');
      } else {
        addToast(transmitted.mhResponse?.mensaje || 'No se pudo transmitir FE 01 V2.', 'error');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al transmitir FE 01 V2';
      setRespuesta({ error: message });
      setShowDebug(true);
      addToast(message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Factura Electrónica 01 V2</p>
            <h1 className="text-2xl font-bold text-gray-900">Flujo nuevo y separado</h1>
            <p className="mt-1 text-sm text-gray-500">Construye el payload correcto y transmite sin tocar la pantalla anterior.</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-right text-sm text-gray-600">
            <div>Líneas: {lineas.length}</div>
            <div>IVA: {formatCurrency(resumen?.totalIva ?? 0)}</div>
            <div className="text-base font-semibold text-gray-900">Total: {formatCurrency(resumen?.totalPagar ?? 0)}</div>
          </div>
        </div>
      </div>

      {!emisor && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Primero configura el emisor en Mi Cuenta.
        </div>
      )}

      {builderError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {builderError}
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Correo del receptor</label>
          <input
            type="email"
            value={receptorEmail}
            onChange={(e) => setReceptorEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-indigo-500"
            placeholder="correo@cliente.com"
          />
        </div>

        <div className="space-y-3">
          {lineas.map((linea, index) => (
            <div key={index} className="grid gap-3 rounded-2xl border border-gray-200 p-4 md:grid-cols-[1.4fr,0.6fr,0.6fr,0.6fr,auto]">
              <input value={linea.descripcion} onChange={(e) => updateLine(index, { descripcion: e.target.value })} className="rounded-xl border border-gray-300 px-3 py-2" placeholder="Descripción" />
              <input type="number" min="1" step="1" value={linea.cantidad} onChange={(e) => updateLine(index, { cantidad: Number(e.target.value) })} className="rounded-xl border border-gray-300 px-3 py-2" placeholder="Cantidad" />
              <input type="number" min="0" step="0.01" value={linea.precioUnitario} onChange={(e) => updateLine(index, { precioUnitario: Number(e.target.value) })} className="rounded-xl border border-gray-300 px-3 py-2" placeholder="Precio" />
              <input type="number" min="0" step="0.01" value={linea.descuento} onChange={(e) => updateLine(index, { descuento: Number(e.target.value) })} className="rounded-xl border border-gray-300 px-3 py-2" placeholder="Descuento" />
              <button type="button" onClick={() => setLineas((current) => current.filter((_, i) => i !== index))} disabled={lineas.length === 1} className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-3 py-2 text-gray-600 disabled:opacity-40">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => setLineas((current) => [...current, createLine()])} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">
            <Plus className="h-4 w-4" />
            Agregar línea
          </button>
          <button type="button" onClick={handleSend} disabled={!request || 'error' in (request || {}) || isSending} className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Send className="h-4 w-4" />
            {isSending ? 'Enviando...' : 'Enviar FE 01 V2'}
          </button>
        </div>
      </section>

      {showDebug && request && !('error' in request) && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Resumen</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm text-gray-700">
            <div className="rounded-xl bg-gray-50 p-3">Base gravada: <span className="font-semibold">{formatCurrency(resumen?.totalGravada ?? 0)}</span></div>
            <div className="rounded-xl bg-gray-50 p-3">IVA: <span className="font-semibold">{formatCurrency(resumen?.totalIva ?? 0)}</span></div>
            <div className="rounded-xl bg-gray-50 p-3">Total: <span className="font-semibold">{formatCurrency(resumen?.totalPagar ?? 0)}</span></div>
          </div>
          <p className="mt-3 text-sm text-gray-500">{numeroALetras(resumen?.totalPagar ?? 0)}</p>
          {respuesta && <pre className="mt-4 overflow-auto rounded-xl bg-gray-900 p-4 text-xs text-gray-100">{JSON.stringify(respuesta, null, 2)}</pre>}
        </section>
      )}
    </div>
  );
};

export default FE01V2;
