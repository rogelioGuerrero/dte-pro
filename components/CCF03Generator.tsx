import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Copy,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  User,
  FileJson,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react';
import { useEmisor } from '../contexts/EmisorContext';
import { useToast, ToastContainer } from './Toast';
import { getClients, type ClientData } from '../utils/clientDb';
import { getEmisor, saveEmisor, type EmisorData } from '../utils/emisorDb';
import { checkLicense } from '../utils/licenseValidator';
import { getCertificate } from '../utils/secureStorage';
import { limpiarDteParaFirma, transmitirDocumento } from '../utils/firmaApiClient';
import {
  calcularTotales,
  generarCorrelativoControlado,
  generarDTE,
  numeroALetras,
  redondear,
  type DTEJSON,
  type ItemFactura,
} from '../utils/dteGenerator';
import SelectUbicacion from './formularios/SelectUbicacion';
import SelectActividad from './formularios/SelectActividad';
import SelectCatalogo from './formularios/SelectCatalogo';
import { condicionesOperacion, formasPago, tiposEstablecimiento, tiposModelo, tiposTransmision } from '../catalogos';
import { obtenerFechaActual, obtenerHoraActual } from '../utils/formatters';

interface CCF03ItemForm {
  id: string;
  tipoItem: 1 | 2;
  codigo: string;
  descripcion: string;
  cantidad: number;
  uniMedida: number;
  precioUni: number;
  montoDescu: number;
  esExento: boolean;
}

interface ReceptorForm {
  nit: string;
  nrc: string;
  nombre: string;
  nombreComercial: string;
  codActividad: string;
  descActividad: string;
  departamento: string;
  municipio: string;
  direccion: string;
  telefono: string;
  correo: string;
}

const emptyReceptorForm: ReceptorForm = {
  nit: '',
  nrc: '',
  nombre: '',
  nombreComercial: '',
  codActividad: '',
  descActividad: '',
  departamento: '',
  municipio: '',
  direccion: '',
  telefono: '',
  correo: '',
};

const emptyEmisorForm = (base?: Partial<EmisorData>): Omit<EmisorData, 'id'> => ({
  nit: base?.nit || '',
  nrc: base?.nrc || '',
  nombre: base?.nombre || '',
  nombreComercial: base?.nombreComercial || '',
  actividadEconomica: base?.actividadEconomica || '',
  descActividad: base?.descActividad || '',
  tipoEstablecimiento: base?.tipoEstablecimiento || '01',
  departamento: base?.departamento || '',
  municipio: base?.municipio || '',
  direccion: base?.direccion || '',
  telefono: base?.telefono || '',
  correo: base?.correo || '',
  codEstableMH: base?.codEstableMH || 'M001',
  codPuntoVentaMH: base?.codPuntoVentaMH || 'P001',
  logo: base?.logo,
});

const createItem = (index: number): CCF03ItemForm => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `item-${Date.now()}-${index}`,
  tipoItem: 2,
  codigo: '',
  descripcion: '',
  cantidad: 1,
  uniMedida: 59,
  precioUni: 0,
  montoDescu: 0,
  esExento: false,
});

const onlyDigits = (value: string): string => (value || '').replace(/\D/g, '');
const trimOrNull = (value: string): string | null => {
  const normalized = (value || '').trim();
  return normalized ? normalized : null;
};
const normalizeEmail = (value: string): string | null => {
  const normalized = (value || '').trim();
  if (!normalized) return null;
  return normalized;
};
const isValidEmail = (value: string): boolean => {
  if (!value.trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};
const makeDateTime = () => ({ fecEmi: obtenerFechaActual(), horEmi: obtenerHoraActual() });
const makeEmptyErrors = () => [] as string[];

const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, icon, children, actions }) => (
  <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-4 md:px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/70">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
    <div className="p-4 md:p-6">{children}</div>
  </section>
);

const PayloadTag: React.FC<{ label: string; value: string | number | null | undefined }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
    <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-mono text-slate-800 break-all">{value === null || value === undefined || value === '' ? '—' : String(value)}</p>
  </div>
);

