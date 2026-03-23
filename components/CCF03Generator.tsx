import React, { useEffect, useMemo, useState } from 'react';
import { FileJson, Plus, Search, Sparkles, Trash2, Send, FilePlus2 } from 'lucide-react';
import { useEmisor } from '../contexts/EmisorContext';
import { useToast, ToastContainer } from './Toast';
import { getClients, type ClientData } from '../utils/clientDb';
import { getEmisor, type EmisorData } from '../utils/emisorDb';
import { checkLicense } from '../utils/licenseValidator';
import { getCertificate } from '../utils/secureStorage';
import { limpiarDteParaFirma, transmitirDocumento } from '../utils/firmaApiClient';
import CCF03DebugModal from './CCF03DebugModal';
import {
  calcularTotales,
  generarCorrelativoControlado,
  generarDTE,
  redondear,
  type DTEJSON,
  type ItemFactura,
} from '../utils/dteGenerator';
import SelectCatalogo from './formularios/SelectCatalogo';
import { condicionesOperacion, formasPago } from '../catalogos';

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

// Unidades de medida según catálogo MH
const UNIDADES_MEDIDA = [
  { codigo: 1, descripcion: 'Cajas' },
  { codigo: 2, descripcion: 'Docenas' },
  { codigo: 3, descripcion: 'Litros' },
  { codigo: 7, descripcion: 'Kilogramos' },
  { codigo: 10, descripcion: 'Metros' },
  { codigo: 17, descripcion: 'Gramos' },
  { codigo: 23, descripcion: 'Centímetros' },
  { codigo: 25, descripcion: 'Milímetros' },
  { codigo: 29, descripcion: 'Mililitros' },
  { codigo: 41, descripcion: 'Juegos' },
  { codigo: 47, descripcion: 'Pares' },
  { codigo: 48, descripcion: 'Paquetes' },
  { codigo: 59, descripcion: 'Unidades' }, // Valor por defecto
  { codigo: 71, descripcion: 'Toneladas' },
  { codigo: 86, descripcion: 'Barriles' },
  { codigo: 96, descripcion: 'Servicios' },
  { codigo: 99, descripcion: 'Otra' },
];

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
const makeEmptyErrors = () => [] as string[];

