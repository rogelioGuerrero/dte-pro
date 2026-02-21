import React, { useEffect, useMemo, useState } from 'react';
import {
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  User,
  FileText,
  Loader2,
  Star,
} from 'lucide-react';
import { getClients, ClientData } from '../utils/clientDb';
import { getProducts, ProductData } from '../utils/productDb';
import { getEmisor, EmisorData } from '../utils/emisorDb';
import { generarDTE, ItemFactura, calcularTotales, redondear, DTEJSON, formasPago } from '../utils/dteGenerator';
import { ToastContainer, useToast } from './Toast';
import Tooltip from './Tooltip';
import TransmisionModal from './TransmisionModal';
import { applySalesFromDTE, validateStockForSale } from '../utils/inventoryDb';

type CartItem = {
  id: string;
  codigo: string;
  descripcion: string;
  precioUni: number;
  cantidad: number;
  tipoItem: number;
  uniMedida: number;
  esExento: boolean;
};

const QuickSale: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();

  const [emisor, setEmisor] = useState<EmisorData | null>(null);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);

  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);

  const [formaPago, setFormaPago] = useState('01');
  const [condicionOperacion, setCondicionOperacion] = useState(1);
  const [observaciones, setObservaciones] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDTE, setGeneratedDTE] = useState<DTEJSON | null>(null);
  const [showTransmision, setShowTransmision] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [e, c, p] = await Promise.all([getEmisor(), getClients(), getProducts()]);
      setEmisor(e);
      setClients(c);
      setProducts(p);
    };
    load();
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => {
      return (
        (p.codigo || '').toLowerCase().includes(term) ||
        (p.descripcion || '').toLowerCase().includes(term)
      );
    });
  }, [products, search]);

  const favoriteProducts = useMemo(() => {
    return products.filter((p) => !!p.favorite);
  }, [products]);

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) => {
      return c.name.toLowerCase().includes(term) || c.nit.includes(clientSearch);
    });
  }, [clientSearch, clients]);

  const totals = useMemo(() => {
    const itemsFactura: ItemFactura[] = cart.map((item, idx) => ({
      numItem: idx + 1,
      tipoItem: item.tipoItem,
      cantidad: item.cantidad,
      codigo: item.codigo?.trim() ? item.codigo.trim() : null,
      uniMedida: item.uniMedida,
      descripcion: item.descripcion,
      precioUni: item.precioUni,
      montoDescu: 0,
      ventaNoSuj: 0,
      ventaExenta: item.esExento ? redondear(item.cantidad * item.precioUni, 2) : 0,
      ventaGravada: item.esExento ? 0 : redondear(item.cantidad * item.precioUni, 2),
      tributos: !item.esExento ? ['20'] : null, // Array con 20 si NO es exento
      numeroDocumento: null,
      codTributo: item.esExento ? null : '20',
      psv: 0,
      noGravado: 0,
      ivaItem: item.esExento ? 0 : redondear(item.cantidad * item.precioUni * 0.13, 2),
    }));
    return {
      itemsFactura,
      totales: calcularTotales(itemsFactura),
    };
  }, [cart]);

  const addToCart = (p: ProductData) => {
    const codigo = (p.codigo || '').trim();
    const tipoItem = typeof p.tipoItem === 'number' ? p.tipoItem : 1;
    if (tipoItem === 1 && !codigo) {
      addToast('Este producto no tiene código. Asígnalo en el catálogo.', 'error');
      return;
    }

    setCart((prev) => {
      if (tipoItem === 1) {
        const idx = prev.findIndex((i) => i.tipoItem === 1 && i.codigo === codigo);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
          return copy;
        }
      }
      return [
        ...prev,
        {
          id: `cart_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          codigo,
          descripcion: p.descripcion,
          precioUni: p.precioUni,
          cantidad: 1,
          tipoItem,
          uniMedida: typeof p.uniMedida === 'number' ? p.uniMedida : 99,
          esExento: false,
        },
      ];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) => {
      const next = prev
        .map((i) => (i.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i))
        .filter((i) => i.cantidad > 0);
      return next;
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const handleGenerate = async () => {
    if (!emisor) {
      addToast('Configura los datos del emisor', 'error');
      return;
    }
    if (!selectedClient) {
      addToast('Selecciona un cliente', 'error');
      return;
    }
    if (totals.itemsFactura.length === 0) {
      addToast('Agrega al menos un producto/servicio', 'error');
      return;
    }

    if (totals.totales.montoTotal >= 25000) {
      const receptorId = (selectedClient.nit || '').replace(/[\s-]/g, '').trim();
      if (!receptorId) {
        addToast('Monto >= $25,000: debes completar los datos del receptor (documento de identificación).', 'error');
        return;
      }
    }

    const goodsOnly = totals.itemsFactura
      .filter((i) => i.tipoItem === 1)
      .map((i) => ({ codigo: (i.codigo || '').trim(), cantidad: i.cantidad, descripcion: i.descripcion }))
      .filter((i) => !!i.codigo);

    const stockCheck = goodsOnly.length
      ? await validateStockForSale(goodsOnly)
      : ({ ok: true } as const);

    if (!stockCheck.ok) {
      addToast(stockCheck.message, 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const correlativo = Date.now();
      const dte = generarDTE(
        {
          emisor,
          receptor: selectedClient,
          items: totals.itemsFactura,
          tipoDocumento: '01',
          tipoTransmision: 1,
          formaPago,
          condicionOperacion,
          observaciones,
        },
        correlativo,
        '00'
      );

      setGeneratedDTE(dte);
      await applySalesFromDTE(dte);
      
      addToast('DTE generado correctamente', 'success');
      setShowTransmision(true);
    } catch (error) {
      addToast('Error al generar DTE', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {showTransmision && generatedDTE && (
        <TransmisionModal
          dte={generatedDTE}
          onClose={() => setShowTransmision(false)}
          onSuccess={(sello) => {
            addToast(`DTE transmitido. Sello: ${sello.substring(0, 8)}...`, 'success');
            setCart([]);
            setObservaciones('');
            setGeneratedDTE(null);
          }}
          ambiente="00"
          logoUrl={emisor?.logo}
        />
      )}

      {showClientPicker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <p className="text-lg font-semibold text-gray-900">Seleccionar cliente</p>
              <button
                type="button"
                onClick={() => setShowClientPicker(false)}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar por nombre o NIT..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[55vh] overflow-y-auto">
              <button
                type="button"
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
                  setShowClientPicker(false);
                  setClientSearch('');
                }}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100"
              >
                <p className="text-sm font-semibold text-gray-900">Consumidor Final</p>
                <p className="text-xs text-gray-500">Sin documento</p>
              </button>
              {filteredClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedClient(c);
                    setShowClientPicker(false);
                    setClientSearch('');
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.nit ? `NIT: ${c.nit}` : 'Sin NIT'}{c.nrc ? ` | NRC: ${c.nrc}` : ''}</p>
                </button>
              ))}
              {filteredClients.length === 0 && (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin resultados</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Venta Rápida</h2>
          <p className="text-sm text-gray-500">Interfaz optimizada para operación táctil</p>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip content="Seleccionar cliente" position="bottom">
            <button
              type="button"
              onClick={() => setShowClientPicker(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                selectedClient
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <User className="w-4 h-4" />
              <span className="max-w-[220px] truncate">
                {selectedClient ? selectedClient.name : 'Cliente'}
              </span>
            </button>
          </Tooltip>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !selectedClient || cart.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 min-h-0 flex-1">
        <div className="col-span-7 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col min-h-0">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código o descripción..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {search.trim() === '' && favoriteProducts.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" /> Favoritos
                  </p>
                  <span className="text-[11px] text-gray-400">{favoriteProducts.length}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {favoriteProducts.slice(0, 24).map((p) => (
                    <button
                      key={p.id ?? p.key}
                      type="button"
                      onClick={() => addToCart(p)}
                      className="border border-amber-200 bg-amber-50/40 rounded-xl p-3 text-left hover:bg-amber-50 active:bg-amber-100 transition-colors"
                    >
                      {p.image && (
                        <img
                          src={p.image}
                          alt={p.descripcion}
                          className="w-full h-20 object-cover rounded-lg border border-amber-100"
                        />
                      )}
                      <div className={p.image ? 'mt-2' : ''}>
                        <p className="text-[11px] text-gray-500 font-mono truncate">{p.codigo || 'SIN CÓDIGO'}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1 line-clamp-2">{p.descripcion}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-mono text-gray-900">${(p.precioUni || 0).toFixed(2)}</p>
                          <span className={`text-[10px] px-2 py-1 rounded-full ${p.tipoItem === 2 ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-800'}`}>
                            {p.tipoItem === 2 ? 'Servicio' : 'Bien'}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map((p) => (
                <button
                  key={p.id ?? p.key}
                  type="button"
                  onClick={() => addToCart(p)}
                  className="border border-gray-200 rounded-xl p-3 text-left hover:bg-blue-50 active:bg-blue-100 transition-colors"
                >
                  {p.image && (
                    <img
                      src={p.image}
                      alt={p.descripcion}
                      className="w-full h-20 object-cover rounded-lg border border-gray-100"
                    />
                  )}
                  <p className="text-[11px] text-gray-500 font-mono truncate">{p.codigo || 'SIN CÓDIGO'}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1 line-clamp-2">{p.descripcion}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-mono text-gray-900">${(p.precioUni || 0).toFixed(2)}</p>
                    <span className={`text-[10px] px-2 py-1 rounded-full ${p.tipoItem === 2 ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'}`}>
                      {p.tipoItem === 2 ? 'Servicio' : 'Bien'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-5 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col min-h-0">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-700" />
              <p className="text-sm font-semibold text-gray-900">Detalle</p>
            </div>
            <button
              type="button"
              onClick={() => setCart([])}
              disabled={!cart.length}
              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
            >
              Vaciar
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="p-6 text-sm text-gray-400">Sin items</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {cart.map((i) => (
                  <div key={i.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 font-mono">{i.codigo}</p>
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{i.descripcion}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          ${i.precioUni.toFixed(2)} x {i.cantidad} = <span className="font-mono text-gray-800">${(i.precioUni * i.cantidad).toFixed(2)}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(i.id)}
                        className="p-2 text-gray-300 hover:text-red-600"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => changeQty(i.id, -1)}
                          className="px-3 py-2 hover:bg-gray-50"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <div className="px-3 py-2 text-sm font-mono">{i.cantidad}</div>
                        <button
                          type="button"
                          onClick={() => changeQty(i.id, 1)}
                          className="px-3 py-2 hover:bg-gray-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <span className={`text-[10px] px-2 py-1 rounded-full ${i.tipoItem === 2 ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'}`}>
                        {i.tipoItem === 2 ? 'Servicio' : 'Bien'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-100 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total</span>
              <span className="font-mono font-semibold text-gray-900">${totals.totales.totalPagar.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                {formasPago.map((f) => (
                  <option key={f.codigo} value={f.codigo}>
                    {f.descripcion}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCondicionOperacion(1)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    condicionOperacion === 1 ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  Contado
                </button>
                <button
                  type="button"
                  onClick={() => setCondicionOperacion(2)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    condicionOperacion === 2 ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  Crédito
                </button>
              </div>
            </div>

            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Observaciones (opcional)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white resize-none"
            />
          </div>
        </div>
      </div>

      {showClientPicker && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Seleccionar cliente</p>
                <p className="text-xs text-gray-500">Busca por nombre o NIT</p>
              </div>
              <button
                type="button"
                onClick={() => setShowClientPicker(false)}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cerrar
              </button>
            </div>

            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Ej: ACME o 0614..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  autoFocus
                />
              </div>

              <div className="mt-3 max-h-80 overflow-y-auto border border-gray-100 rounded-xl">
                {filteredClients.length === 0 ? (
                  <div className="p-6 text-sm text-gray-400 text-center">Sin resultados</div>
                ) : (
                  filteredClients.slice(0, 200).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedClient(c);
                        setShowClientPicker(false);
                        setClientSearch('');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 font-mono truncate">NIT: {c.nit}</p>
                    </button>
                  ))
                )}
              </div>

              {filteredClients.length > 200 && (
                <p className="mt-2 text-xs text-gray-400">Mostrando 200 resultados. Refina tu búsqueda.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickSale;