const CCF03Generator: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();
  const { businessId, operationalBusinessId } = useEmisor();

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);

  const [emisorForm, setEmisorForm] = useState<Omit<EmisorData, 'id'>>(emptyEmisorForm());
  const [receptorForm, setReceptorForm] = useState<ReceptorForm>(emptyReceptorForm);
  const [receptorEmail, setReceptorEmail] = useState('');
  const [items, setItems] = useState<CCF03ItemForm[]>([createItem(1)]);
  const [formaPago, setFormaPago] = useState('01');
  const [condicionOperacion, setCondicionOperacion] = useState(1);
  const [ambiente, setAmbiente] = useState<'00' | '01'>('00');
  const [observaciones, setObservaciones] = useState('');
  const [generatedDTE, setGeneratedDTE] = useState<DTEJSON | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [mhResult, setMhResult] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [savedEmisor, setSavedEmisor] = useState<EmisorData | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [storedEmisor, loadedClients] = await Promise.all([getEmisor(), getClients()]);
        if (!mounted) return;
        if (storedEmisor) {
          setSavedEmisor(storedEmisor);
          setEmisorForm(emptyEmisorForm(storedEmisor));
        }
        setClients(loadedClients);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const resolvedBusinessId = businessId || operationalBusinessId || null;

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 10);
    const term = clientSearch.trim().toLowerCase();
    return clients.filter((client) => {
      return (
        client.name.toLowerCase().includes(term) ||
        client.nit.toLowerCase().includes(term) ||
        client.nrc.toLowerCase().includes(term) ||
        (client.nombreComercial || '').toLowerCase().includes(term)
      );
    }).slice(0, 12);
  }, [clients, clientSearch]);

  const itemPreview = useMemo<ItemFactura[]>(() => {
    return items.map((item, index) => {
      const cantidad = redondear(Number(item.cantidad) || 0, 8);
      const precioUni = redondear(Number(item.precioUni) || 0, 8);
      const montoDescu = redondear(Number(item.montoDescu) || 0, 8);
      const totalLinea = redondear(cantidad * precioUni - montoDescu, 8);
      const ventaGravada = item.esExento ? 0 : totalLinea;
      const ventaExenta = item.esExento ? totalLinea : 0;
      return {
        numItem: index + 1,
        tipoItem: item.tipoItem,
        cantidad,
        codigo: trimOrNull(item.codigo),
        uniMedida: item.uniMedida || 59,
        descripcion: item.descripcion,
        precioUni,
        montoDescu,
        ventaNoSuj: 0,
        ventaExenta,
        ventaGravada,
        tributos: item.esExento ? null : ['20'],
        numeroDocumento: null,
        codTributo: null,
        psv: 0,
        noGravado: 0,
        ivaItem: item.esExento ? 0 : redondear(ventaGravada * 0.13, 2),
      };
    });
  }, [items]);

  const totales = useMemo(() => calcularTotales(itemPreview, '03'), [itemPreview]);

  const buildDTE = () => {
    const payloadErrors = makeEmptyErrors();
    const nitEmisor = onlyDigits(emisorForm.nit);
    const nrcEmisor = onlyDigits(emisorForm.nrc);
    const receptorNit = onlyDigits(receptorForm.nit);
    const receptorNrc = onlyDigits(receptorForm.nrc);

    if (!(nitEmisor.length === 9 || nitEmisor.length === 14)) payloadErrors.push('El NIT del emisor debe tener 9 o 14 dígitos.');
    if (!nrcEmisor) payloadErrors.push('El NRC del emisor es obligatorio.');
    if (!emisorForm.nombre.trim()) payloadErrors.push('El nombre del emisor es obligatorio.');
    if (!emisorForm.actividadEconomica.trim()) payloadErrors.push('La actividad económica del emisor es obligatoria.');
    if (!emisorForm.descActividad.trim()) payloadErrors.push('La descripción de actividad del emisor es obligatoria.');
    if (!emisorForm.direccion.trim()) payloadErrors.push('La dirección del emisor es obligatoria.');
    if (!emisorForm.telefono.trim()) payloadErrors.push('El teléfono del emisor es obligatorio.');
    if (!isValidEmail(emisorForm.correo)) payloadErrors.push('El correo del emisor no es válido.');
    if (!emisorForm.codEstableMH?.trim()) payloadErrors.push('El código de establecimiento MH es obligatorio.');
    if (!emisorForm.codPuntoVentaMH?.trim()) payloadErrors.push('El código de punto de venta MH es obligatorio.');

    if (!(receptorNit.length === 9 || receptorNit.length === 14)) payloadErrors.push('El NIT del receptor debe tener 9 o 14 dígitos.');
    if (!receptorNrc) payloadErrors.push('El NRC del receptor es obligatorio.');
    if (!receptorForm.nombre.trim()) payloadErrors.push('El nombre del receptor es obligatorio.');
    if (!receptorForm.codActividad.trim()) payloadErrors.push('La actividad económica del receptor es obligatoria.');
    if (!receptorForm.descActividad.trim()) payloadErrors.push('La descripción de actividad del receptor es obligatoria.');
    if (!receptorForm.departamento.trim() || !receptorForm.municipio.trim() || !receptorForm.direccion.trim()) {
      payloadErrors.push('La dirección del receptor debe incluir departamento, municipio y complemento.');
    }

    if (!items.length) payloadErrors.push('Debes agregar al menos un ítem.');
    items.forEach((item, index) => {
      const cantidad = Number(item.cantidad) || 0;
      const precio = Number(item.precioUni) || 0;
      const descuento = Number(item.montoDescu) || 0;
      const totalLinea = redondear(cantidad * precio, 8);
      if (!item.descripcion.trim()) payloadErrors.push(`Ítem ${index + 1}: la descripción es obligatoria.`);
      if (cantidad <= 0) payloadErrors.push(`Ítem ${index + 1}: la cantidad debe ser mayor que 0.`);
      if (precio < 0) payloadErrors.push(`Ítem ${index + 1}: el precio unitario no puede ser negativo.`);
      if (descuento < 0) payloadErrors.push(`Ítem ${index + 1}: el descuento no puede ser negativo.`);
      if (descuento > totalLinea) payloadErrors.push(`Ítem ${index + 1}: el descuento no puede superar el total de la línea.`);
    });

    setValidationErrors(payloadErrors);
    if (payloadErrors.length > 0) {
      payloadErrors.forEach((error) => addToast(error, 'error'));
      return null;
    }

    const datosFactura = {
      emisor: {
        ...emisorForm,
        nit: nitEmisor,
        nrc: nrcEmisor,
        nombreComercial: trimOrNull(emisorForm.nombreComercial) || '',
        codEstableMH: trimOrNull(String(emisorForm.codEstableMH || '')) || 'M001',
        codPuntoVentaMH: trimOrNull(String(emisorForm.codPuntoVentaMH || '')) || 'P001',
      },
      receptor: {
        nit: receptorNit,
        nrc: receptorNrc,
        name: receptorForm.nombre.trim(),
        nombreComercial: trimOrNull(receptorForm.nombreComercial) || '',
        actividadEconomica: receptorForm.codActividad.trim(),
        descActividad: receptorForm.descActividad.trim(),
        departamento: receptorForm.departamento.trim(),
        municipio: receptorForm.municipio.trim(),
        direccion: receptorForm.direccion.trim(),
        telefono: onlyDigits(receptorForm.telefono),
        email: trimOrNull(receptorEmail) || '',
        id: selectedClient?.id,
        timestamp: Date.now(),
      },
      items: itemPreview,
      tipoDocumento: '03',
      tipoTransmision: 1,
      formaPago,
      condicionOperacion,
      observaciones,
    } as any;

    const correlativo = generarCorrelativoControlado('03', datosFactura.emisor.codEstableMH, datosFactura.emisor.codPuntoVentaMH);
    const dte = generarDTE(datosFactura, correlativo, ambiente);
    setGeneratedDTE(dte);
    setMhResult(null);
    addToast('Payload CCF 03 generado correctamente.', 'success');
    return dte;
  };

  const buildWrapper = (dte: DTEJSON) => ({
    dte,
    ambiente,
    flowType: 'emission' as const,
    businessId: resolvedBusinessId,
    receptorEmail: normalizeEmail(receptorEmail),
  });

  const handleGeneratePayload = async () => {
    setIsGenerating(true);
    try {
      buildDTE();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveEmisor = async () => {
    try {
      await saveEmisor(emisorForm);
      const saved = await getEmisor();
      setSavedEmisor(saved);
      addToast('Datos del emisor guardados.', 'success');
    } catch (error) {
      console.error(error);
      addToast('No se pudo guardar el emisor.', 'error');
    }
  };

  const handleSelectClient = (client: ClientData) => {
    setSelectedClient(client);
    setReceptorForm({
      nit: client.nit || '',
      nrc: client.nrc || '',
      nombre: client.name || '',
      nombreComercial: client.nombreComercial || '',
      codActividad: client.actividadEconomica || '',
      descActividad: client.descActividad || '',
      departamento: client.departamento || '',
      municipio: client.municipio || '',
      direccion: client.direccion || '',
      telefono: client.telefono || '',
      correo: client.email || '',
    });
    setReceptorEmail(client.email || '');
    setShowClientSearch(false);
    setClientSearch('');
  };

  const updateItem = (index: number, field: keyof CCF03ItemForm, value: string | number | boolean) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, createItem(prev.length + 1)]);
  const removeItem = (index: number) => setItems((prev) => (prev.length === 1 ? [createItem(1)] : prev.filter((_, idx) => idx !== index)));

  const handleTransmit = async () => {
    if (!resolvedBusinessId) {
      addToast('Selecciona un emisor antes de transmitir.', 'error');
      return;
    }

    const licensed = await checkLicense();
    if (!licensed) {
      addToast('Licencia requerida para transmitir desde este dispositivo.', 'error');
      return;
    }

    const dte = generatedDTE || buildDTE();
    if (!dte) return;

    setIsTransmitting(true);
    try {
      const storedCertificate = await getCertificate();
      const payload = buildWrapper(dte);
      const dteLimpio = limpiarDteParaFirma(payload.dte as unknown as Record<string, unknown>);
      const response = await transmitirDocumento({
        dte: dteLimpio,
        passwordPri: storedCertificate?.password || undefined,
        ambiente,
        flowType: 'emission',
        businessId: resolvedBusinessId,
        receptorEmail: normalizeEmail(receptorEmail),
      });
      setMhResult(response);

      const ok = response.transmitted === true && response.mhResponse?.success === true;
      if (ok) {
        addToast('CCF 03 transmitido a Hacienda.', 'success');
      } else if (response.isOffline) {
        addToast(response.contingencyReason || 'Documento enviado a contingencia.', 'info');
      } else {
        addToast(response.mhResponse?.mensaje || response.message || 'No se pudo transmitir el documento.', 'error');
      }
    } catch (error: any) {
      setMhResult({ error: error?.message || 'Error desconocido' });
      addToast(error?.message || 'Error al transmitir', 'error');
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleCopyPayload = async () => {
    const dte = generatedDTE || buildDTE();
    if (!dte) return;
    const payload = buildWrapper(dte);
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    addToast('Payload copiado al portapapeles.', 'success');
  };

  const handleReset = () => {
    setSelectedClient(null);
    setClientSearch('');
    setShowClientSearch(false);
    setReceptorForm(emptyReceptorForm);
    setReceptorEmail('');
    setItems([createItem(1)]);
    setFormaPago('01');
    setCondicionOperacion(1);
    setObservaciones('');
    setGeneratedDTE(null);
    setMhResult(null);
    setValidationErrors([]);
  };

  const currentPayload = generatedDTE ? buildWrapper(generatedDTE) : null;
  const payloadText = currentPayload ? JSON.stringify(currentPayload, null, 2) : 'Genera el payload para visualizar aquí la estructura final.';
  const payableLabel = numeroALetras(totales.totalPagar) || '';

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-500">
        Cargando formulario CCF 03...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/80">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                Nuevo formulario orientado al payload MH
              </div>
              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-slate-900">Comprobante de Crédito Fiscal Electrónico 03</h1>
              <p className="mt-1 text-sm text-slate-500 max-w-3xl">
                Captura el CCF exactamente como lo requiere Hacienda: identificación, emisor, receptor, cuerpo, resumen y wrapper de transmisión.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleSaveEmisor} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition">
                <ShieldCheck className="w-4 h-4" /> Guardar emisor
              </button>
              <button onClick={handleCopyPayload} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 text-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-200 transition">
                <Copy className="w-4 h-4" /> Copiar payload
              </button>
              <button onClick={handleTransmit} disabled={isTransmitting} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50">
                <Send className="w-4 h-4" /> {isTransmitting ? 'Transmitiendo...' : 'Transmitir'}
              </button>
              <button onClick={handleReset} className="inline-flex items-center gap-2 rounded-xl bg-rose-50 text-rose-700 px-4 py-2 text-sm font-medium hover:bg-rose-100 transition">
                <RefreshCw className="w-4 h-4" /> Reiniciar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-8 space-y-5">
            <SectionCard
              title="Identificación y transmisión"
              subtitle="Valores fijos o controlados desde el formulario para coincidir con el payload oficial."
              icon={<ReceiptText className="w-4 h-4" />}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectCatalogo
                  label="Ambiente"
                  catalogo={[{ codigo: '00', descripcion: 'Pruebas' }, { codigo: '01', descripcion: 'Producción' }]}
                  value={ambiente}
                  onChange={(value) => setAmbiente(value as '00' | '01')}
                  showCode
                />
                <SelectCatalogo
                  label="Condición de operación"
                  catalogo={condicionesOperacion}
                  value={condicionOperacion}
                  onChange={(value) => setCondicionOperacion(Number(value) as number)}
                  showCode
                />
                <SelectCatalogo
                  label="Forma de pago"
                  catalogo={formasPago}
                  value={formaPago}
                  onChange={setFormaPago}
                  showCode
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Tipo modelo</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{tiposModelo.find((t) => t.codigo === 1)?.codigo} - {tiposModelo.find((t) => t.codigo === 1)?.descripcion}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Tipo operación</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{tiposTransmision.find((t) => t.codigo === 1)?.codigo} - {tiposTransmision.find((t) => t.codigo === 1)?.descripcion}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <PayloadTag label="Fecha" value={generatedDTE?.identificacion.fecEmi || makeDateTime().fecEmi} />
                <PayloadTag label="Hora" value={generatedDTE?.identificacion.horEmi || makeDateTime().horEmi} />
                <PayloadTag label="Moneda" value="USD" />
              </div>
            </SectionCard>

            <SectionCard
              title="Emisor"
              subtitle="Los campos de emisor se envían tal como los exige MH en CCF 03."
              icon={<Building2 className="w-4 h-4" />}
              actions={<span className="text-xs text-slate-500">{savedEmisor ? 'Cargado desde almacenamiento local' : 'Sin emisor guardado'}</span>}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">NIT</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={emisorForm.nit} onChange={(e) => setEmisorForm((prev) => ({ ...prev, nit: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">NRC</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={emisorForm.nrc} onChange={(e) => setEmisorForm((prev) => ({ ...prev, nrc: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Nombre</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={emisorForm.nombre} onChange={(e) => setEmisorForm((prev) => ({ ...prev, nombre: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Nombre comercial</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={emisorForm.nombreComercial} onChange={(e) => setEmisorForm((prev) => ({ ...prev, nombreComercial: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <SelectActividad
                    label="Actividad económica"
                    value={emisorForm.actividadEconomica}
                    onChange={(codigo, descripcion) => setEmisorForm((prev) => ({ ...prev, actividadEconomica: codigo, descActividad: descripcion }))}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Descripción de actividad</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={emisorForm.descActividad} onChange={(e) => setEmisorForm((prev) => ({ ...prev, descActividad: e.target.value }))} />
                </div>
                <SelectCatalogo
                  label="Tipo de establecimiento"
                  catalogo={tiposEstablecimiento}
                  value={emisorForm.tipoEstablecimiento}
                  onChange={(value) => setEmisorForm((prev) => ({ ...prev, tipoEstablecimiento: value }))}
                  showCode
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Código estab. MH</label>
                    <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={emisorForm.codEstableMH || ''} onChange={(e) => setEmisorForm((prev) => ({ ...prev, codEstableMH: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Código punto venta MH</label>
                    <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={emisorForm.codPuntoVentaMH || ''} onChange={(e) => setEmisorForm((prev) => ({ ...prev, codPuntoVentaMH: e.target.value }))} />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <SelectUbicacion
                    departamento={emisorForm.departamento}
                    municipio={emisorForm.municipio}
                    onDepartamentoChange={(codigo) => setEmisorForm((prev) => ({ ...prev, departamento: codigo }))}
                    onMunicipioChange={(codigo) => setEmisorForm((prev) => ({ ...prev, municipio: codigo }))}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Dirección completa</label>
                  <textarea className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[96px]" value={emisorForm.direccion} onChange={(e) => setEmisorForm((prev) => ({ ...prev, direccion: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Teléfono</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={emisorForm.telefono} onChange={(e) => setEmisorForm((prev) => ({ ...prev, telefono: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Correo</label>
                  <input type="email" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={emisorForm.correo} onChange={(e) => setEmisorForm((prev) => ({ ...prev, correo: e.target.value }))} />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Receptor"
              subtitle="CCF 03 requiere receptor completo, con NIT y NRC válidos."
              icon={<User className="w-4 h-4" />}
              actions={
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowClientSearch((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200">
                    <Search className="w-3.5 h-3.5" /> Buscar cliente
                  </button>
                  <button type="button" onClick={() => { setSelectedClient(null); setReceptorForm(emptyReceptorForm); setReceptorEmail(''); }} className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100">
                    <Trash2 className="w-3.5 h-3.5" /> Limpiar
                  </button>
                </div>
              }
            >
              {showClientSearch && (
                <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Clientes guardados</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Buscar por nombre, NIT o NRC..."
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm"
                    />
                  </div>
                  <div className="mt-3 max-h-56 overflow-y-auto space-y-2">
                    {filteredClients.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">Sin resultados</p>
                    ) : (
                      filteredClients.map((client) => (
                        <button
                          type="button"
                          key={client.id}
                          onClick={() => handleSelectClient(client)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50 transition"
                        >
                          <p className="text-sm font-semibold text-slate-900 truncate">{client.name}</p>
                          <p className="text-xs text-slate-500 mt-1">NIT: {client.nit} · NRC: {client.nrc || '—'}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">NIT receptor</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={receptorForm.nit} onChange={(e) => setReceptorForm((prev) => ({ ...prev, nit: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">NRC receptor</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={receptorForm.nrc} onChange={(e) => setReceptorForm((prev) => ({ ...prev, nrc: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Nombre receptor</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={receptorForm.nombre} onChange={(e) => setReceptorForm((prev) => ({ ...prev, nombre: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Nombre comercial</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={receptorForm.nombreComercial} onChange={(e) => setReceptorForm((prev) => ({ ...prev, nombreComercial: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <SelectActividad
                    label="Actividad económica receptor"
                    value={receptorForm.codActividad}
                    onChange={(codigo, descripcion) => setReceptorForm((prev) => ({ ...prev, codActividad: codigo, descActividad: descripcion }))}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Descripción de actividad</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={receptorForm.descActividad} onChange={(e) => setReceptorForm((prev) => ({ ...prev, descActividad: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <SelectUbicacion
                    departamento={receptorForm.departamento}
                    municipio={receptorForm.municipio}
                    onDepartamentoChange={(codigo) => setReceptorForm((prev) => ({ ...prev, departamento: codigo }))}
                    onMunicipioChange={(codigo) => setReceptorForm((prev) => ({ ...prev, municipio: codigo }))}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Dirección completa</label>
                  <textarea className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[96px]" value={receptorForm.direccion} onChange={(e) => setReceptorForm((prev) => ({ ...prev, direccion: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Teléfono receptor</label>
                  <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={receptorForm.telefono} onChange={(e) => setReceptorForm((prev) => ({ ...prev, telefono: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Correo receptor</label>
                  <input type="email" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={receptorForm.correo} onChange={(e) => setReceptorForm((prev) => ({ ...prev, correo: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Correo para envío / notificación</label>
                  <input type="email" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={receptorEmail} onChange={(e) => setReceptorEmail(e.target.value)} placeholder="Se enviará desde este correo si es distinto al receptor" />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Cuerpo del documento"
              subtitle="Precio unitario sin IVA, tributo 20 aplicado por defecto y descuentos por línea."
              icon={<FileJson className="w-4 h-4" />}
              actions={
                <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700">
                  <Plus className="w-3.5 h-3.5" /> Agregar ítem
                </button>
              }
            >
              <div className="space-y-4">
                {items.map((item, index) => {
                  const preview = itemPreview[index];
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Ítem {index + 1}</p>
                          <p className="text-xs text-slate-500">Campos alineados al cuerpoDocumento del CCF 03</p>
                        </div>
                        <button type="button" onClick={() => removeItem(index)} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-rose-700 border border-rose-200 hover:bg-rose-50">
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Tipo ítem</label>
                          <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white" value={item.tipoItem} onChange={(e) => updateItem(index, 'tipoItem', Number(e.target.value) as 1 | 2)}>
                            <option value={1}>Bien</option>
                            <option value={2}>Servicio</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Código</label>
                          <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={item.codigo} onChange={(e) => updateItem(index, 'codigo', e.target.value)} placeholder="Opcional" />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Descripción</label>
                          <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={item.descripcion} onChange={(e) => updateItem(index, 'descripcion', e.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Cantidad</label>
                          <input type="number" min="0" step="0.00000001" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={item.cantidad} onChange={(e) => updateItem(index, 'cantidad', Number(e.target.value) || 0)} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Uni. medida</label>
                          <input type="number" min="1" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={item.uniMedida} onChange={(e) => updateItem(index, 'uniMedida', Number(e.target.value) || 59)} />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Precio unitario sin IVA</label>
                          <input type="number" min="0" step="0.00000001" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={item.precioUni} onChange={(e) => updateItem(index, 'precioUni', Number(e.target.value) || 0)} />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Descuento</label>
                          <input type="number" min="0" step="0.00000001" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={item.montoDescu} onChange={(e) => updateItem(index, 'montoDescu', Number(e.target.value) || 0)} />
                        </div>
                        <div className="md:col-span-3">
                          <label className="inline-flex items-center gap-2 text-sm text-slate-700 mt-7">
                            <input type="checkbox" className="rounded border-slate-300" checked={item.esExento} onChange={(e) => updateItem(index, 'esExento', e.target.checked)} />
                            Exento
                          </label>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <PayloadTag label="Base línea" value={redondear((item.cantidad || 0) * (item.precioUni || 0) - (item.montoDescu || 0), 2).toFixed(2)} />
                        <PayloadTag label="Venta gravada" value={preview ? preview.ventaGravada.toFixed(2) : '0.00'} />
                        <PayloadTag label="IVA línea" value={preview ? Number(preview.ivaItem || 0).toFixed(2) : '0.00'} />
                        <PayloadTag label="Tributo" value={item.esExento ? 'Ninguno' : '20 / IVA 13%' } />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard
              title="Observaciones y totales"
              subtitle="Observaciones se envían dentro de `extension.observaciones`; el resumen se calcula automáticamente."
              icon={<Sparkles className="w-4 h-4" />}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Observaciones</label>
                  <textarea className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm min-h-[132px]" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Comentarios opcionales para el DTE..." />
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <PayloadTag label="Total gravada" value={totales.totalGravada.toFixed(2)} />
                    <PayloadTag label="IVA 13%" value={totales.iva.toFixed(2)} />
                    <PayloadTag label="Subtotal ventas" value={totales.subTotalVentas.toFixed(2)} />
                    <PayloadTag label="Total a pagar" value={totales.totalPagar.toFixed(2)} />
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Total en letras</p>
                    <p className="mt-1 text-sm font-medium text-emerald-900">{payableLabel}</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            {validationErrors.length > 0 && (
              <SectionCard title="Validaciones pendientes" subtitle="Corrige estos puntos antes de transmitir." icon={<Trash2 className="w-4 h-4" />}>
                <ul className="space-y-2 text-sm text-rose-700">
                  {validationErrors.map((error) => (
                    <li key={error} className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2">{error}</li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>

          <aside className="xl:col-span-4 space-y-5 xl:sticky xl:top-24">
            <SectionCard
              title="Payload final"
              subtitle="Este es el cuerpo de transmisión que viajará al backend."
              icon={<FileJson className="w-4 h-4" />}
            >
              <div className="grid grid-cols-2 gap-3 mb-4">
                <PayloadTag label="Business ID" value={resolvedBusinessId} />
                <PayloadTag label="Receptor email" value={normalizeEmail(receptorEmail)} />
                <PayloadTag label="tipoDte" value="03" />
                <PayloadTag label="version" value={3} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-950 text-slate-100 p-4 max-h-[340px] overflow-auto">
                <pre className="text-[11px] leading-5 font-mono whitespace-pre-wrap break-words">{payloadText}</pre>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={handleGeneratePayload} disabled={isGenerating} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  <ReceiptText className="w-4 h-4" /> {isGenerating ? 'Generando...' : 'Generar payload'}
                </button>
                <button onClick={handleTransmit} disabled={isTransmitting} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  <Send className="w-4 h-4" /> {isTransmitting ? 'Transmitiendo...' : 'Transmitir'}
                </button>
              </div>
            </SectionCard>

            <SectionCard
              title="Resumen MH"
              subtitle="Estado recibido del backend al transmitir."
              icon={<ShieldCheck className="w-4 h-4" />}
            >
              {mhResult ? (
                <div className="space-y-3 text-sm">
                  <PayloadTag label="Estado" value={mhResult?.mhResponse?.estado || mhResult?.estado || '—'} />
                  <PayloadTag label="Mensaje" value={mhResult?.mhResponse?.mensaje || mhResult?.message || mhResult?.error || '—'} />
                  <PayloadTag label="Sello recepción" value={mhResult?.mhResponse?.selloRecepcion || '—'} />
                  <PayloadTag label="Código generación" value={mhResult?.mhResponse?.codigoGeneracion || generatedDTE?.identificacion.codigoGeneracion || '—'} />
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aún no hay respuesta MH. Genera y transmite el payload para ver el resultado aquí.</p>
              )}
            </SectionCard>

            <SectionCard
              title="Reglas clave"
              subtitle="Lo que el formulario ya fuerza para evitar errores comunes."
              icon={<Sparkles className="w-4 h-4" />}
            >
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">Versión fija <span className="font-semibold">3</span> para tipo DTE <span className="font-semibold">03</span>.</li>
                <li className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">Precio unitario capturado <span className="font-semibold">sin IVA</span>.</li>
                <li className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">Tributo <span className="font-semibold">20</span> aplicado por defecto en líneas gravadas.</li>
                <li className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">Wrapper de transmisión incluye <span className="font-semibold">flowType</span>, <span className="font-semibold">businessId</span> y <span className="font-semibold">receptorEmail</span>.</li>
              </ul>
            </SectionCard>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CCF03Generator;
