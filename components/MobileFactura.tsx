import { useMemo, useState, useEffect } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  User,
  ChevronRight,
  X,
  Search,
  Settings,
  ShoppingCart,
  Receipt,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Download,
} from 'lucide-react';
import { getClients, ClientData, saveClient } from '../utils/clientDb';
import { EmisorData } from '../utils/emisorDb';
import {
  generarDTE,
  ItemFactura,
  tiposDocumento,
  calcularTotales,
  redondear,
  DTEJSON,
} from '../utils/dteGenerator';
import { ToastContainer, useToast } from './Toast';
import { applySalesFromDTE, validateStockForSale } from '../utils/inventoryDb';
import {
  EmailField,
  NitOrDuiField,
  NrcField,
  PhoneField,
  SelectActividad,
  SelectUbicacion,
} from './formularios';
import { validateNIT, validateNRC, validatePhone, validateEmail } from '../utils/validators';
import {
  getNitOrDuiDigitsRemaining,
  formatTextInput,
  formatMultilineTextInput,
} from '../utils/validators';
import { getProducts, ProductData } from '../utils/productDb';
import { inventarioService } from '../utils/inventario/inventarioService';
import { mergeProducts } from '../utils/inventoryAdapter';

interface MobileFacturaProps {
  onShowEmisorConfig: () => void;
  onShowTransmision: (dte: DTEJSON) => void;
  emisor: EmisorData | null;
}

interface ItemForm {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUni: number;
  tipoItem: number;
  esExento: boolean;
  cargosNoBase?: number;
  tributoCodigo?: string | null;
  uniMedida: number // Default to 'UNIDAD' or standard measure
}

interface NewClientForm {
  nit: string;
  name: string;
  nrc: string;
  nombreComercial: string;
  actividadEconomica: string;
  descActividad: string;
  departamento: string;
  municipio: string;
  direccion: string;
  telefono: string;
  email: string;
  esConsumidorFinal: boolean;
}

const emptyNewClientForm: NewClientForm = {
  nit: '',
  name: '',
  nrc: '',
  nombreComercial: '',
  actividadEconomica: '',
  descActividad: '',
  departamento: '',
  municipio: '',
  direccion: '',
  telefono: '',
  email: '',
  esConsumidorFinal: false,
};

