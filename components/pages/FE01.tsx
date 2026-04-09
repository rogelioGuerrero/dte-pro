import React, { useEffect, useMemo, useState } from 'react';
import { FileJson, FilePlus2, Plus, Send, Trash2, X } from 'lucide-react';
import { ToastContainer, useToast } from '../Toast';
import { useEmisor } from '../../contexts/EmisorContext';
import { checkLicense } from '../../utils/licenseValidator';
import { limpiarDteParaFirma, transmitirDocumento, type TransmitDTEResponse } from '../../utils/dteApiClient';
import { generarCorrelativoControlado, generarNumeroControl, generarUUID, numeroALetras, obtenerFechaActual, obtenerHoraActual, redondear } from '../../utils/formatters';
import { getEmisor, type EmisorData } from '../../utils/emisorDb';
import type { DTEJSON } from '../../utils/types';

const formatCurrency = (value: number): string => `$${redondear(value || 0, 2).toFixed(2)}`;

interface FE01ItemForm {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUni: number;
  montoDescu: number;
}

const createItem = (index: number): FE01ItemForm => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `fe01-item-${Date.now()}-${index}`,
  descripcion: '',
  cantidad: 1,
  precioUni: 0,
  montoDescu: 0,
});

const normalizeEmail = (value: string): string | null => {
  const normalized = (value || '').trim();
  return normalized.length > 0 ? normalized : null;
};

