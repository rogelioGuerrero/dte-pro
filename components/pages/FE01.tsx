import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { useToast } from '../Toast';
import { useEmisor } from '../../contexts/EmisorContext';
import { checkLicense } from '../../utils/licenseValidator';
import { limpiarDteParaFirma, transmitirDocumento, type TransmitDTEResponse } from '../../utils/firmaApiClient';
import { numeroALetras, redondear } from '../../utils/formatters';
import { getEmisor, type EmisorData } from '../../utils/emisorDb';
import type { DTEJSON } from '../../utils/types';

const formatCurrency = (value: number): string => `$${redondear(value || 0, 2).toFixed(2)}`;

const buildMinimalFe01Dte = (emisor: EmisorData, receptorEmail: string | null): DTEJSON => {
  const cantidad = 1;
  const totalVenta = 10;
  const ventaGravada = totalVenta;
  const baseGravadaParaIva = redondear(totalVenta / 1.13, 2);
  const totalIva = redondear(totalVenta - baseGravadaParaIva, 2);
  const subTotal = redondear(ventaGravada, 2);
  const montoTotalOperacion = redondear(totalVenta, 2);

  return {
    identificacion: {
      version: 1,
      ambiente: '00',
      tipoDte: '01',
      numeroControl: `DTE-01-${String(emisor.codEstableMH || 'M001').replace(/\D/g, '').padStart(4, '0').slice(-4)}${String(emisor.codPuntoVentaMH || 'P001').replace(/\D/g, '').padStart(4, '0').slice(-4)}-${Date.now().toString().slice(-15)}`,
      codigoGeneracion: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().toUpperCase()
        : `XXXXXXXX-XXXX-4XXX-YXXX-${Date.now().toString(16).toUpperCase().padStart(12, '0')}`,
      tipoModelo: 1,
      tipoOperacion: 1,
      tipoContingencia: null,
      motivoContin: null,
      fecEmi: new Date().toISOString().slice(0, 10),
      horEmi: new Date().toTimeString().slice(0, 8),
      tipoMoneda: 'USD',
    },
    documentoRelacionado: null,
    emisor: {
      nit: emisor.nit,
      nrc: emisor.nrc,
      nombre: emisor.nombre,
      codActividad: emisor.actividadEconomica || '00000',
      descActividad: emisor.descActividad,
      nombreComercial: emisor.nombreComercial ?? null,
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
        complemento: 'Consumidor final',
      },
      telefono: null,
      correo: receptorEmail,
    },
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento: [
      {
        numItem: 1,
        tipoItem: 2,
        cantidad,
        codigo: null,
        uniMedida: 59,
        descripcion: 'Prueba FE01',
        precioUni: ventaGravada,
        montoDescu: 0,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada: ventaGravada,
        tributos: ['20'],
        numeroDocumento: null,
        codTributo: null,
        psv: 0,
        noGravado: 0,
        ivaItem: totalIva,
      },
    ],
    resumen: {
      totalNoSuj: 0,
      totalExenta: 0,
      totalGravada: ventaGravada,
      subTotalVentas: ventaGravada,
      descuNoSuj: 0,
      descuExenta: 0,
      descuGravada: 0,
      porcentajeDescuento: 0,
      totalDescu: 0,
      totalIva,
      tributos: [{ codigo: '20', descripcion: 'IVA 13%', valor: totalIva }],
      subTotal,
      ivaRete1: 0,
      reteRenta: 0,
      montoTotalOperacion,
      totalNoGravado: 0,
      totalPagar: montoTotalOperacion,
      totalLetras: numeroALetras(montoTotalOperacion),
      saldoFavor: 0,
      condicionOperacion: 1,
      pagos: [
        {
          codigo: '01',
          montoPago: montoTotalOperacion,
          referencia: null,
          plazo: null,
          periodo: null,
        },
      ],
      ivaPerci1: 0,
      numPagoElectronico: null,
    },
    extension: null,
    apendice: null,
  };
};

export const FE01: React.FC = () => {
  const { addToast } = useToast();
  const { businessId, operationalBusinessId } = useEmisor();
  const [emisor, setEmisor] = useState<EmisorData | null>(null);
  const [receptorEmail, setReceptorEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [respuesta, setRespuesta] = useState<TransmitDTEResponse | { error: string } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const ambiente: '00' | '01' = '00';

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

  const request = emisor && businessId
    ? {
        dte: buildMinimalFe01Dte(emisor, receptorEmail.trim() || null),
        ambiente,
        flowType: 'emission' as const,
        businessId,
        receptorEmail: receptorEmail.trim() || null,
      }
    : null;

  const resumen = request?.dte.resumen ?? null;

  const handleSend = async () => {
    if (!request || 'error' in request) {
      addToast('Falta el emisor o el negocio activo.', 'error');
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
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Factura Electrónica 01</p>
            <h1 className="text-2xl font-bold text-gray-900">Consumidor final limpio</h1>
            <p className="mt-1 text-sm text-gray-500">Pantalla desacoplada, usando solo `fe01Builder.ts`.</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-right text-sm text-gray-600">
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

        <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
          Se enviará un ítem fijo de <strong>$10.00</strong> con IVA <strong>13%</strong>.
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!request || isSending}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {isSending ? 'Enviando...' : 'Enviar FE 01'}
        </button>
      </section>

      {showDebug && request && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Resumen</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm text-gray-700">
            <div className="rounded-xl bg-gray-50 p-3">Monto gravado: <span className="font-semibold">{formatCurrency(resumen?.totalGravada ?? 0)}</span></div>
            <div className="rounded-xl bg-gray-50 p-3">IVA: <span className="font-semibold">{formatCurrency(resumen?.totalIva ?? 0)}</span></div>
            <div className="rounded-xl bg-gray-50 p-3">Total: <span className="font-semibold">{formatCurrency(resumen?.totalPagar ?? 0)}</span></div>
          </div>
          <p className="mt-3 text-sm text-gray-500">{numeroALetras(resumen?.totalPagar ?? 0)}</p>
          {respuesta && (
            <pre className="mt-4 overflow-auto rounded-xl bg-gray-900 p-4 text-xs text-gray-100">{JSON.stringify(respuesta, null, 2)}</pre>
          )}
        </section>
      )}
    </div>
  );
};

export default FE01;