const MobileFactura: React.FC<MobileFacturaProps> = ({
  onShowEmisorConfig,
  onShowTransmision,
  emisor,
}) => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [showClientDrawer, setShowClientDrawer] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [items, setItems] = useState<ItemForm[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ 
    codigo: '', 
    descripcion: '', 
    precioUni: 0, 
    cantidad: 1, 
    tipoItem: 1, 
    cargosNoBase: 0, 
    tributoCodigo: null as string | null,
    uniMedida: 59 // Default to 'UNIDAD' or standard measure
  });
  const [tipoDoc, setTipoDoc] = useState('01');
  const [formaPago, setFormaPago] = useState('01');

  const productSuggestions = useMemo<ProductData[]>(() => {
    const term = (newItem.descripcion || '').trim().toLowerCase();
    if (term.length < 2) return [];

    const matches = products.filter((p) => {
      const cod = (p.codigo || '').toLowerCase();
      const desc = (p.descripcion || '').toLowerCase();
      return cod.includes(term) || desc.includes(term);
    });

    return matches.slice(0, 6);
  }, [newItem.descripcion, products]);

  // Recalcular precios al cambiar tipo de documento (Móvil)
  const handleSetTipoDoc = (nuevoTipo: string) => {
    const tipoAnterior = tipoDoc;
    setTipoDoc(nuevoTipo);

    if (tipoAnterior === nuevoTipo) return;
    if (items.length === 0) return;

    const newItems = items.map(item => {
      // Si es exento, no se toca
      if (item.esExento) return item;

      let nuevoPrecio = item.precioUni;

      // De Sin IVA (03) a Con IVA (01) -> Sumar IVA
      if (tipoAnterior !== '01' && nuevoTipo === '01') {
        nuevoPrecio = redondear(item.precioUni * 1.13, 8);
      }
      // De Con IVA (01) a Sin IVA (03) -> Restar IVA
      else if (tipoAnterior === '01' && nuevoTipo !== '01') {
        nuevoPrecio = redondear(item.precioUni / 1.13, 8);
      }

      return {
        ...item,
        precioUni: nuevoPrecio
      };
    });

    setItems(newItems);
    addToast(
      nuevoTipo === '01' 
        ? 'Precios actualizados a IVA incluido' 
        : 'Precios actualizados a Sin IVA',
      'info'
    );
  };

  const [condicionOperacion, setCondicionOperacion] = useState(1);
  const [observaciones, setObservaciones] = useState('');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDTE, setGeneratedDTE] = useState<DTEJSON | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientForm, setNewClientForm] = useState<NewClientForm>(emptyNewClientForm);
  const [newClientErrors, setNewClientErrors] = useState<Record<string, string>>({});

  const { toasts, addToast, removeToast } = useToast();

  // Determinar si el cliente seleccionado es consumidor final
  const clienteEsConsumidorFinal = selectedClient ? !selectedClient.nit.trim() : false;

  // Filtrar tipos de documento según el tipo de cliente
  const tiposDocumentoFiltrados = tiposDocumento.filter(t => {
    if (clienteEsConsumidorFinal) {
      // Para consumidor final solo permitir: 01, 02, 10, 11
      return ['01', '02', '10', '11'].includes(t.codigo);
    } else {
      // Para clientes con NIT/NRC permitir todos excepto los de consumidor final
      return !['02', '10'].includes(t.codigo);
    }
  });

  useEffect(() => {
    loadClients();
  }, []);

  // Resetear tipo de documento cuando cambia el cliente
  useEffect(() => {
    if (selectedClient) {
      // Si es consumidor final y el tipo actual no es permitido, cambiar a 01
      if (clienteEsConsumidorFinal && !['01', '02', '10', '11'].includes(tipoDoc)) {
        handleSetTipoDoc('01');
      }
      // Si es cliente con NIT y el tipo actual es 02 o 10, cambiar a 01
      else if (!clienteEsConsumidorFinal && ['02', '10'].includes(tipoDoc)) {
        handleSetTipoDoc('01');
      }
    }
  }, [selectedClient, clienteEsConsumidorFinal]);

  useEffect(() => {
    const load = async () => {
      const dbProducts = await getProducts();
      const inventoryProducts = inventarioService.getProductos();
      const finalProducts = mergeProducts(dbProducts, inventoryProducts);
      setProducts(finalProducts);
    };
    load();
  }, []);

  const loadClients = async () => {
    const data = await getClients();
    setClients(data);
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.nit.includes(clientSearch)
  );

  const normalizeProductText = (value: string): string => {
    return (value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  };

  const resolveProductForDescription = (raw: string): ProductData | undefined => {
    const value = (raw || '').trim();
    if (!value) return undefined;

    const byCode = products.find((p) => p.codigo && p.codigo.trim() === value);
    if (byCode) return byCode;

    const needle = normalizeProductText(value);
    return products.find((p) => normalizeProductText(p.descripcion) === needle);
  };

  const handleNewItemDescriptionBlur = () => {
    const found = resolveProductForDescription(newItem.descripcion);
    if (!found) return;

    // Al seleccionar del catálogo, si es Tipo 01 (Factura), sumamos IVA al precio sugerido (que es neto)
    let precioSugerido = found.precioUni;
    if (tipoDoc === '01') {
      precioSugerido = redondear(found.precioUni * 1.13, 8);
    }

    setNewItem({
      ...newItem,
      codigo: found.codigo,
      descripcion: found.descripcion,
      precioUni: precioSugerido,
      tipoItem: typeof found.tipoItem === 'number' ? found.tipoItem : 1,
    });
  };

  const addItem = async () => {
    if (!newItem.descripcion || newItem.precioUni <= 0) return;

    const found = resolveProductForDescription(newItem.descripcion);
    const resolvedTipoItem = typeof newItem.tipoItem === 'number' ? newItem.tipoItem : (typeof found?.tipoItem === 'number' ? found!.tipoItem : 1);
    const codigo = (newItem.codigo || found?.codigo || '').trim();
    
    // Ajustar precio según tipo de documento (Catálogo es neto)
    let precioFinal = newItem.precioUni;
    if (found && Math.abs(found.precioUni - newItem.precioUni) < 0.01) {
      // Si el precio coincide con el catálogo, aplicamos la lógica de IVA
      if (tipoDoc === '01') {
        precioFinal = redondear(found.precioUni * 1.13, 8);
      } else {
        precioFinal = found.precioUni;
      }
    }

    if (resolvedTipoItem === 1) {
      if (!codigo) {
        addToast('Hay items sin código. Asigna un código en el catálogo.', 'error');
        return;
      }

      const stockCheck = await validateStockForSale([
        { codigo, cantidad: newItem.cantidad, descripcion: newItem.descripcion },
      ]);
      if (!stockCheck.ok) {
        addToast(stockCheck.message, 'error');
        return;
      }
    }

    const item: ItemForm = {
      id: `item_${Date.now()}`,
      codigo,
      descripcion: newItem.descripcion,
      cantidad: newItem.cantidad,
      precioUni: precioFinal,
      tipoItem: resolvedTipoItem,
      esExento: false,
      cargosNoBase: newItem.cargosNoBase || 0,
      tributoCodigo: newItem.tributoCodigo,
      uniMedida: newItem.uniMedida || 59,
    };
    setItems([...items, item]);
    setNewItem({ codigo: '', descripcion: '', precioUni: 0, cantidad: 1, tipoItem: 1, cargosNoBase: 0, tributoCodigo: null, uniMedida: 59 });
    setShowAddItem(false);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const updateItemQty = (id: string, delta: number) => {
    setItems(
      items.map((i) =>
        i.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i
      )
    );
  };

  const itemsParaCalculo: ItemFactura[] = items.map((item, idx) => {
    const cantidad = Number(item.cantidad) || 0;
    const precio = Number(item.precioUni) || 0;
    const totalLinea = redondear(cantidad * precio, 8);
    
    let ventaGravada = 0;
    let ventaExenta = 0;
    let ventaNoSuj = 0;
    let ivaItem = 0;

    const isNinguno = item.tributoCodigo === '';
    const isIVA = item.tributoCodigo === '20';
    const aplicaIVA = isIVA || (!isNinguno && item.tributoCodigo == null && (tipoDoc === '01' || tipoDoc === '03') && !item.esExento);

    if (item.esExento) {
      ventaExenta = totalLinea;
    } else if (!aplicaIVA) {
      ventaNoSuj = totalLinea;
    } else if (tipoDoc === '01') {
      const base = redondear(totalLinea / 1.13, 8);
      ventaGravada = base;
      ivaItem = redondear(totalLinea - base, 2);
    } else if (tipoDoc === '03') {
      ventaGravada = totalLinea;
      ivaItem = redondear(totalLinea * 0.13, 2);
    } else {
      ventaGravada = totalLinea;
    }

    const finalTributoCodigo = aplicaIVA ? '20' : null;

    return {
      ...item,
      numItem: idx + 1,
      cantidad,
      precioUni: precio,
      montoDescu: 0,
      ventaNoSuj,
      ventaExenta,
      ventaGravada,
      tributos: finalTributoCodigo ? [finalTributoCodigo] : null,
      numeroDocumento: null,
      codTributo: null,
      psv: 0,
      noGravado: 0,
      ivaItem,
      tributoCodigo: finalTributoCodigo,
      cargosNoBase: item.cargosNoBase || 0,
      uniMedida: 59, // default
    };
  });

  const totales = calcularTotales(itemsParaCalculo, tipoDoc);

  const handleNewClientChange = (field: keyof NewClientForm, value: string) => {
    let processedValue = value;
    if (field === 'name') {
      processedValue = formatTextInput(value);
    }
    if (field === 'nombreComercial') {
      processedValue = formatTextInput(value);
    }
    if (field === 'direccion') {
      processedValue = formatMultilineTextInput(value);
    }
    setNewClientForm(prev => ({ ...prev, [field]: processedValue }));
    if (newClientErrors[field]) {
      setNewClientErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSaveNewClient = async () => {
    const errors: Record<string, string> = {};

    if (!newClientForm.esConsumidorFinal) {
      const nitResult = validateNIT(newClientForm.nit);
      if (!nitResult.valid) errors.nit = nitResult.message;
    }

    if (!newClientForm.name.trim()) {
      errors.name = 'Requerido';
    }

    if (!newClientForm.esConsumidorFinal) {
      const phoneResult = validatePhone(newClientForm.telefono);
      if (!phoneResult.valid) errors.telefono = phoneResult.message;
    }

    if (!newClientForm.esConsumidorFinal) {
      const emailResult = validateEmail(newClientForm.email);
      if (!emailResult.valid) errors.email = emailResult.message;
    }

    if (newClientForm.nrc) {
      const nrcResult = validateNRC(newClientForm.nrc);
      if (!nrcResult.valid) errors.nrc = nrcResult.message;
    }

    setNewClientErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const saved = await saveClient({
        nit: newClientForm.esConsumidorFinal ? '' : newClientForm.nit,
        name: newClientForm.esConsumidorFinal ? 'Consumidor Final' : newClientForm.name,
        nrc: newClientForm.esConsumidorFinal ? '' : newClientForm.nrc,
        nombreComercial: newClientForm.nombreComercial,
        actividadEconomica: newClientForm.actividadEconomica,
        descActividad: newClientForm.descActividad,
        departamento: newClientForm.departamento,
        municipio: newClientForm.municipio,
        direccion: newClientForm.direccion,
        email: newClientForm.esConsumidorFinal ? '' : newClientForm.email,
        telefono: newClientForm.esConsumidorFinal ? '' : newClientForm.telefono,
      });
      setClients(prev => [saved, ...prev]);
      setSelectedClient(saved);
      setShowNewClientForm(false);
    } catch (err) {
      console.error('Error guardando cliente:', err);
    }
  };

  const handleGenerate = async () => {
    if (!emisor || !selectedClient || items.length === 0) return;

    const goodsOnly = items
      .filter((i) => i.tipoItem === 1)
      .map((i) => ({ codigo: i.codigo, cantidad: i.cantidad, descripcion: i.descripcion }));

    const stockCheck = goodsOnly.length
      ? await validateStockForSale(goodsOnly)
      : ({ ok: true } as const);
    if (!stockCheck.ok) {
      addToast(stockCheck.message, 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const correlativo = Date.now() % 100000;

      if (totales.montoTotalOperacion >= 25000) {
        const receptorId = (selectedClient.nit || '').replace(/[-\s]/g, '').trim();
        if (!receptorId) {
          addToast('Monto >= $25,000: debes completar los datos del receptor (documento de identificación).', 'error');
          return;
        }
      }

      const dte = generarDTE({
        tipoDocumento: tipoDoc,
        tipoTransmision: 1,
        emisor: {
          ...emisor,
          tipoEstablecimiento: emisor.tipoEstablecimiento || '01',
        },
        receptor: {
          id: selectedClient.id,
          nit: selectedClient.nit || '',
          name: selectedClient.name || '',
          nrc: selectedClient.nrc || '',
          nombreComercial: selectedClient.nombreComercial || '',
          actividadEconomica: selectedClient.actividadEconomica || '',
          descActividad: selectedClient.descActividad || '',
          departamento: selectedClient.departamento || '',
          municipio: selectedClient.municipio || '',
          direccion: selectedClient.direccion || '',
          telefono: selectedClient.telefono || '',
          email: selectedClient.email || '',
          timestamp: selectedClient.timestamp || Date.now(),
        },
        items: itemsParaCalculo,
        condicionOperacion,
        formaPago,
        observaciones,
      }, correlativo, '00');
      setGeneratedDTE(dte);
      await applySalesFromDTE(dte);
      
      setShowPreview(true);
    } catch (err) {
      console.error('Error generando DTE:', err);

      addToast('Error al generar DTE', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = emisor && selectedClient && items.length > 0;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <ToastContainer
        toasts={toasts}
        removeToast={removeToast}
        className="fixed bottom-24 right-4 z-50 flex flex-col gap-2"
      />
      {/* Header compacto */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <Receipt className="w-4 h-4 text-green-600" />
          </div>
          <span className="font-semibold text-gray-900">Nueva Factura</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onShowEmisorConfig}
            className={`p-2 rounded-lg ${emisor ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Contenido scrolleable - padding extra para barra de totales + nav */}
      <div className="flex-1 overflow-y-auto pb-48">
        {/* Tipo de documento */}
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <label className="text-xs text-gray-500 uppercase font-medium">Tipo</label>
          <select
            value={tipoDoc}
            onChange={(e) => handleSetTipoDoc(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          >
            {tiposDocumentoFiltrados.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.codigo} - {t.descripcion}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {tipoDoc === '01'
              ? '01: Ingresa precio con IVA incluido (13%).'
              : tipoDoc === '03'
                ? '03: Ingresa precio sin IVA; se calculará 13%.'
                : 'Ajusta precios según el tipo de documento.'}
          </p>
        </div>

        {/* Selector de cliente */}
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <label className="text-xs text-gray-500 uppercase font-medium">Cliente</label>
          <button
            onClick={() => setShowClientDrawer(true)}
            className={`w-full mt-1 px-4 py-3 rounded-xl flex items-center justify-between transition-all ${
              selectedClient
                ? 'bg-green-50 border-2 border-green-200'
                : 'bg-gray-50 border-2 border-dashed border-gray-300'
            }`}
          >
            {selectedClient ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{selectedClient.name}</p>
                  <p className="text-xs text-gray-500">NIT: {selectedClient.nit || 'N/A'}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-gray-400">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <span>Seleccionar cliente</span>
              </div>
            )}
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Items */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-gray-500 uppercase font-medium">
              Productos ({items.length})
            </label>
            <button
              onClick={() => setShowAddItem(true)}
              className="flex items-center gap-1 text-sm text-blue-600 font-medium"
            >
              <Plus className="w-4 h-4" />
              Agregar
            </button>
          </div>

          {items.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
              <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Sin productos</p>
              <button
                onClick={() => setShowAddItem(true)}
                className="mt-3 text-blue-600 text-sm font-medium"
              >
                + Agregar producto
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.descripcion}</p>
                      <p className="text-sm text-gray-500">
                        ${Number.isInteger(item.precioUni * 100) ? item.precioUni.toFixed(2) : parseFloat(item.precioUni.toFixed(6)).toString()} c/u
                      </p>
                      {item.cargosNoBase !== undefined && item.cargosNoBase !== 0 && (
                        <p className="text-xs text-blue-600 mt-1">Cargo/Abono (no base): ${item.cargosNoBase.toFixed(2)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2 bg-gray-100 rounded-lg">
                      <button
                        onClick={() => updateItemQty(item.id, -1)}
                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-l-lg"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{item.cantidad}</span>
                      <button
                        onClick={() => updateItemQty(item.id, 1)}
                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-r-lg"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="font-semibold text-gray-900">
                      ${(item.cantidad * item.precioUni).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Opciones de pago colapsables */}
      {showPaymentOptions && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowPaymentOptions(false)}>
          <div 
            className="absolute bottom-[4.5rem] left-0 right-0 bg-white rounded-t-2xl p-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Opciones de Pago</h3>
              <button onClick={() => setShowPaymentOptions(false)} className="p-1">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            {/* Condición */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Condición</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCondicionOperacion(1)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    condicionOperacion === 1 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Contado
                </button>
                <button
                  onClick={() => setCondicionOperacion(2)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    condicionOperacion === 2 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Crédito
                </button>
              </div>
            </div>

            {/* Forma de pago */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Forma de Pago</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { codigo: '01', nombre: 'Efectivo' },
                  { codigo: '02', nombre: 'Cheque' },
                  { codigo: '03', nombre: 'Transferencia' },
                  { codigo: '14', nombre: 'Tarjeta' },
                ].map((fp) => (
                  <button
                    key={fp.codigo}
                    onClick={() => setFormaPago(fp.codigo)}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      formaPago === fp.codigo ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {fp.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Observaciones (opcional)</p>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales..."
                rows={2}
                className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              onClick={() => setShowPaymentOptions(false)}
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {/* Barra inferior fija con totales - ajustada para no tapar nav */}
      <div className="fixed bottom-[4.5rem] left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg safe-area-pb md:bottom-0">
        {/* Botón para opciones de pago */}
        <button
          onClick={() => setShowPaymentOptions(true)}
          className="w-full mb-3 py-2 px-3 bg-gray-50 rounded-lg flex items-center justify-between text-sm"
        >
          <span className="text-gray-500">
            {condicionOperacion === 1 ? 'Contado' : 'Crédito'} • {formaPago === '01' ? 'Efectivo' : formaPago === '02' ? 'Cheque' : formaPago === '03' ? 'Transferencia' : 'Tarjeta'}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
        
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500">Subtotal</p>
            <p className="text-sm text-gray-600">${totales.subTotalVentas.toFixed(2)}</p>
          </div>
          
          {tipoDoc === '01' ? (
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase">IVA (Incluido)</p>
              <p className="text-xs text-gray-500 font-medium">${totales.iva.toFixed(2)}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500">IVA 13%</p>
              <p className="text-sm text-gray-600">${totales.iva.toFixed(2)}</p>
            </div>
          )}
          
          {typeof totales.totalCargosNoBase === 'number' && totales.totalCargosNoBase !== 0 && (
            <div className="text-right">
              <p className="text-[10px] text-blue-600 uppercase">Cargos/Abonos (no base)</p>
              <p className="text-xs text-blue-700 font-medium">${totales.totalCargosNoBase.toFixed(2)}</p>
            </div>
          )}

          <div className="text-right">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-xl font-bold text-green-600">${totales.totalPagar.toFixed(2)}</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
            canGenerate && !isGenerating
              ? 'bg-green-600 text-white shadow-lg shadow-green-200 active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Receipt className="w-5 h-5" />
              Generar Factura
            </>
          )}
        </button>
      </div>

      {/* Drawer de clientes */}
      {showClientDrawer && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Seleccionar Cliente</h2>
            <button onClick={() => setShowClientDrawer(false)} className="p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Buscar por nombre o NIT..."
                className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl border-0 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <button
              onClick={() => {
                setSelectedClient({
                  nit: '',
                  name: 'Consumidor Final',
                  nrc: '',
                  nombreComercial: '',
                  actividadEconomica: '',
                  descActividad: '',
                  departamento: '',
                  municipio: '',
                  direccion: '',
                  email: '',
                  telefono: '',
                  timestamp: Date.now(),
                });
                setShowClientDrawer(false);
              }}
              className="w-full mb-3 py-3 rounded-xl border border-blue-200 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100"
            >
              Consumidor Final
            </button>
            {filteredClients.length === 0 ? (
              <div className="text-center py-12 text-gray-400 flex flex-col items-center gap-3">
                <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay clientes</p>
                <button
                  onClick={() => {
                    setShowClientDrawer(false);
                    setNewClientForm(emptyNewClientForm);
                    setNewClientErrors({});
                    setShowNewClientForm(true);
                  }}
                  className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-medium border border-blue-200"
                >
                  + Crear nuevo cliente
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => {
                      setSelectedClient(client);
                      setShowClientDrawer(false);
                    }}
                    className={`w-full p-4 rounded-xl text-left flex items-center gap-3 transition-all ${
                      selectedClient?.id === client.id
                        ? 'bg-green-50 border-2 border-green-300'
                        : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        selectedClient?.id === client.id ? 'bg-green-100' : 'bg-gray-200'
                      }`}
                    >
                      <User
                        className={`w-6 h-6 ${
                          selectedClient?.id === client.id ? 'text-green-600' : 'text-gray-500'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-sm text-gray-500">
                        {client.nit || 'Sin NIT'} {client.nrc && `| NRC: ${client.nrc}`}
                      </p>
                    </div>
                    {selectedClient?.id === client.id && (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="px-4 pb-4 border-t border-gray-100">
            <button
              onClick={() => {
                setShowClientDrawer(false);
                setNewClientForm(emptyNewClientForm);
                setNewClientErrors({});
                setShowNewClientForm(true);
              }}
              className="w-full py-3 rounded-xl border border-dashed border-blue-300 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100"
            >
              + Crear nuevo cliente
            </button>
          </div>
        </div>
      )}

      {/* Formulario nuevo cliente (móvil) */}
      {showNewClientForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 pb-8 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Nuevo Cliente</h3>
              <button
                onClick={() => setShowNewClientForm(false)}
                className="p-1 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newClientForm.esConsumidorFinal}
                    onChange={(e) => {
                      const esConsumidorFinal = e.target.checked;
                      setNewClientForm((prev) => ({
                        ...prev,
                        esConsumidorFinal,
                        nit: esConsumidorFinal ? '' : prev.nit,
                        name: esConsumidorFinal ? 'Consumidor Final' : prev.name,
                        nrc: esConsumidorFinal ? '' : prev.nrc,
                        telefono: esConsumidorFinal ? '' : prev.telefono,
                        email: esConsumidorFinal ? '' : prev.email,
                      }));
                      setNewClientErrors({});
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Consumidor Final</div>
                    <div className="text-xs text-gray-600">Permite omitir documento, teléfono y correo en FE &lt; $25,000</div>
                  </div>
                </label>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <NitOrDuiField
                    label={
                      <>
                        NIT / DUI {!newClientForm.esConsumidorFinal && <span className="text-red-500">*</span>}
                        {newClientForm.nit && getNitOrDuiDigitsRemaining(newClientForm.nit) > 0 && (
                          <span className="ml-2 text-blue-500 font-normal">
                            {getNitOrDuiDigitsRemaining(newClientForm.nit)}
                          </span>
                        )}
                        {newClientForm.nit && getNitOrDuiDigitsRemaining(newClientForm.nit) === 0 && (
                          <span className="ml-2 text-green-500 font-normal">✓</span>
                        )}
                      </>
                    }
                    labelClassName="block text-xs font-medium text-gray-500 uppercase mb-1"
                    value={newClientForm.nit}
                    onChange={(nit: string) => handleNewClientChange('nit', nit)}
                    placeholder="0000-000000-000-0"
                    disabled={newClientForm.esConsumidorFinal}
                    validation={
                      newClientErrors.nit
                        ? { valid: false, message: newClientErrors.nit }
                        : { valid: true, message: '' }
                    }
                    showErrorWhenEmpty={!!newClientErrors.nit}
                    messageVariant="below-invalid"
                    colorMode="blue"
                    tone="neutral"
                    inputClassName={
                      newClientErrors.nit
                        ? 'bg-red-50'
                        : newClientForm.nit && getNitOrDuiDigitsRemaining(newClientForm.nit) === 0
                          ? 'border-green-300 bg-green-50'
                          : ''
                    }
                  />
                </div>
                <div className="flex-1">
                  <NrcField
                    label="NRC"
                    labelClassName="block text-xs font-medium text-gray-500 uppercase mb-1"
                    value={newClientForm.nrc}
                    onChange={(nrc: string) => handleNewClientChange('nrc', nrc)}
                    placeholder="000000-0"
                    disabled={newClientForm.esConsumidorFinal}
                    validation={
                      newClientErrors.nrc
                        ? { valid: false, message: newClientErrors.nrc }
                        : { valid: true, message: '' }
                    }
                    showErrorWhenEmpty={!!newClientErrors.nrc}
                    messageVariant="below-invalid"
                    colorMode="blue"
                    tone="neutral"
                    inputClassName={newClientErrors.nrc ? 'bg-red-50' : ''}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nombre del Cliente <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newClientForm.name}
                  onChange={(e) => handleNewClientChange('name', e.target.value)}
                  placeholder="Nombre completo del cliente"
                  disabled={newClientForm.esConsumidorFinal}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${
                    newClientErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {newClientErrors.name && (
                  <p className="mt-1 text-xs text-red-500">{newClientErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nombre Comercial</label>
                <input
                  type="text"
                  value={newClientForm.nombreComercial}
                  onChange={(e) => handleNewClientChange('nombreComercial', e.target.value)}
                  placeholder="Personalizar nombre comercial"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <SelectActividad
                  value={newClientForm.actividadEconomica}
                  onChange={(codigo: string, descripcion: string) => {
                    handleNewClientChange('actividadEconomica', codigo);
                    handleNewClientChange('descActividad', descripcion);
                  }}
                  label="Actividad Económica"
                  placeholder="Escribe una actividad..."
                  required={false}
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <SelectUbicacion
                    departamento={newClientForm.departamento}
                    municipio={newClientForm.municipio}
                    onDepartamentoChange={(codigo: string) => handleNewClientChange('departamento', codigo)}
                    onMunicipioChange={(codigo: string) => handleNewClientChange('municipio', codigo)}
                    showLabels
                    layout="vertical"
                    size="md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Dirección</label>
                <textarea
                  value={newClientForm.direccion}
                  onChange={(e) => handleNewClientChange('direccion', e.target.value)}
                  rows={2}
                  placeholder="Digite el complemento de la dirección"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div>
                <PhoneField
                  label={
                    <>
                      Teléfono {!newClientForm.esConsumidorFinal && <span className="text-red-500">*</span>}
                    </>
                  }
                  labelClassName="block text-xs font-medium text-gray-500 uppercase mb-1"
                  value={newClientForm.telefono}
                  onChange={(telefono: string) => handleNewClientChange('telefono', telefono)}
                  placeholder="70001234"
                  type="tel"
                  disabled={newClientForm.esConsumidorFinal}
                  validation={
                    newClientErrors.telefono
                      ? { valid: false, message: newClientErrors.telefono }
                      : { valid: true, message: '' }
                  }
                  showErrorWhenEmpty={!!newClientErrors.telefono}
                  messageVariant="below-invalid"
                  colorMode="blue"
                  tone="neutral"
                  fontMono={false}
                  inputClassName={newClientErrors.telefono ? 'bg-red-50' : ''}
                />
              </div>

              <div>
                <EmailField
                  label={
                    <>
                      Correo Electrónico {!newClientForm.esConsumidorFinal && <span className="text-red-500">*</span>}
                    </>
                  }
                  labelClassName="block text-xs font-medium text-gray-500 uppercase mb-1"
                  value={newClientForm.email}
                  onChange={(email: string) => handleNewClientChange('email', email)}
                  placeholder="correo@ejemplo.com"
                  disabled={newClientForm.esConsumidorFinal}
                  validation={
                    newClientErrors.email
                      ? { valid: false, message: newClientErrors.email }
                      : { valid: true, message: '' }
                  }
                  showErrorWhenEmpty={!!newClientErrors.email}
                  messageVariant="below-invalid"
                  colorMode="blue"
                  tone="neutral"
                  inputClassName={newClientErrors.email ? 'bg-red-50' : ''}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={() => setShowNewClientForm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNewClient}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar item */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Agregar Producto</h3>
              <button onClick={() => setShowAddItem(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Descripcion</label>
                <input
                  type="text"
                  value={newItem.descripcion}
                  onChange={(e) => setNewItem({ ...newItem, descripcion: e.target.value })}
                  onBlur={handleNewItemDescriptionBlur}
                  placeholder="Ej: Servicio de consultoria"
                  className="w-full mt-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
                {productSuggestions.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                    {productSuggestions.map((p: ProductData) => (
                      <button
                        key={p.id ?? p.key}
                        type="button"
                        onClick={() => {
                          setNewItem({
                            ...newItem,
                            codigo: p.codigo,
                            descripcion: p.descripcion,
                            precioUni: p.precioUni,
                            tipoItem: typeof p.tipoItem === 'number' ? p.tipoItem : 1,
                          });
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 active:bg-blue-100 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{p.descripcion}</p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {p.codigo ? `Código: ${p.codigo}` : 'Sin código'}
                            </p>
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <p className="text-sm font-mono text-gray-900">${p.precioUni.toFixed(2)}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {tipoDoc === '01' ? 'Precio (C/IVA)' : 'Precio (S/IVA)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.precioUni || ''}
                    onChange={(e) =>
                      setNewItem({ ...newItem, precioUni: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0.00"
                    className="w-full mt-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={newItem.cantidad}
                    onChange={(e) =>
                      setNewItem({ ...newItem, cantidad: parseInt(e.target.value) || 1 })
                    }
                    className="w-full mt-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Cargo/Abono (no base)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.cargosNoBase}
                    onChange={(e) =>
                      setNewItem({ ...newItem, cargosNoBase: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0.00 (puede ser negativo)"
                    className="w-full mt-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Valores positivos suman al total, negativos restan.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Tributo</label>
                  <select
                    value={newItem.tributoCodigo || ''}
                    onChange={(e) =>
                      setNewItem({ ...newItem, tributoCodigo: e.target.value || null })
                    }
                    className="w-full mt-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Ninguno</option>
                    <option value="20">IVA 13%</option>
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Para FE (01) y CCF (03) solo usamos IVA 13% (código 20).
                  </p>
                </div>
              </div>
              <button
                onClick={addItem}
                disabled={!newItem.descripcion || newItem.precioUni <= 0}
                className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                  newItem.descripcion && newItem.precioUni > 0
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                <Plus className="w-5 h-5" />
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview DTE */}
      {showPreview && generatedDTE && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Factura Generada</h3>
              <button onClick={() => setShowPreview(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">DTE Generado</p>
                <p className="text-sm text-green-600">
                  {generatedDTE.identificacion.codigoGeneracion.substring(0, 8)}...
                </p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo:</span>
                <span className="font-medium">{generatedDTE.identificacion.tipoDte}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Control:</span>
                <span className="font-medium font-mono text-xs">{generatedDTE.identificacion.numeroControl}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente:</span>
                <span className="font-medium">{generatedDTE.receptor.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Items:</span>
                <span className="font-medium">{generatedDTE.cuerpoDocumento.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total:</span>
                <span className="font-bold text-lg text-green-600">
                  ${generatedDTE.resumen.totalPagar.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => {
                  onShowTransmision(generatedDTE);
                  setShowPreview(false);
                }}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <Receipt className="w-5 h-5" />
                Transmitir a Hacienda
              </button>
              
              {/* Compartir por WhatsApp */}
              <button
                onClick={() => {
                  // Crear mensaje para WhatsApp
                  const mensaje = `*DTE Generado*%0A%0A` +
                    `📄 Tipo: ${generatedDTE.identificacion.tipoDte}%0A` +
                    `🔢 Codigo: ${generatedDTE.identificacion.codigoGeneracion.substring(0, 8)}...%0A` +
                    `👤 Cliente: ${generatedDTE.receptor.nombre}%0A` +
                    `💰 Total: $${generatedDTE.resumen.totalPagar.toFixed(2)}%0A%0A` +
                    `📅 Fecha: ${generatedDTE.identificacion.fecEmi}`;
                  
                  window.open(`https://wa.me/?text=${mensaje}`, '_blank');
                }}
                className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Compartir por WhatsApp
              </button>

              {/* Descargar JSON */}
              <button
                onClick={() => {
                  const json = JSON.stringify(generatedDTE, null, 2);
                  const blob = new Blob([json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `DTE-${generatedDTE.identificacion.codigoGeneracion}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full py-3 border border-gray-300 rounded-xl font-medium text-gray-700 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar JSON
              </button>

              <button
                onClick={() => setShowPreview(false)}
                className="w-full py-3 text-gray-500 font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileFactura;
