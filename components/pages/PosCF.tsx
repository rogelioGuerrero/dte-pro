import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Send, Loader2 } from 'lucide-react';
import { Producto } from '../../types/inventario';
import { inventarioService } from '../../utils/inventario/inventarioService';
import { useToast } from '../Toast';
import { generarCorrelativoControlado, generarDTE, redondear } from '../../utils/dteGenerator';
import { getEmisor } from '../../utils/emisorDb';
import { useEmisor } from '../../contexts/EmisorContext';
import { checkLicense } from '../../utils/licenseValidator';
import { getCertificate } from '../../utils/secureStorage';
import { limpiarDteParaFirma, type TransmitDTEResponse, transmitirDocumento } from '../../utils/firmaApiClient';

interface CartItem {
  producto: Producto;
  cantidad: number;
}

const formatCurrency = (n: number) => `$${(n || 0).toFixed(2)}`;

const PosCF: React.FC = () => {
  const { addToast } = useToast();
  const { businessId } = useEmisor();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [correoReceptor, setCorreoReceptor] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [resultadoJSON, setResultadoJSON] = useState<string>('');
  const [respuestaMH, setRespuestaMH] = useState<TransmitDTEResponse | { error: string } | null>(null);

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
    // Para FE 01: precios incluyen IVA; no calcular IVA en frontend
    const gravado = cart.reduce(
      (sum, item) => sum + redondear((item.producto.precioSugerido || 0) * item.cantidad, 8),
      0
    );
    const iva = 0;
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
      const precioConIva = redondear(Number(item.producto.precioSugerido || 0), 2);
      const cantidad = Number(item.cantidad || 1);

      // FE 01: mantener precio final (incluye IVA) en ventaGravada y precioUni; backend recalcula IVA
      const precioUni = precioConIva;
      const ventaGravada = redondear(precioConIva * cantidad, 2);
      const ivaItem = 0; // no enviar IVA desde frontend

      return {
        numItem: idx + 1,
        tipoItem: 1, // Bien
        cantidad,
        codigo: item.producto.codigo || item.producto.codigoPrincipal || `VAR-${idx + 1}`,
        uniMedida: 99,
        descripcion: item.producto.descripcion.toUpperCase(),
        precioUni: precioUni,
        montoDescu: 0,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada,
        tributos: null, // no enviar tributos; backend arma IVA
        numeroDocumento: null,
        codTributo: null,
        psv: 0,
        noGravado: 0,
        ivaItem,
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
      email: correoReceptor,
      esConsumidorFinal: true,
      nombreComercial: '',
      timestamp: Date.now(),
    };

    const telefonoEmisor = (emisor.telefono || '').replace(/\D/g, '');
    const nombreComercial = (emisor.nombreComercial || '').trim();
    const direccionEmisor = (emisor.direccion || '').trim() || 'Dirección del negocio';

    const datosFactura = {
      emisor: {
        nit: emisor.nit,
        nrc: emisor.nrc,
        nombre: emisor.nombre,
        nombreComercial: ['n/a', 'na'].includes(nombreComercial.toLowerCase()) ? '' : nombreComercial,
        actividadEconomica: emisor.actividadEconomica,
        descActividad: emisor.descActividad,
        tipoEstablecimiento: emisor.tipoEstablecimiento,
        departamento: emisor.departamento,
        municipio: emisor.municipio,
        direccion: direccionEmisor,
        telefono: telefonoEmisor,
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

    const correlativo = generarCorrelativoControlado(datosFactura.tipoDocumento, datosFactura.emisor.codEstableMH, datosFactura.emisor.codPuntoVentaMH);
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
      const licensed = await checkLicense();
      if (!licensed) {
        addToast('Licencia requerida para transmitir desde este dispositivo.', 'error');
        return;
      }

      const { dte, nitSinGuiones } = await buildDTE();

      const activeBusinessId = businessId || nitSinGuiones;
      if (!activeBusinessId) {
        addToast('Selecciona un emisor antes de transmitir.', 'error');
        return;
      }

      const stored = await getCertificate();
      if (!stored?.password) {
        addToast('Guarda la contraseña del certificado en Mi Cuenta antes de transmitir.', 'error');
        return;
      }

      const dteLimpio = limpiarDteParaFirma(dte as any);
      const result = await transmitirDocumento({
        dte: dteLimpio,
        passwordPri: stored.password,
        ambiente: '00',
      });

      setRespuestaMH(result);

      const estado = result.mhResponse?.estado;
      const ok = result.transmitted === true && result.mhResponse?.success === true;

      if (ok && (estado === 'PROCESADO' || estado === 'ACEPTADO' || estado === 'ACEPTADO_CON_ADVERTENCIAS')) {
        addToast('DTE procesado exitosamente', 'success');
      } else if (result.isOffline) {
        addToast(result.contingencyReason || 'Documento enviado a contingencia', 'info');
      } else {
        addToast(result.mhResponse?.mensaje || 'Error en la transmisión', 'error');
      }
    } catch (e: any) {
      setRespuestaMH({ error: e?.message || 'Error al transmitir' });
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

        <div className="border-t border-gray-100 pt-3 space-y-3 text-sm text-gray-700">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Correo (opcional, para enviar factura)</label>
            <input
              type="email"
              value={correoReceptor}
              onChange={(e) => setCorreoReceptor(e.target.value)}
              placeholder="cliente@correo.com (déjalo vacío si no quiere)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
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
            disabled={isSending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 font-semibold shadow"
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {isSending ? 'Enviando...' : 'Cobrar / Generar DTE'}
          </button>
          {resultadoJSON && (
            <button
              onClick={() => navigator.clipboard.writeText(resultadoJSON)}
              className="w-full text-sm text-emerald-700 hover:text-emerald-800"
            >
              Copiar JSON
            </button>
          )}
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
          <div className="border rounded-lg p-3 text-sm text-gray-800 space-y-2">
            {(() => {
              const mh = 'mhResponse' in respuestaMH ? respuestaMH.mhResponse : undefined;
              const mhStatus = mh?.estado;
              const rawErrorMessage: string = 'error' in respuestaMH
                ? String(respuestaMH.error || '')
                : (typeof respuestaMH.error === 'string' ? respuestaMH.error : String(respuestaMH.error?.message || ''));
              const mhMessage: string = 'error' in respuestaMH
                ? rawErrorMessage
                : String(mh?.mensaje || rawErrorMessage || 'Mensaje no disponible');
              return (
                <>
                  <div className="font-semibold">Hacienda: {mhStatus || 'Sin estado'}</div>
                  <div className="text-gray-600">{mhMessage || 'Mensaje no disponible'}</div>
                  {mh?.selloRecepcion && (
                    <div className="text-xs text-gray-500 break-all">Sello: {mh.selloRecepcion}</div>
                  )}
                  {mh?.codigoGeneracion && (
                    <div className="text-xs text-gray-500 break-all">Código: {mh.codigoGeneracion}</div>
                  )}
                  {'mhResponse' in respuestaMH && respuestaMH.isOffline && (
                    <div className="pt-1 text-amber-700 font-semibold">Contingencia: {respuestaMH.contingencyReason || 'Documento pendiente de normalización.'}</div>
                  )}
                  <pre className="mt-2 max-h-40 overflow-auto bg-gray-50 border border-gray-100 rounded p-2 text-[11px] text-gray-800">
                    {JSON.stringify(respuestaMH, null, 2)}
                  </pre>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default PosCF;