const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, icon, children, actions }) => (
  <section className="bg-gray-100 rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
    {(title || subtitle || icon || actions) && (
      <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4 bg-white/50">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            {icon}
            {title}
          </h2>
          {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
        </div>
        {actions}
      </div>
    )}
    <div className="p-4 md:p-6">{children}</div>
  </section>
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
  const [ambiente] = useState<'00' | '01'>(() => (localStorage.getItem('dte_ambiente') as '00' | '01') || '00');
  const [observaciones, setObservaciones] = useState('');
  const [generatedDTE, setGeneratedDTE] = useState<DTEJSON | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [mhResult, setMhResult] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showDebugModal, setShowDebugModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [storedEmisor, loadedClients] = await Promise.all([getEmisor(), getClients()]);
        if (!mounted) return;
        if (storedEmisor) {
          setEmisorForm(emptyEmisorForm(storedEmisor));
        }
        setClients(loadedClients);
        
        // Verificar si hay items convertidos desde Factura
        const itemsTemp = localStorage.getItem('ccf_items_temp');
        if (itemsTemp) {
          try {
            const itemsConvertidos = JSON.parse(itemsTemp);
            setItems(itemsConvertidos);
            
            // Cargar otros datos temporales
            const obsTemp = localStorage.getItem('ccf_observaciones_temp');
            if (obsTemp) setObservaciones(obsTemp);
            
            const pagoTemp = localStorage.getItem('ccf_forma_pago_temp');
            if (pagoTemp) setFormaPago(pagoTemp);
            
            const condTemp = localStorage.getItem('ccf_condicion_temp');
            if (condTemp) setCondicionOperacion(Number(condTemp));
            
            // Limpiar datos temporales
            localStorage.removeItem('ccf_items_temp');
            localStorage.removeItem('ccf_observaciones_temp');
            localStorage.removeItem('ccf_forma_pago_temp');
            localStorage.removeItem('ccf_condicion_temp');
            
            addToast('Items convertidos desde Factura. Precios ajustados sin IVA.', 'info');
          } catch (error) {
            console.error('Error al cargar items convertidos:', error);
          }
        }
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-8">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-slate-900">Comprobante de Crédito Fiscal Electrónico 03</h1>
                          </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowDebugModal(true)}
                title="Detalle técnico"
                aria-label="Abrir detalle técnico"
                className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-2 text-sm font-medium hover:bg-indigo-100 transition border border-indigo-200"
              >
                <FileJson className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-9 space-y-8">
            <SectionCard title="">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={selectedClient ? `${selectedClient.name} · NIT: ${selectedClient.nit}` : clientSearch}
                  onChange={(e) => {
                    if (!selectedClient) {
                      setClientSearch(e.target.value);
                    }
                  }}
                  onFocus={() => {
                    if (selectedClient) {
                      setShowClientSearch(true);
                    }
                  }}
                  placeholder={selectedClient ? "" : "Buscar cliente por nombre, NIT o NRC..."}
                  className="w-full rounded-xl border border-slate-300 pl-10 pr-24 py-3 text-sm bg-white"
                  readOnly={!!selectedClient}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  {selectedClient ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowClientSearch(true)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        <Search className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedClient(null); setReceptorForm(emptyReceptorForm); setReceptorEmail(''); }}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowClientSearch(true)}
                      className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                    >
                      Buscar
                    </button>
                  )}
                </div>
              </div>
              
              {selectedClient && (
                <div className="mt-2 text-sm text-slate-600">
                  <p>{selectedClient.email || 'correo@ejemplo.com'} · {selectedClient.telefono || 'Sin teléfono'}</p>
                </div>
              )}
              
              {showClientSearch && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-lg">
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {filteredClients.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-3">Sin resultados. Ve al tab "Clientes" para crear nuevos.</p>
                    ) : (
                      filteredClients.map((client) => (
                        <button
                          type="button"
                          key={client.id}
                          onClick={() => handleSelectClient(client)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-indigo-300 hover:bg-indigo-50 transition"
                        >
                          <p className="text-sm font-medium text-slate-900 truncate">{client.name}</p>
                          <p className="text-xs text-slate-500">NIT: {client.nit} · NRC: {client.nrc || '—'}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              
              {selectedClient && (
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Correo para notificación (opcional)</label>
                  <input 
                    type="email" 
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" 
                    value={receptorEmail} 
                    onChange={(e) => setReceptorEmail(e.target.value)} 
                    placeholder={selectedClient.email || "correo@ejemplo.com"}
                  />
                  <p className="text-xs text-slate-500 mt-1">Se usará este correo para enviar el CCF. Si se deja vacío, se usará el del cliente.</p>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Cuerpo del documento"
              subtitle="Precio unitario sin IVA, tributo código 20 aplicado por defecto y descuentos por ítem ."
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
                        </div>
                        <button type="button" onClick={() => removeItem(index)} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-rose-700 border border-rose-200 hover:bg-rose-50">
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-3">
                          <label className="block text-sm font-semibold text-black uppercase mb-2">Tipo ítem</label>
                          <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" value={item.tipoItem} onChange={(e) => updateItem(index, 'tipoItem', Number(e.target.value) as 1 | 2)}>
                            <option value={1}>Bien</option>
                            <option value={2}>Servicio</option>
                          </select>
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-sm font-semibold text-black uppercase mb-2">Cantidad</label>
                          <input 
                            type="number" 
                            min="1" 
                            step="1" 
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" 
                            value={item.cantidad} 
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              updateItem(index, 'cantidad', Math.max(1, val));
                            }} 
                          />
                        </div>
                        <div className={`${item.tipoItem === 1 ? 'md:col-span-3' : 'hidden'}`}>
                          <label className="block text-sm font-semibold text-black uppercase mb-2">Uni. medida</label>
                          <select 
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            value={item.uniMedida}
                            onChange={(e) => updateItem(index, 'uniMedida', Number(e.target.value))}
                          >
                            {UNIDADES_MEDIDA.map(u => (
                              <option key={u.codigo} value={u.codigo}>
                                {u.descripcion}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <label className="block text-sm font-semibold text-black uppercase mb-2">Descripción</label>
                        <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={item.descripcion} onChange={(e) => updateItem(index, 'descripcion', e.target.value)} />
                      </div>
                      
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-black uppercase mb-2">Código</label>
                          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={item.codigo} onChange={(e) => updateItem(index, 'codigo', e.target.value)} placeholder="Opcional" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-black uppercase mb-2">Precio unitario sin IVA</label>
                          <input type="number" min="0" step="0.01" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={item.precioUni.toFixed(2)} onChange={(e) => updateItem(index, 'precioUni', Number(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-black uppercase mb-2">Descuento</label>
                          <input 
                            type="number" 
                            min="0" 
                            step="1" 
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" 
                            value={item.montoDescu.toFixed(2)} 
                            onChange={(e) => updateItem(index, 'montoDescu', Number(e.target.value) || 0)} 
                          />
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" className="rounded border-gray-300" checked={item.esExento} onChange={(e) => updateItem(index, 'esExento', e.target.checked)} />
                          Exento de Impuestos
                        </label>
                      </div>
                      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
                          <p className="text-xs text-gray-500 uppercase">Base línea</p>
                          <p className="text-sm font-semibold text-gray-900">{redondear((item.cantidad || 0) * (item.precioUni || 0) - (item.montoDescu || 0), 2).toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
                          <p className="text-xs text-gray-500 uppercase">Venta gravada</p>
                          <p className="text-sm font-semibold text-gray-900">{preview ? preview.ventaGravada.toFixed(2) : '0.00'}</p>
                        </div>
                        <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
                          <p className="text-xs text-gray-500 uppercase">IVA línea</p>
                          <p className="text-sm font-semibold text-gray-900">{preview ? Number(preview.ivaItem || 0).toFixed(2) : '0.00'}</p>
                        </div>
                        <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
                          <p className="text-xs text-gray-500 uppercase">Tributo</p>
                          <p className="text-sm font-semibold text-gray-900">{item.esExento ? 'Ninguno' : '20 / IVA 13%' }</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard
              title="Observaciones"
              subtitle="Observaciones se envían dentro de `extension.observaciones`."
              icon={<Sparkles className="w-4 h-4" />}
            >
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Observaciones</label>
                <textarea 
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm" 
                  style={{ minHeight: '3.5rem', maxHeight: '3.5rem', resize: 'none' }}
                  value={observaciones} 
                  onChange={(e) => setObservaciones(e.target.value)} 
                  placeholder="Comentarios opcionales para el DTE..." 
                />
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

          <aside className="xl:col-span-3 space-y-8 xl:sticky xl:top-24">
            <SectionCard title="">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectCatalogo
                    label="CONDICIÓN DE OPERACIÓN"
                    catalogo={condicionesOperacion}
                    value={condicionOperacion}
                    onChange={(value) => setCondicionOperacion(Number(value) as number)}
                    showCode
                  />
                  <SelectCatalogo
                    label="FORMA DE PAGO"
                    catalogo={formasPago}
                    value={formaPago}
                    onChange={setFormaPago}
                    showCode
                  />
                </div>
                
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Resumen del Documento</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Subtotal (Gravada):</span>
                      <span className="text-sm font-medium text-gray-900">${totales.totalGravada.toFixed(2)}</span>
                    </div>
                    
                    {totales.totalDescu > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">(-) Total Descuento:</span>
                        <span className="text-sm font-medium text-red-600">-${totales.totalDescu.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">(+) IVA (13%):</span>
                      <span className="text-sm font-medium text-gray-900">${totales.iva.toFixed(2)}</span>
                    </div>
                    
                    <div className="border-t border-gray-300 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-gray-800">TOTAL A PAGAR:</span>
                        <span className="text-lg font-bold text-gray-900">${totales.totalPagar.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={handleTransmit}
                    disabled={isTransmitting}
                    title={isTransmitting ? 'Transmitiendo...' : 'Firmar y Emitir Documento'}
                    aria-label={isTransmitting ? 'Transmitiendo' : 'Firmar y Emitir Documento'}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 text-slate-800 px-4 py-3 text-sm font-medium hover:bg-slate-200 transition disabled:opacity-50 w-full border border-slate-200"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isTransmitting ? 'Transmitiendo...' : 'Firmar y Emitir Documento'}</span>
                  </button>
                  <button
                    onClick={handleReset}
                    title="Nuevo CCF"
                    aria-label="Nuevo CCF"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 text-slate-700 px-4 py-3 text-sm font-medium hover:bg-slate-200 transition w-full"
                  >
                    <FilePlus2 className="w-4 h-4" />
                    <span>Nuevo CCF</span>
                  </button>
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>
      <CCF03DebugModal
        open={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        payloadText={payloadText}
        currentPayload={currentPayload}
        generatedDTE={generatedDTE}
        mhResult={mhResult}
        totalGravada={totales.totalGravada}
        totalPagar={totales.totalPagar}
        businessId={resolvedBusinessId}
        receptorEmail={normalizeEmail(receptorEmail)}
      />
    </div>
  );
};

export default CCF03Generator;