export const FE01: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();
  const { businessId, operationalBusinessId } = useEmisor();
  const [emisor, setEmisor] = useState<EmisorData | null>(null);
  const [receptorEmail, setReceptorEmail] = useState('');
  const [receptorDireccion, setReceptorDireccion] = useState('');
  const [items, setItems] = useState<FE01ItemForm[]>([createItem(1)]);
  const [isSending, setIsSending] = useState(false);
  const [respuesta, setRespuesta] = useState<TransmitDTEResponse | { error: string } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [ambiente] = useState<'00' | '01'>(() => (localStorage.getItem('dte_ambiente') as '00' | '01') || '00');

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const stored = await getEmisor();
      if (mounted) {
        setEmisor(stored);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [businessId, operationalBusinessId]);

  const handleReset = () => {
    setReceptorEmail('');
    setReceptorDireccion('');
    setItems([createItem(1)]);
    setRespuesta(null);
    setShowDebug(false);
  };

  const resolvedBusinessId = businessId || operationalBusinessId;

  const itemPreview = useMemo(() => {
    return items.map((item, index) => {
      const cantidad = redondear(Number(item.cantidad) || 0, 8);
      const precioUni = redondear(Number(item.precioUni) || 0, 8);
      const montoDescu = redondear(Number(item.montoDescu) || 0, 8);
      const ventaConIva = redondear((precioUni * cantidad) - montoDescu, 8);
      const ventaGravada = redondear(ventaConIva > 0 ? ventaConIva / 1.13 : 0, 8);
      const ivaItem = redondear(ventaConIva - ventaGravada, 2);
      return {
        numItem: index + 1,
        tipoItem: 2,
        cantidad,
        codigo: null,
        uniMedida: 59,
        descripcion: item.descripcion.trim(),
        precioUni,
        montoDescu,
        ivaItem,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada,
        tributos: null,
        numeroDocumento: null,
        codTributo: null,
        psv: 0,
        noGravado: 0,
      };
    });
  }, [items]);

  const resumenPreview = useMemo(() => {
    const totalGravada = redondear(itemPreview.reduce((sum, item) => sum + item.ventaGravada, 0), 2);
    const totalIva = redondear(itemPreview.reduce((sum, item) => sum + item.ivaItem, 0), 2);
    const totalDescu = redondear(itemPreview.reduce((sum, item) => sum + item.montoDescu, 0), 2);
    const subTotalVentas = redondear(totalGravada, 2);
    const subTotal = subTotalVentas;
    const montoTotalOperacion = redondear(subTotal + totalIva, 2);
    const totalPagar = montoTotalOperacion;
    return {
      totalGravada,
      totalIva,
      totalDescu,
      subTotalVentas,
      subTotal,
      totalPagar,
      montoTotalOperacion,
    };
  }, [itemPreview]);

  const totalItems = itemPreview.length;
  const totalBaseMasIva = useMemo(() => {
    return redondear(resumenPreview.totalPagar, 2);
  }, [resumenPreview.totalPagar]);

  const updateItem = (index: number, field: keyof FE01ItemForm, value: string) => {
    setItems((prev) => prev.map((item, idx) => {
      if (idx !== index) return item;
      if (field === 'descripcion') return { ...item, descripcion: value };
      const parsed = Number(value);
      return { ...item, [field]: Number.isFinite(parsed) ? parsed : 0 };
    }));
  };

  const addItem = () => setItems((prev) => [...prev, createItem(prev.length + 1)]);
  const removeItem = (index: number) => setItems((prev) => (prev.length === 1 ? [createItem(1)] : prev.filter((_, idx) => idx !== index)));

  const buildRequest = () => {
    if (!emisor || !resolvedBusinessId) {
      addToast('Falta el emisor o el negocio activo.', 'error');
      return null;
    }

    const errors: string[] = [];
    if (!emisor.nit?.trim()) errors.push('NIT del emisor es obligatorio.');
    if (!emisor.nrc?.trim()) errors.push('NRC del emisor es obligatorio.');
    if (!emisor.nombre?.trim()) errors.push('Nombre del emisor es obligatorio.');
    if (!emisor.actividadEconomica?.trim()) errors.push('Código de actividad del emisor es obligatorio.');
    if (!emisor.descActividad?.trim()) errors.push('Descripción de actividad del emisor es obligatoria.');
    if (!emisor.departamento?.trim() || !emisor.municipio?.trim() || !emisor.direccion?.trim()) {
      errors.push('Dirección del emisor incompleta.');
    }
    if (!emisor.telefono?.trim()) errors.push('Teléfono del emisor es obligatorio.');
    if (!emisor.correo?.trim()) errors.push('Correo del emisor es obligatorio.');
    if (!emisor.codEstableMH?.trim()) errors.push('Código de establecimiento MH es obligatorio.');
    if (!emisor.codPuntoVentaMH?.trim()) errors.push('Código de punto de venta MH es obligatorio.');

    if (items.length === 0) errors.push('Debes agregar al menos un ítem.');
    itemPreview.forEach((item, index) => {
      if (!item.descripcion) errors.push(`Ítem ${index + 1}: descripción obligatoria.`);
      if (item.cantidad <= 0) errors.push(`Ítem ${index + 1}: cantidad debe ser mayor que 0.`);
      if (item.precioUni < 0) errors.push(`Ítem ${index + 1}: precio unitario no puede ser negativo.`);
      if (item.montoDescu < 0) errors.push(`Ítem ${index + 1}: descuento no puede ser negativo.`);
      if (item.ventaGravada < 0) errors.push(`Ítem ${index + 1}: venta gravada no puede ser negativa.`);
    });

    const receptorDireccionFinal = receptorDireccion.trim() || 'DIRECCION NO ESPECIFICADA';
    if (!receptorDireccion.trim()) {
      addToast('Se aplicó dirección genérica del receptor. Corrígela antes de emitir en producción.', 'info');
    }

    const sumIvaBody = redondear(itemPreview.reduce((sum, item) => sum + item.ivaItem, 0), 2);
    const pagosMonto = resumenPreview.totalPagar;
    if (Math.abs(resumenPreview.totalPagar - pagosMonto) > 0.01) {
      errors.push('Descuadre: totalPagar y pagos[0].montoPago no coinciden.');
    }
    if (Math.abs(resumenPreview.totalIva - sumIvaBody) > 0.01) {
      errors.push('Descuadre: totalIva y suma(ivaItem) no coinciden.');
    }
    if (Math.abs(resumenPreview.subTotal - resumenPreview.subTotalVentas) > 0.01) {
      errors.push('Descuadre: subTotal no coincide con subTotalVentas.');
    }

    if (errors.length > 0) {
      errors.forEach((error) => addToast(error, 'error'));
      return null;
    }

    const correlativo = generarCorrelativoControlado('01', emisor.codEstableMH, emisor.codPuntoVentaMH);
    const numeroControl = generarNumeroControl('01', correlativo, emisor.codEstableMH, emisor.codPuntoVentaMH);
    const totalLetras = numeroALetras(resumenPreview.totalPagar).trim().endsWith('USD')
      ? numeroALetras(resumenPreview.totalPagar)
      : `${numeroALetras(resumenPreview.totalPagar)} USD`;

    const dte: DTEJSON = {
      identificacion: {
        version: 1,
        ambiente,
        tipoDte: '01',
        numeroControl,
        codigoGeneracion: generarUUID(),
        tipoModelo: 1,
        tipoOperacion: 1,
        tipoContingencia: null,
        motivoContin: null,
        fecEmi: obtenerFechaActual(),
        horEmi: obtenerHoraActual(),
        tipoMoneda: 'USD',
      },
      documentoRelacionado: null,
      emisor: {
        nit: emisor.nit,
        nrc: emisor.nrc,
        nombre: emisor.nombre,
        codActividad: emisor.actividadEconomica,
        descActividad: emisor.descActividad,
        nombreComercial: null,
        tipoEstablecimiento: emisor.tipoEstablecimiento,
        codEstable: null,
        codPuntoVenta: null,
        direccion: {
          departamento: emisor.departamento,
          municipio: emisor.municipio,
          complemento: emisor.direccion,
        },
        telefono: emisor.telefono,
        correo: emisor.correo,
        codEstableMH: emisor.codEstableMH,
        codPuntoVentaMH: emisor.codPuntoVentaMH,
      },
      receptor: {
        tipoDocumento: null,
        numDocumento: null,
        nrc: null,
        nombre: 'Consumidor Final',
        nombreComercial: null,
        codActividad: null,
        descActividad: null,
        direccion: {
          departamento: emisor.departamento,
          municipio: emisor.municipio,
          complemento: receptorDireccionFinal,
        },
        telefono: null,
        correo: normalizeEmail(receptorEmail),
      },
      otrosDocumentos: null,
      ventaTercero: null,
      cuerpoDocumento: itemPreview,
      resumen: {
        totalNoSuj: 0,
        totalExenta: 0,
        totalGravada: resumenPreview.totalGravada,
        subTotalVentas: resumenPreview.subTotalVentas,
        descuNoSuj: 0,
        descuExenta: 0,
        descuGravada: resumenPreview.totalDescu,
        porcentajeDescuento: 0,
        totalDescu: resumenPreview.totalDescu,
        tributos: null,
        subTotal: resumenPreview.subTotal,
        ivaRete1: 0,
        reteRenta: 0,
        montoTotalOperacion: resumenPreview.montoTotalOperacion,
        totalNoGravado: 0,
        totalPagar: resumenPreview.totalPagar,
        totalLetras,
        totalIva: resumenPreview.totalIva,
        saldoFavor: 0,
        condicionOperacion: 1,
        pagos: [
          {
            codigo: '01',
            montoPago: resumenPreview.totalPagar,
            referencia: null,
            plazo: null,
            periodo: null,
          },
        ],
        ivaPerci1: 0,
        numPagoElectronico: null,
      },
      extension: {
        nombEntrega: null,
        docuEntrega: null,
        nombRecibe: null,
        docuRecibe: null,
        observaciones: null,
        placaVehiculo: null,
      },
      apendice: null,
    };

    return {
      dte,
      ambiente,
      flowType: 'emission' as const,
      businessId: resolvedBusinessId,
      receptorEmail: normalizeEmail(receptorEmail),
    };
  };

  const handleSend = async () => {
    const request = buildRequest();
    if (!request) return;

    setIsSending(true);
    try {
      const licensed = await checkLicense();
      if (!licensed) {
        addToast('Necesitas licencia activa para transmitir.', 'error');
        return;
      }

      console.log('=== PAYLOAD ANTES DE LIMPIAR ===');
      console.log(JSON.stringify(request.dte, null, 2));
      
      const dteLimpio = limpiarDteParaFirma(request.dte as unknown as Record<string, unknown>);
      
      console.log('=== PAYLOAD DESPUÉS DE LIMPIAR ===');
      console.log(JSON.stringify(dteLimpio, null, 2));

      const transmitted = await transmitirDocumento({
        dte: dteLimpio,
        passwordPri: '',
        ambiente: request.ambiente,
        flowType: request.flowType,
        businessId: request.businessId,
        receptorEmail: request.receptorEmail,
      });

      setRespuesta(transmitted);
      setShowDebug(true);

      if (transmitted.transmitted || transmitted.isOffline) {
        addToast(transmitted.isOffline ? 'Documento enviado en contingencia.' : 'Factura 01 enviada correctamente.', transmitted.isOffline ? 'info' : 'success');
      } else {
        addToast(transmitted.mhResponse?.mensaje || 'No se pudo transmitir.', 'error');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al transmitir FE 01';
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            
            <h1 className="text-2xl font-bold text-gray-900">Factura Electrónica Consumidor Final 01</h1>
            
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDebug(true)}
              title="Detalle técnico"
              aria-label="Detalle técnico"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-2 text-sm font-medium hover:bg-indigo-100 transition border border-indigo-200"
            >
              <FileJson className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {!emisor && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Primero configura el emisor en Mi Cuenta.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4 lg:col-span-8">
          

          <div className="grid gap-4 md:grid-cols-2">
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
            <div>
              <label className="text-sm font-medium text-gray-700">Dirección receptor</label>
              <input
                type="text"
                value={receptorDireccion}
                onChange={(e) => setReceptorDireccion(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-indigo-500"
                placeholder="Opcional: Colonia, calle y referencia"
              />
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const ventaConIva = redondear(((Number(item.precioUni) || 0) * (Number(item.cantidad) || 0)) - (Number(item.montoDescu) || 0), 8);
              const ventaGravada = redondear(ventaConIva > 0 ? ventaConIva / 1.13 : 0, 8);
              const ivaItem = redondear(ventaConIva - ventaGravada, 2);
              const totalLineaFinal = redondear(ventaConIva, 2);
              return (
                <div key={item.id} className="rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Ítem #{index + 1}</h3>
                    <span className="text-xs text-gray-500">Unidad 59</span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-7">
                      <label className="text-sm font-medium text-gray-700">Descripción</label>
                      <input
                        type="text"
                        value={item.descripcion}
                        onChange={(e) => updateItem(index, 'descripcion', e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-indigo-500"
                        placeholder="Producto o servicio"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.cantidad}
                        onChange={(e) => updateItem(index, 'cantidad', e.target.value)}
                        className="mt-1 w-full max-w-[110px] rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-sm font-medium text-gray-700">Precio Unitario</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.precioUni}
                        onChange={(e) => updateItem(index, 'precioUni', e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <label className="text-sm font-medium text-gray-700">Descuento</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.montoDescu}
                        onChange={(e) => updateItem(index, 'montoDescu', e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="md:col-span-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                      <div className="text-xs text-gray-500">Venta gravada</div>
                      <div className="font-semibold">{formatCurrency(ventaGravada)}</div>
                    </div>
                    <div className="md:col-span-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                      <div className="text-xs text-gray-500">IVA</div>
                      <div className="font-semibold">{formatCurrency(ivaItem)}</div>
                    </div>
                    <div className="md:col-span-3 rounded-xl bg-gray-900 p-3 text-sm text-white">
                      <div className="text-xs text-gray-300">Total</div>
                      <div className="font-semibold">{formatCurrency(totalLineaFinal)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Quitar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Agregar ítem
          </button>
        </section>

        <aside className="lg:col-span-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4 lg:sticky lg:top-20">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Resumen del documento</h2>
              
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span>Items</span>
                <span className="font-semibold text-gray-900">{totalItems}</span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Subtotal (gravada)</span>
                <span className="font-semibold text-gray-900">{formatCurrency(resumenPreview.totalGravada)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Descuento total</span>
                <span className="font-semibold text-gray-900">{formatCurrency(resumenPreview.totalDescu)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Subtotal final</span>
                <span className="font-semibold text-gray-900">{formatCurrency(resumenPreview.subTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>IVA (13%)</span>
                <span className="font-semibold text-gray-900">{formatCurrency(resumenPreview.totalIva)}</span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-600">Total a pagar</div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalBaseMasIva)}</div>
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={!emisor || !resolvedBusinessId || isSending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {isSending ? 'Enviando...' : 'Firmar y Enviar FE 01'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 text-slate-700 px-4 py-3 text-sm font-medium hover:bg-slate-200 transition border border-slate-200"
            >
              <FilePlus2 className="h-4 w-4" />
              Nueva Factura
            </button>
          </div>
        </aside>
      </div>

      {showDebug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Detalle técnico FE 01</h2>
              <button
                type="button"
                onClick={() => setShowDebug(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cerrar detalle técnico"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-5">
              <div className="grid gap-3 md:grid-cols-3 text-sm text-gray-700">
                <div className="rounded-xl bg-gray-50 p-3">Monto gravado: <span className="font-semibold">{formatCurrency(resumenPreview.totalGravada)}</span></div>
                <div className="rounded-xl bg-gray-50 p-3">IVA: <span className="font-semibold">{formatCurrency(resumenPreview.totalIva)}</span></div>
                <div className="rounded-xl bg-gray-50 p-3">Total: <span className="font-semibold">{formatCurrency(resumenPreview.totalPagar)}</span></div>
              </div>
              <p className="text-sm text-gray-500">{numeroALetras(resumenPreview.totalPagar)}</p>
              {respuesta ? (
                <pre className="overflow-auto rounded-xl bg-gray-900 p-4 text-xs text-gray-100">{JSON.stringify(respuesta, null, 2)}</pre>
              ) : (
                <p className="text-sm text-gray-500">Aún no hay respuesta de transmisión para mostrar.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default FE01;
