import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Send, Loader2 } from 'lucide-react';
import { Producto } from '../../types/inventario';
import { inventarioService } from '../../utils/inventario/inventarioService';
import { useToast } from '../Toast';
import { BACKEND_CONFIG, getAuthHeaders } from '../../utils/backendConfig';
import { generarDTE, redondear } from '../../utils/dteGenerator';
import { getEmisor } from '../../utils/emisorDb';

interface CartItem {
  producto: Producto;
  cantidad: number;
}

const formatCurrency = (n: number) => `$${(n || 0).toFixed(2)}`;

const PosCF: React.FC = () => {
  const { addToast } = useToast();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [resultadoJSON, setResultadoJSON] = useState<string>('');
  const [respuestaMH, setRespuestaMH] = useState<any>(null);

  useEffect(() => {
    setProductos(inventarioService.getProductos());
  }, []);

  const categorias = useMemo(() => ['todos', ...Array.from(new Set(productos.map((p) => p.categoria)))], [productos]);

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const cumpleCategoria = categoriaFiltro === 'todos' || p.categoria === categoriaFiltro;
      const text = (busqueda || '').toLowerCase();
      const cumpleBusqueda =
        !text ||
        p.descripcion.toLowerCase().includes(text) ||
        (p.codigo || '').toLowerCase().includes(text) ||
        (p.codigoPrincipal || '').toLowerCase().includes(text);
      return cumpleCategoria && cumpleBusqueda && p.activo !== false;
    });
  }, [productos, categoriaFiltro, busqueda]);

  const addToCart = (producto: Producto) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.producto.id === producto.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
        return copy;
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  const updateQty = (productoId: string, delta: number) => {
    setCart((prev) => {
      const copy = prev
        .map((c) => (c.producto.id === productoId ? { ...c, cantidad: Math.max(1, c.cantidad + delta) } : c))
        .filter((c) => c.cantidad > 0);
      return copy;
    });
  };

  const removeItem = (productoId: string) => {
    setCart((prev) => prev.filter((c) => c.producto.id !== productoId));
  };

  const totales = useMemo(() => {
    const gravado = cart.reduce(
      (sum, item) => sum + redondear((item.producto.precioSugerido || 0) * item.cantidad, 8),
      0
    );
    const iva = redondear(gravado * 0.13, 8);
    const total = redondear(gravado, 2);
    return { gravado, iva, total };
  }, [cart]);

  const buildDTE = async () => {
    const emisor = await getEmisor();
    if (!emisor) throw new Error('Configura datos del emisor primero');

    const nit = (emisor.nit || '').replace(/[\s-]/g, '');
    if (!(nit.length === 9 || nit.length === 14)) {
      throw new Error('NIT del emisor debe tener 9 o 14 dígitos (sin guiones)');
    }

    const items = cart.map((item, idx) => {
      const precio = Number(item.producto.precioSugerido || 0);
      const cantidad = Number(item.cantidad || 1);
      const totalLinea = redondear(precio * cantidad, 8);
      return {
        numItem: idx + 1,
        tipoItem: 1, // Bien
        cantidad,
        codigo: item.producto.codigo || null,
        uniMedida: 59, // Unidad genérica
        descripcion: item.producto.descripcion,
        precioUni: precio,
        montoDescu: 0,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada: totalLinea,
        tributos: ['20'],
        numeroDocumento: null,
        codTributo: null,
        psv: 0,
        noGravado: 0,
      };
    });

    const receptor = {
      id: 999999,
      name: 'Consumidor Final',
      nit: '',
      nrc: '',
      actividadEconomica: '',
      departamento: '',
      municipio: '',
      direccion: '',
      telefono: '',
      email: '',
      esConsumidorFinal: true,
      nombreComercial: '',
      timestamp: Date.now(),
    };

    const datosFactura = {
      emisor: {
        nit: emisor.nit,
        nrc: emisor.nrc,
        nombre: emisor.nombre,
        nombreComercial: emisor.nombreComercial,
        actividadEconomica: emisor.actividadEconomica,
        descActividad: emisor.descActividad,
        tipoEstablecimiento: emisor.tipoEstablecimiento,
        departamento: emisor.departamento,
        municipio: emisor.municipio,
        direccion: emisor.direccion,
        telefono: emisor.telefono,
        correo: emisor.correo,
        codEstableMH: emisor.codEstableMH || 'M001',
        codPuntoVentaMH: emisor.codPuntoVentaMH || 'P001',
      },
      receptor,
      items,
      tipoDocumento: '01',
      tipoTransmision: 1,
      formaPago: '01', // Efectivo
      condicionOperacion: 1, // Contado
    };

    const correlativo = Date.now();
    const dte = generarDTE(datosFactura as any, correlativo);
    setResultadoJSON(JSON.stringify(dte, null, 2));
    return { dte, nitSinGuiones: nit };
  };

  const transmitir = async () => {
    if (!cart.length) {
      addToast('Agrega productos al carrito', 'error');
      return;
    }
    setIsSending(true);
    try {
      const { dte, nitSinGuiones } = await buildDTE();
      const response = await fetch(`${BACKEND_CONFIG.URL}/api/dte/process`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'x-business-id': nitSinGuiones,
        },
        body: JSON.stringify({
          dte,
          nit: nitSinGuiones,
          ambiente: '00',
          flowType: 'emission',
          business_id: nitSinGuiones,
        }),
      });

      const result = await response.json();
      setRespuestaMH(result);
      if (response.ok && result.success && result.data?.transmisionResult?.estado === 'PROCESADO') {
        addToast('DTE procesado exitosamente', 'success');
      } else {
        addToast(
          result.error?.userMessage || result.data?.transmisionResult?.descripcionMsg || 'Error en la transmisión',
          'error'
        );
      }
    } catch (e: any) {
      addToast(e?.message || 'Error al transmitir', 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <h1 className="text-xl font-semibold text-gray-900">POS Consumidor Final</h1>
          <span className="text-xs text-gray-500">Precios con IVA incluido · Tributo 20</span>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaFiltro(cat)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                categoriaFiltro === cat
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar productos..."
            className="ml-auto w-full md:w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {productosFiltrados.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="text-left bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow transition overflow-hidden"
            >
              {p.hasImage ? (
                <div className="aspect-square bg-gray-100" />
              ) : (
                <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-4xl text-gray-400">
                  🛒
                </div>
              )}
              <div className="p-3 space-y-1">
                <div className="text-sm font-semibold text-gray-900 line-clamp-2">{p.descripcion}</div>
                <div className="text-xs text-emerald-700 font-medium">{p.categoria}</div>
                <div className="text-base font-bold text-gray-900">{formatCurrency(p.precioSugerido || 0)}</div>
              </div>
            </button>
          ))}
          {productosFiltrados.length === 0 && (
            <div className="col-span-full text-sm text-gray-500">Sin productos para mostrar.</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">Carrito</h2>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {cart.length === 0 && <div className="text-sm text-gray-500">Carrito vacío. Toca productos para agregarlos.</div>}
          {cart.map((item) => (
            <div key={item.producto.id} className="border border-gray-200 rounded-lg p-3 flex gap-3 items-center">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 line-clamp-2">{item.producto.descripcion}</div>
                <div className="text-xs text-gray-500">{formatCurrency(item.producto.precioSugerido || 0)} c/u</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateQty(item.producto.id, -1)}
                  className="p-2 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="w-8 text-center text-sm font-semibold">{item.cantidad}</div>
                <button
                  type="button"
                  onClick={() => updateQty(item.producto.id, 1)}
                  className="p-2 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {formatCurrency((item.producto.precioSugerido || 0) * item.cantidad)}
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.producto.id)}
                className="p-2 rounded-full border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-3 space-y-1 text-sm text-gray-700">
          <div className="flex justify-between">
            <span>Gravado</span>
            <span>{formatCurrency(totales.gravado)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA 13%</span>
            <span>{formatCurrency(totales.iva)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(totales.total)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={transmitir}
            disabled={isSending || cart.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSending ? 'Enviando…' : 'Cobrar / Generar DTE'}
          </button>
          <button
            onClick={() => {
              setCart([]);
              setResultadoJSON('');
              setRespuestaMH(null);
            }}
            className="w-full inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-200"
          >
            <CreditCard className="w-4 h-4" />
            Nueva venta
          </button>
        </div>

        {resultadoJSON && (
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-xs text-gray-800 max-h-48 overflow-auto">
            <div className="flex items-center justify-between mb-2 text-sm font-semibold text-gray-700">
              <span>JSON generado</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(resultadoJSON)}
                className="text-emerald-600 hover:text-emerald-700"
              >
                Copiar
              </button>
            </div>
            <pre className="whitespace-pre-wrap break-words">{resultadoJSON}</pre>
          </div>
        )}

        {respuestaMH && (
          <div
            className={`border rounded-lg p-3 text-sm ${
              respuestaMH.estado === 'PROCESADO' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="font-semibold">Respuesta Hacienda: {respuestaMH.estado || 'ERROR'}</div>
            <div className="text-gray-700 text-xs">
              {respuestaMH.descripcionMsg ||
                respuestaMH.error ||
                respuestaMH.data?.transmisionResult?.descripcionMsg ||
                'Mensaje no disponible'}
            </div>
            <pre className="mt-2 max-h-40 overflow-auto bg-white border border-gray-100 rounded p-2 text-[11px] text-gray-800">
              {JSON.stringify(respuestaMH, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default PosCF;
