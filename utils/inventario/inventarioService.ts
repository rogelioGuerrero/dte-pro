import { 
  Producto, 
  Lote, 
  Proveedor, 
  MovimientoInventario, 
  ConfiguracionInventario,
  ReporteKardex,
  MovimientoKardex,
  ResumenInventario
} from '../../types/inventario';
import { 
  buscarProductosSimilares,
  calcularSimilitudAvanzada,
  detectarCategoria,
  generarCodigoProducto,
  normalizarDescripcion,
  extraerPalabrasClave
} from './similitudProductos';
import { loadSettings } from '../settings';

// Interfaz para JSON de compra (DTE)
interface ItemCompraJSON {
  numItem: number;
  tipoItem: number;
  numeroDocumento: string | null;
  cantidad: number;
  codigo: string;
  codTributo: string | null;
  uniMedida: number;
  descripcion: string;
  precioUni: number;
  montoDescu: number;
  ventaNoSuj: number;
  ventaExenta: number;
  ventaGravada: number;
  tributos: any;
  psv: number;
  noGravado: number;
  ivaItem: number;
}

interface EmisorJSON {
  nit: string;
  nrc: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  nombreComercial: string;
  direccion: {
    departamento: string;
    municipio: string;
    complemento: string;
  };
  telefono: string;
  correo: string;
}

interface CompraJSON {
  identificacion: {
    version: number;
    ambiente: string;
    tipoDte: string;
    numeroControl: string;
    codigoGeneracion: string;
    fecEmi: string;
    horEmi: string;
  };
  emisor: EmisorJSON;
  cuerpoDocumento: ItemCompraJSON[];
}

// Estructura mínima para aplicar ventas desde un DTE generado
interface VentaItemDTE {
  tipoItem: number;
  cantidad: number;
  codigo: string | null;
  descripcion: string;
  precioUni: number;
}

interface VentaDTE {
  identificacion?: {
    numeroControl?: string;
    fecEmi?: string;
  };
  receptor?: {
    nombre?: string;
  };
  cuerpoDocumento?: VentaItemDTE[];
}

interface VentaPendiente {
  id: string;
  createdAt: string;
  docRef: string;
  cliente: string;
  descripcion: string;
  cantidad: number;
  precioUni: number;
  candidates?: Array<{ productoId: string; descripcion: string; score: number }>;
}

interface CompraPendiente {
  id: string;
  createdAt: string;
  docRef: string;
  proveedorNombre: string;
  fecha: string;
  descripcion: string;
  codigo: string;
  cantidadOriginal: number;
  presentacion: string;
  factorConversion: number;
  cantidadBase: number;
  costoUnitario: number;
  candidates?: Array<{ productoId: string; descripcion: string; score: number }>;
}

class InventarioService {
  private readonly STORAGE_KEY = 'dte_inventario_simplificado_v1';
  private productos: Producto[] = [];
  private proveedores: Proveedor[] = [];
  private movimientos: MovimientoInventario[] = [];
  private descToProductoId: Record<string, string> = {};
  private ventasPendientes: VentaPendiente[] = [];
  private comprasPendientes: CompraPendiente[] = [];
  private ultimaImportacionCompra?: { docRefs: string[]; at: number; productosCreados: string[] };
  private config: ConfiguracionInventario = {
    metodoCosteo: 'UEPS', // Últimas entradas, primeras salidas
    margenSugerido: 0.4, // 40%
    alertaBajoStock: 5,
    permitirVentaSinStock: true
  };

  constructor() {
    this.aplicarDefaultsDesdeSettings();
    this.hidratarDesdeStorage();
  }

  public sincronizar(): void {
    this.hidratarDesdeStorage();
  }

  /**
   * Revierte una venta aplicada por `aplicarVentaDesdeDTE` usando el documentoReferencia.
   * Esto se usa cuando el DTE se elimina/cancela antes de transmitir a MH.
   */
  async revertirVentaPorDocumentoReferencia(documentoReferencia: string): Promise<{ ok: true; reverted: number } | { ok: false; message: string }> {
    const docRef = (documentoReferencia || '').toString().trim();
    if (!docRef) return { ok: false, message: 'Documento de referencia requerido' };

    const movimientosVenta = this.movimientos.filter((m) => m?.tipo === 'salida' && (m?.documentoReferencia || '').toString().trim() === docRef);
    if (movimientosVenta.length === 0) return { ok: false, message: 'No hay movimientos de salida para revertir' };

    // Seguridad simple: si hay salidas/entradas posteriores al docRef para el mismo producto, no revertimos
    const byId = new Map<string, MovimientoInventario[]>();
    for (const m of this.movimientos) {
      if (!m?.productoId) continue;
      const arr = byId.get(m.productoId) || [];
      arr.push(m);
      byId.set(m.productoId, arr);
    }

    const affectedProducts = Array.from(new Set(movimientosVenta.map((m) => m.productoId).filter(Boolean)));
    const maxFechaVenta = Math.max(...movimientosVenta.map((m) => (m.fecha ? new Date(m.fecha).getTime() : 0)));

    for (const productoId of affectedProducts) {
      const list = (byId.get(productoId) || []).filter(Boolean);
      const later = list.some((m) => {
        const t = m?.fecha ? new Date(m.fecha).getTime() : 0;
        if (t <= maxFechaVenta) return false;
        const ref = (m?.documentoReferencia || '').toString().trim();
        return ref !== docRef;
      });
      if (later) {
        return { ok: false, message: 'No se puede revertir: existen movimientos posteriores para uno o más productos' };
      }
    }

    // Aplicar reversión: devolver cantidades a lotes (o crear lote de reversión si no existe)
    for (const mov of movimientosVenta) {
      const producto = this.productos.find((p) => p.id === mov.productoId);
      if (!producto) continue;

      const qty = Number(mov.cantidad) || 0;
      if (!qty || qty <= 0) continue;

      this.asegurarDefaultsUnidades(producto);

      const loteId = (mov.loteId || '').toString().trim();
      let lote = loteId ? producto.lotes.find((l) => l.id === loteId) : undefined;
      if (!lote) {
        // Lote pudo haber sido eliminado si quedó en 0; creamos uno de reversión
        lote = {
          id: this.generarId(),
          proveedorId: 'REVERSION',
          proveedorNombre: 'REVERSION',
          cantidad: 0,
          costoUnitario: Number(producto.costoPromedio) || 0,
          fechaEntrada: new Date(),
          codigoHacienda: `${producto.id}-${(producto.lotes.length + 1).toString().padStart(3, '0')}`,
        } as any;
        producto.lotes.push(lote as any);
      }

      if (!lote) continue;
      lote.cantidad = (Number(lote.cantidad) || 0) + qty;
      producto.existenciasTotales = (Number(producto.existenciasTotales) || 0) + qty;
    }

    // Eliminar movimientos revertidos
    const toRemove = new Set(movimientosVenta.map((m) => m.id));
    this.movimientos = this.movimientos.filter((m) => !toRemove.has(m.id));

    // Recomputar totales por producto
    for (const productoId of affectedProducts) {
      const producto = this.productos.find((p) => p.id === productoId);
      if (producto) this.recomputarProductoDesdeLotes(producto);
    }

    this.persistirEnStorage();
    return { ok: true, reverted: movimientosVenta.length };
  }

  marcarUltimaImportacionCompraBatch(params: { docRefs: string[]; productosCreados: string[] }): void {
    const docRefs = Array.from(new Set((params.docRefs || []).map((x) => String(x).trim()).filter(Boolean)));
    if (docRefs.length === 0) return;
    const productosCreados = Array.from(new Set((params.productosCreados || []).map((x) => String(x)).filter(Boolean)));
    this.ultimaImportacionCompra = { docRefs, at: Date.now(), productosCreados };
    this.persistirEnStorage();
  }

  private aplicarDefaultsDesdeSettings(): void {
    try {
      const s = loadSettings();
      const metodo = s.inventoryCostingMethod;
      if (metodo) this.config.metodoCosteo = metodo;
    } catch {
      // ignore
    }
  }

  private hidratarDesdeStorage(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      // Config
      if (parsed?.config) {
        this.config = { ...this.config, ...parsed.config };
      }

      // Proveedores
      if (Array.isArray(parsed?.proveedores)) {
        this.proveedores = parsed.proveedores.map((p: any) => ({
          ...p,
          fechaUltimaCompra: p?.fechaUltimaCompra ? new Date(p.fechaUltimaCompra) : new Date(),
        }));
      }

      // Productos
      if (Array.isArray(parsed?.productos)) {
        this.productos = parsed.productos.map((p: any) => ({
          ...p,
          fechaUltimaCompra: p.fechaUltimaCompra ? new Date(p.fechaUltimaCompra) : new Date(),
          fechaUltimaVenta: p.fechaUltimaVenta ? new Date(p.fechaUltimaVenta) : undefined,
          lotes: Array.isArray(p.lotes)
            ? p.lotes.map((l: any) => ({
                ...l,
                fechaEntrada: l.fechaEntrada ? new Date(l.fechaEntrada) : new Date(),
              }))
            : [],
        }));

        // Defaults / migración
        for (const p of this.productos) {
          if (typeof (p as any).activo !== 'boolean') {
            (p as any).activo = true;
          }
          this.asegurarDefaultsUnidades(p);
        }
      }

      // Movimientos
      if (Array.isArray(parsed?.movimientos)) {
        this.movimientos = parsed.movimientos.map((m: any) => ({
          ...m,
          fecha: m?.fecha ? new Date(m.fecha) : new Date(),
        }));
      }

      // Mapping descripción -> productoId
      if (parsed?.descToProductoId && typeof parsed.descToProductoId === 'object') {
        this.descToProductoId = parsed.descToProductoId;
      }

      // Pendientes
      if (Array.isArray(parsed?.ventasPendientes)) {
        this.ventasPendientes = parsed.ventasPendientes;
      }

      if (Array.isArray(parsed?.comprasPendientes)) {
        this.comprasPendientes = parsed.comprasPendientes;
      }

      if (parsed?.ultimaImportacionCompra && typeof parsed.ultimaImportacionCompra === 'object') {
        const docRefs: string[] = Array.isArray(parsed.ultimaImportacionCompra?.docRefs)
          ? parsed.ultimaImportacionCompra.docRefs.map((x: any) => String(x)).map((x: string) => x.trim()).filter(Boolean)
          : (parsed.ultimaImportacionCompra?.docRef ? [String(parsed.ultimaImportacionCompra.docRef).trim()].filter(Boolean) : []);
        const at = Number(parsed.ultimaImportacionCompra?.at) || 0;
        const productosCreados = Array.isArray(parsed.ultimaImportacionCompra?.productosCreados)
          ? parsed.ultimaImportacionCompra.productosCreados.map((x: any) => String(x)).filter(Boolean)
          : [];
        if (docRefs.length > 0) this.ultimaImportacionCompra = { docRefs, at, productosCreados };
      }
    } catch {
      // Si falla el parseo, ignorar y empezar limpio
    }
  }

  private persistirEnStorage(): void {
    try {
      const payload = {
        version: 1,
        savedAt: new Date().toISOString(),
        config: this.config,
        proveedores: this.proveedores,
        productos: this.productos,
        movimientos: this.movimientos,
        descToProductoId: this.descToProductoId,
        ventasPendientes: this.ventasPendientes,
        comprasPendientes: this.comprasPendientes,
        ultimaImportacionCompra: this.ultimaImportacionCompra,
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  private recomputarProductoDesdeLotes(producto: Producto): void {
    const lotes = Array.isArray(producto.lotes) ? producto.lotes : [];
    const existencias = lotes.reduce((acc, l) => acc + (Number(l.cantidad) || 0), 0);
    const valor = lotes.reduce((acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.costoUnitario) || 0), 0);
    producto.existenciasTotales = existencias;
    producto.costoPromedio = existencias > 0 ? valor / existencias : 0;
    producto.precioSugerido = producto.costoPromedio * (1 + (this.config?.margenSugerido || 0));
    // Limpiar lotes vacíos
    producto.lotes = lotes.filter((l) => (Number(l.cantidad) || 0) > 0);
  }

  // Getters
  getProductos(): Producto[] {
    return this.productos;
  }

  importarCatalogoProductosJSON(json: any): { creados: number; actualizados: number; omitidos: number } {
    const rawList: any[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.productos)
        ? json.productos
        : [];

    let creados = 0;
    let actualizados = 0;
    let omitidos = 0;

    for (const item of rawList) {
      if (!item) {
        omitidos += 1;
        continue;
      }

      const descripcion = (item.descripcion || item.description || '').toString().trim();
      if (!descripcion) {
        omitidos += 1;
        continue;
      }

      const categoria = (item.categoria || item.category || 'Varios').toString().trim() || 'Varios';
      const codigo = (item.codigo || item.code || '').toString().trim();
      const codigoPrincipal = (item.codigoPrincipal || item.codigo_principal || item.primaryCode || '').toString().trim();

      let producto =
        (item.id ? this.getProductoById(String(item.id)) : null) ||
        (codigo ? this.findProductoByCodigo(codigo) : null) ||
        (codigoPrincipal ? this.findProductoByCodigo(codigoPrincipal) : null) ||
        this.productos.find((p) => (p.descripcion || '').toString().trim().toLowerCase() === descripcion.toLowerCase()) ||
        null;

      if (!producto) {
        // Crear nuevo producto sin afectar Kardex
        producto = {
          id: this.generarId(),
          descripcion: descripcion.toUpperCase(),
          categoria,
          activo: typeof item.activo === 'boolean' ? item.activo : true,
          codigo: codigo || generarCodigoProducto(categoria, this.productos.map((p) => p.codigo || '')),
          codigoPrincipal: codigoPrincipal || undefined,
          unidadBase: (item.unidadBase || item.unidad_base || 'UNIDAD').toString().trim().toUpperCase() || 'UNIDAD',
          presentaciones: Array.isArray(item.presentaciones)
            ? item.presentaciones
                .map((x: any) => ({
                  nombre: (x?.nombre || x?.name || '').toString().trim().toUpperCase(),
                  factor: Number(x?.factor ?? x?.factorConversion ?? x?.qty ?? 0),
                }))
                .filter((x: any) => x.nombre && Number.isFinite(x.factor) && x.factor > 0)
            : [{ nombre: 'UNIDAD', factor: 1 }],
          presentacionesPendientes: Array.isArray(item.presentacionesPendientes) ? item.presentacionesPendientes : [],
          existenciasTotales: 0,
          costoPromedio: 0,
          precioSugerido: Number(item.precioSugerido ?? item.precio ?? item.price ?? 0) || 0,
          lotes: [],
          proveedores: [],
          fechaUltimaCompra: new Date(),
          fechaUltimaVenta: undefined,
          esFavorito: Boolean(item.esFavorito ?? item.favorito ?? false),
          gestionarInventario: typeof item.gestionarInventario === 'boolean' ? item.gestionarInventario : true,
          palabrasClave: extraerPalabrasClave(descripcion),
          variantes: Array.isArray(item.variantes) ? item.variantes : [],
        };

        this.asegurarDefaultsUnidades(producto);
        this.productos.push(producto);
        creados += 1;
        continue;
      }

      // Actualizar maestro SIN tocar existencias/lotes/movimientos
      producto.descripcion = descripcion.toUpperCase();
      producto.categoria = categoria;
      if (codigo) producto.codigo = codigo;
      if (codigoPrincipal) producto.codigoPrincipal = codigoPrincipal;
      if (typeof item.activo === 'boolean') producto.activo = item.activo;
      if (typeof item.gestionarInventario === 'boolean') producto.gestionarInventario = item.gestionarInventario;
      if (typeof (item.esFavorito ?? item.favorito) === 'boolean') producto.esFavorito = Boolean(item.esFavorito ?? item.favorito);

      const unidadBase = (item.unidadBase || item.unidad_base || '').toString().trim();
      if (unidadBase) producto.unidadBase = unidadBase.toUpperCase();

      if (Array.isArray(item.presentaciones) && item.presentaciones.length > 0) {
        const pres = item.presentaciones
          .map((x: any) => ({
            nombre: (x?.nombre || x?.name || '').toString().trim().toUpperCase(),
            factor: Number(x?.factor ?? x?.factorConversion ?? 0),
          }))
          .filter((x: any) => x.nombre && Number.isFinite(x.factor) && x.factor > 0);
        if (pres.length > 0) producto.presentaciones = pres;
      }

      const precio = Number(item.precioSugerido ?? item.precio ?? item.price);
      if (Number.isFinite(precio)) producto.precioSugerido = precio;

      this.asegurarDefaultsUnidades(producto);
      actualizados += 1;
    }

    this.persistirEnStorage();
    return { creados, actualizados, omitidos };
  }

  getProveedores(): Proveedor[] {
    return this.proveedores;
  }

  getConfig(): ConfiguracionInventario {
    return this.config;
  }

  getVentasPendientes(): VentaPendiente[] {
    return this.ventasPendientes;
  }

  getComprasPendientes(): CompraPendiente[] {
    return this.comprasPendientes;
  }

  findProductoByCodigo(codigo: string): Producto | null {
    const code = (codigo || '').toString().trim().toLowerCase();
    if (!code) return null;
    if (!this.productos || !Array.isArray(this.productos)) return null;
    return (
      this.productos.find((p) => (p.codigoPrincipal || '').toString().trim().toLowerCase() === code) ||
      this.productos.find((p) => (p.codigo || '').toString().trim().toLowerCase() === code) ||
      null
    );
  }

  sugerirProductosPorDescripcion(descripcion: string, umbral: number, max: number = 5): Array<{ producto: Producto; score: number }> {
    const similares = buscarProductosSimilares(descripcion, this.productos, umbral);
    return similares
      .slice(0, max)
      .map((p) => ({ producto: p, score: calcularSimilitudAvanzada(descripcion, p.descripcion) }));
  }

  guardarMapeoDescripcionProducto(descripcion: string, productoId: string): void {
    const key = this.normalizarDescripcionKey(descripcion);
    this.descToProductoId[key] = productoId;
    this.persistirEnStorage();
  }

  async resolverCompraPendiente(pendienteId: string, productoId: string, recordar: boolean): Promise<void> {
    const idx = this.comprasPendientes.findIndex((p) => p.id === pendienteId);
    if (idx === -1) return;

    const pendiente = this.comprasPendientes[idx];
    const producto = this.productos.find((p) => p.id === productoId);
    if (!producto) throw new Error('Producto no encontrado');

    if (recordar) {
      const key = this.normalizarDescripcionKey(pendiente.descripcion);
      this.descToProductoId[key] = productoId;
    }

    // Asegurar defaults y aplicar entrada como lote + movimiento
    this.asegurarDefaultsUnidades(producto);
    const fechaEntrada = new Date(`${pendiente.fecha}T00:00:00`);

    const costoUnitarioBase = this.convertirCostoUnitarioAUnidadBase(
      Number(pendiente.costoUnitario) || 0,
      Number(pendiente.factorConversion) || 1
    );

    const lote: Lote = {
      id: this.generarId(),
      proveedorId: 'PENDIENTE',
      proveedorNombre: pendiente.proveedorNombre,
      cantidad: pendiente.cantidadBase,
      costoUnitario: costoUnitarioBase,
      fechaEntrada,
      codigoProveedor: pendiente.codigo,
      codigoHacienda: `${producto.id}-${(producto.lotes.length + 1).toString().padStart(3, '0')}`,
    };

    await this.añadirLoteProducto(producto.id, lote);

    await this.registrarMovimiento({
      productoId: producto.id,
      tipo: 'entrada',
      cantidad: pendiente.cantidadBase,
      unidad: pendiente.presentacion,
      cantidadOriginal: pendiente.cantidadOriginal,
      factorConversion: pendiente.factorConversion,
      costoUnitario: costoUnitarioBase,
      loteId: lote.id,
      documentoReferencia: pendiente.docRef,
      fecha: fechaEntrada,
      proveedorNombre: pendiente.proveedorNombre,
    });

    this.comprasPendientes.splice(idx, 1);
    this.persistirEnStorage();
  }

  async crearProductoYAplicarCompraPendiente(pendienteId: string, recordar: boolean = true): Promise<string> {
    const idx = this.comprasPendientes.findIndex((p) => p.id === pendienteId);
    if (idx === -1) throw new Error('Pendiente no encontrado');

    const pendiente = this.comprasPendientes[idx];
    const categoria = detectarCategoria(pendiente.descripcion);
    const producto = await this.crearProducto({
      descripcion: pendiente.descripcion,
      categoria: categoria.nombre,
      codigoProveedor: (pendiente.codigo || '').trim() || undefined,
    });

    await this.resolverCompraPendiente(pendienteId, producto.id, recordar);
    return producto.id;
  }

  getProductoById(id: string): Producto | null {
    return this.productos.find((p) => p.id === id) || null;
  }

  getCodigoPreferidoProducto(producto: Producto): string {
    return (producto.codigoPrincipal || producto.codigo || '').toString().trim();
  }

  actualizarProducto(producto: Producto): void {
    const idx = this.productos.findIndex((p) => p.id === producto.id);
    if (idx === -1) return;
    this.asegurarDefaultsUnidades(producto);
    if (typeof (producto as any).activo !== 'boolean') {
      (producto as any).activo = true;
    }
    this.productos[idx] = producto;
    this.persistirEnStorage();
  }

  productoTieneHistorial(productoId: string): boolean {
    const id = (productoId || '').trim();
    if (!id) return false;
    const producto = this.productos.find((p) => p.id === id);
    if (!producto) return false;
    if (Array.isArray(producto.lotes) && producto.lotes.length > 0) return true;
    return this.movimientos.some((m) => m.productoId === id);
  }

  canEliminarProducto(productoId: string): boolean {
    return !this.productoTieneHistorial(productoId);
  }

  desactivarProducto(productoId: string): void {
    const id = (productoId || '').trim();
    if (!id) return;
    const producto = this.productos.find((p) => p.id === id);
    if (!producto) return;
    producto.activo = false;
    this.persistirEnStorage();
  }

  reactivarProducto(productoId: string): void {
    const id = (productoId || '').trim();
    if (!id) return;
    const producto = this.productos.find((p) => p.id === id);
    if (!producto) return;
    producto.activo = true;
    this.persistirEnStorage();
  }

  eliminarProducto(productoId: string): void {
    const id = (productoId || '').trim();
    if (!id) return;

    if (!this.canEliminarProducto(id)) {
      throw new Error('Producto con historial, solo se puede desactivar');
    }

    const idx = this.productos.findIndex((p) => p.id === id);
    if (idx === -1) return;

    this.productos.splice(idx, 1);

    // remover movimientos asociados
    this.movimientos = this.movimientos.filter((m) => m.productoId !== id);

    // remover mapeos descripción -> productoId
    for (const k of Object.keys(this.descToProductoId)) {
      if (this.descToProductoId[k] === id) delete this.descToProductoId[k];
    }

    // remover pendientes de ventas
    this.ventasPendientes = this.ventasPendientes.filter((p) => {
      const candidates = Array.isArray(p.candidates) ? p.candidates : [];
      return !candidates.some((c) => c.productoId === id);
    });

    // remover pendientes de compras
    this.comprasPendientes = this.comprasPendientes.filter((p) => {
      const candidates = Array.isArray(p.candidates) ? p.candidates : [];
      return !candidates.some((c) => c.productoId === id);
    });

    this.persistirEnStorage();
  }

  async registrarEntradaManual(params: {
    productoId: string;
    cantidad: number;
    costoUnitario?: number;
    fecha?: Date;
    documentoReferencia?: string;
    proveedorNombre?: string;
    unidad?: string;
  }): Promise<void> {
    const producto = this.productos.find((p) => p.id === params.productoId);
    if (!producto) throw new Error('Producto no encontrado');

    const cantidad = Number(params.cantidad) || 0;
    if (!cantidad || cantidad <= 0) throw new Error('Cantidad inválida');

    const fecha = params.fecha ? new Date(params.fecha) : new Date();
    const costoUnitario = typeof params.costoUnitario === 'number' ? params.costoUnitario : producto.costoPromedio;
    const proveedorNombre = (params.proveedorNombre || 'AJUSTE').toString().trim() || 'AJUSTE';

    const lote: Lote = {
      id: this.generarId(),
      proveedorId: 'MANUAL',
      proveedorNombre,
      cantidad,
      costoUnitario,
      fechaEntrada: fecha,
      codigoHacienda: `${producto.id}-${(producto.lotes.length + 1).toString().padStart(3, '0')}`,
    };

    await this.añadirLoteProducto(producto.id, lote);

    await this.registrarMovimiento({
      productoId: producto.id,
      tipo: 'entrada',
      cantidad,
      unidad: (params.unidad || 'UNIDAD').toString().trim().toUpperCase() || 'UNIDAD',
      costoUnitario,
      loteId: lote.id,
      documentoReferencia: (params.documentoReferencia || 'AJUSTE_ENTRADA').toString(),
      fecha,
      proveedorNombre,
    });
  }

  async registrarSalidaManual(params: {
    productoId: string;
    cantidad: number;
    fecha?: Date;
    documentoReferencia?: string;
    motivo?: string;
  }): Promise<void> {
    const producto = this.productos.find((p) => p.id === params.productoId);
    if (!producto) throw new Error('Producto no encontrado');

    const cantidad = Number(params.cantidad) || 0;
    if (!cantidad || cantidad <= 0) throw new Error('Cantidad inválida');

    if (producto.existenciasTotales < cantidad) throw new Error('Stock insuficiente');

    const fecha = params.fecha ? new Date(params.fecha) : new Date();

    const lotesUsados = this.seleccionarLotesParaSalida(producto, cantidad);
    for (const { lote, cantidadUsada } of lotesUsados) {
      lote.cantidad -= cantidadUsada;
      await this.registrarMovimiento({
        productoId: producto.id,
        tipo: 'salida',
        cantidad: cantidadUsada,
        loteId: lote.id,
        documentoReferencia: (params.documentoReferencia || 'AJUSTE_SALIDA').toString(),
        fecha,
        clienteNombre: (params.motivo || 'AJUSTE').toString(),
      });
    }

    producto.existenciasTotales -= cantidad;
    producto.lotes = producto.lotes.filter((l) => l.cantidad > 0);

    this.persistirEnStorage();
  }

  setUnidadBaseProducto(productoId: string, unidadBase: string): void {
    const p = this.productos.find((x) => x.id === productoId);
    if (!p) return;
    p.unidadBase = (unidadBase || '').trim() || 'UNIDAD';
    this.persistirEnStorage();
  }

  setPresentacionProducto(productoId: string, nombre: string, factor: number): void {
    const p = this.productos.find((x) => x.id === productoId);
    if (!p) return;
    const n = (nombre || '').trim().toUpperCase();
    if (!n) return;
    const f = Number(factor);
    if (!Number.isFinite(f) || f <= 0) return;

    if (!p.presentaciones) p.presentaciones = [];
    const idx = p.presentaciones.findIndex((x) => (x.nombre || '').toUpperCase() === n);
    if (idx >= 0) {
      p.presentaciones[idx] = { ...p.presentaciones[idx], nombre: n, factor: f };
    } else {
      p.presentaciones.push({ nombre: n, factor: f });
    }

    if (!p.presentacionesPendientes) p.presentacionesPendientes = [];
    p.presentacionesPendientes = p.presentacionesPendientes.filter((x) => (x || '').toUpperCase() !== n);

    this.persistirEnStorage();
  }

  private asegurarDefaultsUnidades(producto: Producto): void {
    if (!producto.unidadBase) producto.unidadBase = 'UNIDAD';
    if (!producto.presentaciones || producto.presentaciones.length === 0) {
      producto.presentaciones = [{ nombre: (producto.unidadBase || 'UNIDAD').toUpperCase(), factor: 1 }];
    }
    if (!producto.presentaciones.some((x) => (x.nombre || '').toUpperCase() === (producto.unidadBase || 'UNIDAD').toUpperCase())) {
      producto.presentaciones.push({ nombre: (producto.unidadBase || 'UNIDAD').toUpperCase(), factor: 1 });
    }
    if (!producto.presentacionesPendientes) producto.presentacionesPendientes = [];
  }

  private detectarPresentacionDesdeDescripcion(descripcion: string): string {
    const d = (descripcion || '').toUpperCase();
    if (!d) return 'UNIDAD';
    if (/(\bDOCENA\b|\b12\s*U\b)/.test(d)) return 'DOCENA';
    if (/(\bCAJA\b|\bCJ\b)/.test(d)) return 'CAJA';
    if (/(\bSACO\b|\bBULTO\b)/.test(d)) return 'SACO';
    if (/(\bPAQUETE\b|\bPQT\b)/.test(d)) return 'PAQUETE';
    if (/(\bBOLSA\b)/.test(d)) return 'BOLSA';
    if (/(\bBOTELLA\b)/.test(d)) return 'BOTELLA';
    return 'UNIDAD';
  }

  private obtenerFactorPresentacion(producto: Producto, presentacion: string): { factor: number; esPendiente: boolean } {
    this.asegurarDefaultsUnidades(producto);
    const p = (presentacion || '').trim().toUpperCase() || (producto.unidadBase || 'UNIDAD').toUpperCase();
    const found = producto.presentaciones?.find((x) => (x.nombre || '').toUpperCase() === p);
    if (found && Number(found.factor) > 0) return { factor: Number(found.factor), esPendiente: false };

    if (!producto.presentacionesPendientes) producto.presentacionesPendientes = [];
    if (!producto.presentacionesPendientes.includes(p) && p !== (producto.unidadBase || 'UNIDAD').toUpperCase()) {
      producto.presentacionesPendientes.push(p);
    }
    // default seguro: 1 (no bloquea, pero deja pendiente para corregir)
    return { factor: 1, esPendiente: true };
  }

  private convertirCostoUnitarioAUnidadBase(precioUnitarioPresentacion: number, factorConversion: number): number {
    const p = Number(precioUnitarioPresentacion) || 0;
    const f = Number(factorConversion) || 0;
    if (p <= 0) return 0;
    if (!Number.isFinite(f) || f <= 0) return p;
    // Si 1 CAJA = 12 UNIDADES, y precioUni viene por CAJA, el costo unitario en base es precioUni/12
    return p / f;
  }

  resolverVentaPendiente(pendienteId: string, productoId: string, recordar: boolean): void {
    const idx = this.ventasPendientes.findIndex((p) => p.id === pendienteId);
    if (idx === -1) return;
    const pendiente = this.ventasPendientes[idx];
    const producto = this.productos.find((p) => p.id === productoId);
    if (!producto) return;

    if (recordar) {
      const key = this.normalizarDescripcionKey(pendiente.descripcion);
      this.descToProductoId[key] = productoId;
    }

    // aplicar descuento ahora
    this.registrarVenta(productoId, pendiente.cantidad, pendiente.precioUni, pendiente.cliente, pendiente.docRef);

    this.ventasPendientes.splice(idx, 1);
    this.persistirEnStorage();
  }

  private normalizarDescripcionKey(descripcion: string): string {
    return normalizarDescripcion(descripcion || '');
  }

  /**
   * Aplica una venta desde un DTE generado para descontar inventario.
   * Esto permite mantener el inventario simplificado sincronizado con la facturación.
   */
  async aplicarVentaDesdeDTE(dte: VentaDTE): Promise<void> {
    const items = Array.isArray(dte?.cuerpoDocumento) ? dte.cuerpoDocumento : [];
    if (!items.length) return;

    const docRef = dte?.identificacion?.numeroControl || `VENTA:${new Date().toISOString().split('T')[0]}`;
    const cliente = dte?.receptor?.nombre || 'CLIENTE';

    let settingsFallback = true;
    let autoThreshold = 0.9;
    let askThreshold = 0.75;
    try {
      const s = loadSettings();
      settingsFallback = s.inventoryFallbackByDescription !== false;
      autoThreshold = typeof s.inventoryAutoMatchThreshold === 'number' ? s.inventoryAutoMatchThreshold : autoThreshold;
      askThreshold = typeof s.inventoryAskMatchThreshold === 'number' ? s.inventoryAskMatchThreshold : askThreshold;
    } catch {
      // ignore
    }

    for (const item of items) {
      // Solo bienes (tipoItem 1) y solo si trae código
      if (item?.tipoItem !== 1) continue;

      const qty = Number(item.cantidad) || 0;
      const precioUni = Number(item.precioUni) || 0;
      if (!qty || qty <= 0) continue;

      const codigo = (item?.codigo || '').trim();
      if (codigo) {
        const producto = this.findProductoByCodigo(codigo);
        if (!producto) continue;
        await this.registrarVenta(producto.id, qty, precioUni, cliente, docRef);
        continue;
      }

      if (!settingsFallback) continue;

      const descKey = this.normalizarDescripcionKey(item.descripcion);
      const mappedId = this.descToProductoId[descKey];
      if (mappedId) {
        const producto = this.productos.find((p) => p.id === mappedId);
        if (producto) {
          await this.registrarVenta(producto.id, qty, precioUni, cliente, docRef);
          continue;
        }
      }

      // Buscar similares por descripción
      const similares = buscarProductosSimilares(item.descripcion, this.productos, askThreshold);
      if (similares.length === 0) {
        this.ventasPendientes.push({
          id: this.generarId(),
          createdAt: new Date().toISOString(),
          docRef,
          cliente,
          descripcion: item.descripcion,
          cantidad: qty,
          precioUni,
          candidates: [],
        });
        this.persistirEnStorage();
        continue;
      }

      const top = similares[0];

      // Si hay un solo candidato o la similitud es suficientemente alta, auto-match
      if (similares.length === 1 || calcularSimilitudAvanzada(item.descripcion, top.descripcion) >= autoThreshold) {
        // recordar
        this.descToProductoId[descKey] = top.id;
        await this.registrarVenta(top.id, qty, precioUni, cliente, docRef);
        this.persistirEnStorage();
        continue;
      }

      // Ambiguo: dejar pendiente con candidatos
      const candidates = similares.slice(0, 5).map((p) => ({
        productoId: p.id,
        descripcion: p.descripcion,
        score: calcularSimilitudAvanzada(item.descripcion, p.descripcion),
      }));
      this.ventasPendientes.push({
        id: this.generarId(),
        createdAt: new Date().toISOString(),
        docRef,
        cliente,
        descripcion: item.descripcion,
        cantidad: qty,
        precioUni,
        candidates,
      });
      this.persistirEnStorage();
    }
  }

  setConfig(config: Partial<ConfiguracionInventario>): void {
    this.config = { ...this.config, ...config };
    this.persistirEnStorage();
  }

  /**
   * Importa compras desde un JSON de DTE
   */
  async importarComprasJSON(json: CompraJSON): Promise<{
    productosCreados: number;
    productosActualizados: number;
    totalImportado: number;
    pendientes: number;
    docRef: string;
    productosCreadosIds: string[];
  }> {
    let productosCreados = 0;
    let productosActualizados = 0;
    const totalImportado = json.cuerpoDocumento.length;
    let pendientes = 0;
    const productosCreadosIds: string[] = [];
    const docRef = (json?.identificacion?.numeroControl || '').toString().trim();

    // Obtener o crear proveedor
    const proveedor = await this.obtenerOCrearProveedor({
      nombre: json.emisor.nombre,
      nrc: json.emisor.nrc,
      nit: json.emisor.nit,
      categoria: json.emisor.descActividad
    });

    // Procesar cada item
    for (const item of json.cuerpoDocumento) {
      const resultado = await this.procesarItemCompra(item, json, proveedor);

      if (resultado.esPendiente) {
        pendientes += 1;
        continue;
      }
      
      if (resultado.esNuevo) {
        productosCreados++;
        if (resultado.producto?.id) productosCreadosIds.push(resultado.producto.id);
      } else {
        productosActualizados++;
      }
    }

    // Registrar última importación de compra (para permitir revertir)
    this.ultimaImportacionCompra = {
      docRefs: docRef ? [docRef] : [],
      at: Date.now(),
      productosCreados: productosCreadosIds,
    };
    this.persistirEnStorage();

    return {
      productosCreados,
      productosActualizados,
      totalImportado,
      pendientes,
      docRef,
      productosCreadosIds,
    };
  }

  async importarComprasJSONConConfirmacion(
    json: CompraJSON,
    confirmaciones: Array<{
      itemIndex: number;
      accion: 'crear' | 'actualizar' | 'asociar' | 'omitir';
      productoId?: string;
      recordar?: boolean;
      categoria?: string;
      factorConversion?: number;
    }>
  ): Promise<{
    productosCreados: number;
    productosActualizados: number;
    totalImportado: number;
    pendientes: number;
    docRef: string;
    productosCreadosIds: string[];
  }> {
    const totalImportado = Array.isArray(json?.cuerpoDocumento) ? json.cuerpoDocumento.length : 0;
    const docRef = (json?.identificacion?.numeroControl || '').toString().trim();
    const productosCreadosIds: string[] = [];
    let productosCreados = 0;
    let productosActualizados = 0;
    let pendientes = 0;

    const confirmByIndex = new Map<
      number,
      { accion: string; productoId?: string; recordar?: boolean; categoria?: string; factorConversion?: number }
    >();
    for (const c of confirmaciones || []) {
      const idx = Number(c?.itemIndex);
      if (!Number.isFinite(idx) || idx < 0) continue;
      confirmByIndex.set(idx, {
        accion: c.accion,
        productoId: c.productoId,
        recordar: c.recordar,
        categoria: c.categoria,
        factorConversion: c.factorConversion,
      });
    }

    // Obtener o crear proveedor
    const proveedor = await this.obtenerOCrearProveedor({
      nombre: json.emisor.nombre,
      nrc: json.emisor.nrc,
      nit: json.emisor.nit,
      categoria: json.emisor.descActividad,
    });

    for (let i = 0; i < totalImportado; i++) {
      const item = json.cuerpoDocumento[i];
      const conf = confirmByIndex.get(i);

      // Si no está confirmado explícitamente, se omite
      if (!conf || conf.accion === 'omitir') {
        continue;
      }

      // Seguridad: solo bienes
      if (item?.tipoItem !== 1) {
        continue;
      }

      // Caso: asociar/actualizar forzado a un producto específico
      if ((conf.accion === 'asociar' || conf.accion === 'actualizar') && conf.productoId) {
        const producto = this.getProductoById(conf.productoId);
        if (!producto) {
          // si el producto no existe, dejar que el flujo normal decida (creación/pendiente)
          const r = await this.procesarItemCompra(item, json, proveedor);
          if (r.esPendiente) {
            pendientes += 1;
            continue;
          }
          if (r.esNuevo) {
            productosCreados += 1;
            if (r.producto?.id) productosCreadosIds.push(r.producto.id);
          } else {
            productosActualizados += 1;
          }
          continue;
        }

        const descKey = this.normalizarDescripcionKey(item.descripcion);
        if (conf.recordar !== false) {
          this.descToProductoId[descKey] = producto.id;
        }

        // Asegurar defaults y aplicar entrada como lote + movimiento
        this.asegurarDefaultsUnidades(producto);
        const presentacion = this.detectarPresentacionDesdeDescripcion(item.descripcion);

        if (conf.factorConversion && Number(conf.factorConversion) > 0) {
          this.setPresentacionProducto(producto.id, presentacion, Number(conf.factorConversion));
        }

        const { factor } = this.obtenerFactorPresentacion(producto, presentacion);
        const cantidadBase = Number(item.cantidad) * Number(factor);
        const costoUnitarioBase = this.convertirCostoUnitarioAUnidadBase(Number(item.precioUni) || 0, factor);

        const lote: Lote = {
          id: this.generarId(),
          proveedorId: proveedor.id,
          proveedorNombre: proveedor.nombre,
          cantidad: cantidadBase,
          costoUnitario: costoUnitarioBase,
          fechaEntrada: new Date(json.identificacion.fecEmi),
          codigoProveedor: item.codigo,
          codigoHacienda: `${producto.id}-${(producto.lotes.length + 1).toString().padStart(3, '0')}`,
        };

        await this.añadirLoteProducto(producto.id, lote);

        proveedor.fechaUltimaCompra = new Date(json.identificacion.fecEmi);
        proveedor.totalCompras += (Number(item.cantidad) || 0) * (Number(item.precioUni) || 0);

        await this.registrarMovimiento({
          productoId: producto.id,
          tipo: 'entrada',
          cantidad: cantidadBase,
          unidad: presentacion,
          cantidadOriginal: Number(item.cantidad) || 0,
          factorConversion: factor,
          costoUnitario: costoUnitarioBase,
          loteId: lote.id,
          documentoReferencia: json.identificacion.numeroControl,
          fecha: new Date(json.identificacion.fecEmi),
          proveedorNombre: proveedor.nombre,
        });

        productosActualizados += 1;
        this.persistirEnStorage();
        continue;
      }

      // Caso: crear con categoría seleccionada (si aplica)
      if (conf.accion === 'crear') {
        const categoria = (conf.categoria || '').toString().trim() || detectarCategoria(item.descripcion).nombre;
        const producto = await this.crearProducto({
          descripcion: item.descripcion,
          categoria,
          codigoProveedor: (item.codigo || '').trim() || undefined,
        });
        productosCreados += 1;
        productosCreadosIds.push(producto.id);

        // Aplicar factor si se definió en el modal
        const presentacion = this.detectarPresentacionDesdeDescripcion(item.descripcion);
        if (conf.factorConversion && Number(conf.factorConversion) > 0) {
          this.setPresentacionProducto(producto.id, presentacion, Number(conf.factorConversion));
        }

        // recordar mapeo descripción -> producto
        const descKey = this.normalizarDescripcionKey(item.descripcion);
        if (conf.recordar !== false) {
          this.descToProductoId[descKey] = producto.id;
        }

        const { factor } = this.obtenerFactorPresentacion(producto, presentacion);
        const cantidadBase = Number(item.cantidad) * Number(factor);
        const costoUnitarioBase = this.convertirCostoUnitarioAUnidadBase(Number(item.precioUni) || 0, factor);

        const lote: Lote = {
          id: this.generarId(),
          proveedorId: proveedor.id,
          proveedorNombre: proveedor.nombre,
          cantidad: cantidadBase,
          costoUnitario: costoUnitarioBase,
          fechaEntrada: new Date(json.identificacion.fecEmi),
          codigoProveedor: item.codigo,
          codigoHacienda: `${producto.id}-${(producto.lotes.length + 1).toString().padStart(3, '0')}`,
        };

        await this.añadirLoteProducto(producto.id, lote);

        proveedor.fechaUltimaCompra = new Date(json.identificacion.fecEmi);
        proveedor.totalCompras += (Number(item.cantidad) || 0) * (Number(item.precioUni) || 0);

        await this.registrarMovimiento({
          productoId: producto.id,
          tipo: 'entrada',
          cantidad: cantidadBase,
          unidad: presentacion,
          cantidadOriginal: Number(item.cantidad) || 0,
          factorConversion: factor,
          costoUnitario: costoUnitarioBase,
          loteId: lote.id,
          documentoReferencia: json.identificacion.numeroControl,
          fecha: new Date(json.identificacion.fecEmi),
          proveedorNombre: proveedor.nombre,
        });

        this.persistirEnStorage();
        continue;
      }

      // fallback: comportamiento original
      const resultado = await this.procesarItemCompra(item, json, proveedor);
      if (resultado.esPendiente) {
        pendientes += 1;
        continue;
      }
      if (resultado.esNuevo) {
        productosCreados += 1;
        if (resultado.producto?.id) productosCreadosIds.push(resultado.producto.id);
      } else {
        productosActualizados += 1;
      }
    }

    this.persistirEnStorage();

    return {
      productosCreados,
      productosActualizados,
      totalImportado,
      pendientes,
      docRef,
      productosCreadosIds,
    };
  }

  revertirUltimaImportacionCompras():
    | {
        ok: true;
        docRef: string;
        movimientosEliminados: number;
        lotesEliminados: number;
        productosAfectados: number;
        productosEliminados: number;
      }
    | { ok: false; message: string } {
    const docRefs = Array.isArray(this.ultimaImportacionCompra?.docRefs)
      ? this.ultimaImportacionCompra!.docRefs.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (docRefs.length === 0) return { ok: false, message: 'No hay importación de compras reciente para revertir' };

    const docRefSet = new Set(docRefs);
    const movimientosImport = this.movimientos.filter((m) => {
      if (m?.tipo !== 'entrada') return false;
      const ref = (m?.documentoReferencia || '').toString().trim();
      return docRefSet.has(ref);
    });
    if (movimientosImport.length === 0) {
      return { ok: false, message: 'No se encontraron movimientos de esa importación para revertir' };
    }

    const maxFecha = Math.max(...movimientosImport.map((m) => (m?.fecha ? new Date(m.fecha).getTime() : 0)));
    const productoIds = Array.from(new Set(movimientosImport.map((m) => m.productoId).filter(Boolean)));

    // Seguridad: bloquear si hay movimientos posteriores para esos productos
    for (const productoId of productoIds) {
      const posteriores = this.movimientos.some((m) => {
        if (m?.productoId !== productoId) return false;
        const t = m?.fecha ? new Date(m.fecha).getTime() : 0;
        if (t <= maxFecha) return false;
        const ref = (m?.documentoReferencia || '').toString().trim();
        return !docRefSet.has(ref);
      });
      if (posteriores) {
        return {
          ok: false,
          message: 'No se puede revertir porque existen movimientos posteriores (ventas/ajustes) para uno o más productos',
        };
      }
    }

    const loteIds = new Set(movimientosImport.map((m) => (m?.loteId || '').toString().trim()).filter(Boolean));

    const productosCreados = Array.isArray(this.ultimaImportacionCompra?.productosCreados)
      ? this.ultimaImportacionCompra!.productosCreados
      : [];

    // Eliminar movimientos
    this.movimientos = this.movimientos.filter((m) => {
      if (m?.tipo !== 'entrada') return true;
      const ref = (m?.documentoReferencia || '').toString().trim();
      return !docRefSet.has(ref);
    });

    // Eliminar lotes asociados y recalcular inventario de productos afectados
    let lotesEliminados = 0;
    for (const productoId of productoIds) {
      const producto = this.productos.find((p) => p.id === productoId);
      if (!producto) continue;
      const before = Array.isArray(producto.lotes) ? producto.lotes.length : 0;
      producto.lotes = (Array.isArray(producto.lotes) ? producto.lotes : []).filter((l) => !loteIds.has((l?.id || '').toString().trim()));
      const after = producto.lotes.length;
      lotesEliminados += Math.max(0, before - after);
      this.recomputarProductoDesdeLotes(producto);
    }

    // Limpiar compras pendientes asociadas a ese documento
    this.comprasPendientes = this.comprasPendientes.filter((p) => !docRefSet.has((p?.docRef || '').toString().trim()));

    // Auto-eliminar productos creados únicamente por la importación si quedan sin historial
    const eliminadosSet = new Set<string>();
    for (const pid of productosCreados) {
      const p = this.productos.find((x) => x.id === pid);
      if (!p) continue;
      const sinStock = (Number(p.existenciasTotales) || 0) === 0;
      const sinLotes = !Array.isArray(p.lotes) || p.lotes.length === 0;
      const sinMovs = !this.movimientos.some((m) => m.productoId === pid);
      if (sinStock && sinLotes && sinMovs) eliminadosSet.add(pid);
    }

    if (eliminadosSet.size > 0) {
      this.productos = this.productos.filter((p) => !eliminadosSet.has(p.id));
      for (const [k, v] of Object.entries(this.descToProductoId)) {
        if (eliminadosSet.has(String(v))) {
          delete this.descToProductoId[k];
        }
      }
    }

    this.ultimaImportacionCompra = undefined;
    this.persistirEnStorage();

    return {
      ok: true,
      docRef: docRefs[docRefs.length - 1] || docRefs[0] || 'BATCH',
      movimientosEliminados: movimientosImport.length,
      lotesEliminados,
      productosAfectados: productoIds.length,
      productosEliminados: eliminadosSet.size,
    };
  }

  /**
   * Procesa un item individual de compra
   */
  private async procesarItemCompra(
    item: ItemCompraJSON,
    json: CompraJSON,
    proveedor: Proveedor
  ): Promise<{ esNuevo: boolean; esPendiente: boolean; producto?: Producto }> {
    // Determinar umbrales de match
    let autoThreshold = 0.9;
    let askThreshold = 0.75;
    try {
      const s = loadSettings();
      autoThreshold = typeof s.inventoryAutoMatchThreshold === 'number' ? s.inventoryAutoMatchThreshold : autoThreshold;
      askThreshold = typeof s.inventoryAskMatchThreshold === 'number' ? s.inventoryAskMatchThreshold : askThreshold;
    } catch {
      // ignore
    }

    const codigoItem = (item.codigo || '').trim();
    const descKey = this.normalizarDescripcionKey(item.descripcion);
    
    let producto: Producto | undefined;
    let esNuevo = false;

    // 1) Match por código
    if (codigoItem) {
      const byCode = this.findProductoByCodigo(codigoItem);
      if (byCode) {
        producto = byCode;
      }
    }

    // 2) Match por mapeo recordado de descripción
    if (!producto) {
      const mappedId = this.descToProductoId[descKey];
      if (mappedId) {
        const found = this.productos.find((p) => p.id === mappedId);
        if (found) producto = found;
      }
    }

    // 3) Match por similitud (solo si alta confianza)
    if (!producto) {
      const similares = buscarProductosSimilares(item.descripcion, this.productos, askThreshold);

      if (similares.length > 0) {
        const top = similares[0];
        const scoreTop = calcularSimilitudAvanzada(item.descripcion, top.descripcion);

        if (similares.length === 1 && scoreTop >= askThreshold) {
          producto = top;
        } else if (scoreTop >= autoThreshold) {
          // recordar
          this.descToProductoId[descKey] = top.id;
          this.persistirEnStorage();
          producto = top;
        } else {
          // Ambiguo: dejar pendiente
          const candidates = similares.slice(0, 5).map((p) => ({
            productoId: p.id,
            descripcion: p.descripcion,
            score: calcularSimilitudAvanzada(item.descripcion, p.descripcion),
          }));

          const presentacion = this.detectarPresentacionDesdeDescripcion(item.descripcion);
          // Para pending, factor 1 (y se usa Pendientes de presentaciones si aplica)
          const qty = Number(item.cantidad) || 0;
          const factor = 1;
          this.comprasPendientes.push({
            id: this.generarId(),
            createdAt: new Date().toISOString(),
            docRef: json.identificacion.numeroControl,
            proveedorNombre: proveedor.nombre,
            fecha: json.identificacion.fecEmi,
            descripcion: item.descripcion,
            codigo: codigoItem,
            cantidadOriginal: qty,
            presentacion,
            factorConversion: factor,
            cantidadBase: qty * factor,
            costoUnitario: this.convertirCostoUnitarioAUnidadBase(Number(item.precioUni) || 0, factor),
            candidates,
          });
          this.persistirEnStorage();
          return { esNuevo: false, esPendiente: true };
        }
      }
    }

    // 4) Si no hubo match, crear producto (comportamiento anterior)
    if (!producto) {
      const categoria = detectarCategoria(item.descripcion);
      producto = await this.crearProducto({
        descripcion: item.descripcion,
        categoria: categoria.nombre,
        codigoProveedor: codigoItem,
      });
      esNuevo = true;
    } else {
      // Usar producto existente más similar
      // Actualizar si la nueva descripción es más específica
      if (item.descripcion.length > producto.descripcion.length) {
        if (!producto.variantes.includes(item.descripcion)) {
          producto.variantes.push(item.descripcion);
        }
      }

      // Actualizar código principal si es necesario
      if (!producto.codigoPrincipal && codigoItem) {
        producto.codigoPrincipal = codigoItem;
      }
    }

    this.asegurarDefaultsUnidades(producto);
    const presentacion = this.detectarPresentacionDesdeDescripcion(item.descripcion);
    const { factor } = this.obtenerFactorPresentacion(producto, presentacion);
    const cantidadBase = Number(item.cantidad) * Number(factor);
    const costoUnitarioBase = this.convertirCostoUnitarioAUnidadBase(Number(item.precioUni) || 0, factor);

    // Crear y añadir lote
    const lote: Lote = {
      id: this.generarId(),
      proveedorId: proveedor.id,
      proveedorNombre: proveedor.nombre,
      cantidad: cantidadBase,
      costoUnitario: costoUnitarioBase,
      fechaEntrada: new Date(json.identificacion.fecEmi),
      codigoProveedor: item.codigo,
      codigoHacienda: `${producto.id}-${(producto.lotes.length + 1).toString().padStart(3, '0')}`
    };

    await this.añadirLoteProducto(producto.id, lote);
    
    // Actualizar fecha de última compra del proveedor
    proveedor.fechaUltimaCompra = new Date(json.identificacion.fecEmi);
    proveedor.totalCompras += item.cantidad * item.precioUni;

    // Registrar movimiento
    await this.registrarMovimiento({
      productoId: producto.id,
      tipo: 'entrada',
      cantidad: cantidadBase,
      unidad: presentacion,
      cantidadOriginal: item.cantidad,
      factorConversion: factor,
      costoUnitario: costoUnitarioBase,
      loteId: lote.id,
      documentoReferencia: json.identificacion.numeroControl,
      fecha: new Date(json.identificacion.fecEmi),
      proveedorNombre: proveedor.nombre
    });

    return { esNuevo, esPendiente: false, producto };
  }

  /**
   * Crea un nuevo producto
   */
  async crearProducto(data: {
    descripcion: string;
    categoria: string;
    codigoProveedor?: string;
  }): Promise<Producto> {
    const codigo = generarCodigoProducto(data.categoria, this.productos.map(p => p.codigo || ''));

    const nuevoProducto: Producto = {
      id: this.generarId(),
      descripcion: data.descripcion.toUpperCase(),
      categoria: data.categoria,
      activo: true,
      codigo,
      codigoPrincipal: data.codigoProveedor,
      existenciasTotales: 0,
      costoPromedio: 0,
      precioSugerido: 0,
      unidadBase: 'UNIDAD',
      presentaciones: [{ nombre: 'UNIDAD', factor: 1 }],
      presentacionesPendientes: [],
      
      lotes: [],
      proveedores: [],
      fechaUltimaCompra: new Date(),
      esFavorito: false,
      gestionarInventario: true,
      
      palabrasClave: extraerPalabrasClave(data.descripcion),
      variantes: []
    };

    this.productos.push(nuevoProducto);
    this.persistirEnStorage();
    return nuevoProducto;
  }

  /**
   * Añade un lote a un producto y actualiza inventario
   */
  async añadirLoteProducto(productoId: string, lote: Lote): Promise<void> {
    const producto = this.productos.find(p => p.id === productoId);
    if (!producto) throw new Error('Producto no encontrado');

    // Añadir lote
    producto.lotes.push(lote);
    
    // Actualizar existencias
    producto.existenciasTotales += lote.cantidad;
    
    // Actualizar costo promedio
    const valorTotalAnterior = producto.existenciasTotales * producto.costoPromedio;
    const valorLote = lote.cantidad * lote.costoUnitario;
    const nuevoValorTotal = valorTotalAnterior + valorLote;
    
    if (producto.existenciasTotales > 0) {
      producto.costoPromedio = nuevoValorTotal / producto.existenciasTotales;
    }
    
    // Actualizar precio sugerido
    producto.precioSugerido = producto.costoPromedio * (1 + this.config.margenSugerido);
    
    // Actualizar lista de proveedores
    if (!producto.proveedores.includes(lote.proveedorNombre)) {
      producto.proveedores.push(lote.proveedorNombre);
    }
    
    // Actualizar fecha
    producto.fechaUltimaCompra = lote.fechaEntrada;

    this.persistirEnStorage();
  }

  /**
   * Registra una venta (salida de inventario)
   */
  async registrarVenta(
    productoId: string,
    cantidad: number,
    precioUnitario: number,
    clienteNombre: string,
    documentoReferencia: string
  ): Promise<void> {
    const producto = this.productos.find(p => p.id === productoId);
    if (!producto) throw new Error('Producto no encontrado');

    // Verificar stock
    if (!this.config.permitirVentaSinStock && producto.existenciasTotales < cantidad) {
      throw new Error('Stock insuficiente');
    }

    // Determinar qué lotes usar según método de costeo
    const lotesUsados = this.seleccionarLotesParaSalida(producto, cantidad);
    
    // Procesar salida de cada lote
    for (const { lote, cantidadUsada } of lotesUsados) {
      lote.cantidad -= cantidadUsada;
      
      // Registrar movimiento
      await this.registrarMovimiento({
        productoId: producto.id,
        tipo: 'salida',
        cantidad: cantidadUsada,
        precioUnitario,
        loteId: lote.id,
        documentoReferencia,
        fecha: new Date(),
        clienteNombre
      });
    }

    // Actualizar existencias del producto
    producto.existenciasTotales -= cantidad;
    producto.fechaUltimaVenta = new Date();

    // Limpiar lotes vacíos
    producto.lotes = producto.lotes.filter(l => l.cantidad > 0);

    this.persistirEnStorage();
  }

  /**
   * Selecciona lotes para salida según método de costeo
   */
  private seleccionarLotesParaSalida(
    producto: Producto,
    cantidad: number
  ): { lote: Lote; cantidadUsada: number }[] {
    const lotesOrdenados = [...producto.lotes];
    
    // Ordenar según método de costeo
    if (this.config.metodoCosteo === 'UEPS') {
      // Últimas entradas, primeras salidas
      lotesOrdenados.sort((a, b) => b.fechaEntrada.getTime() - a.fechaEntrada.getTime());
    } else if (this.config.metodoCosteo === 'PEPS') {
      // Primeras entradas, primeras salidas
      lotesOrdenados.sort((a, b) => a.fechaEntrada.getTime() - b.fechaEntrada.getTime());
    }
    // PROMEDIO no requiere orden específico

    const resultado: { lote: Lote; cantidadUsada: number }[] = [];
    let cantidadRestante = cantidad;

    for (const lote of lotesOrdenados) {
      if (cantidadRestante <= 0) break;
      
      const cantidadUsada = Math.min(lote.cantidad, cantidadRestante);
      resultado.push({ lote, cantidadUsada });
      cantidadRestante -= cantidadUsada;
    }

    return resultado;
  }

  /**
   * Obtiene o crea un proveedor
   */
  private async obtenerOCrearProveedor(data: {
    nombre: string;
    nrc?: string;
    nit?: string;
    categoria?: string;
  }): Promise<Proveedor> {
    let proveedor = this.proveedores.find(p => 
      p.nombre.toLowerCase() === data.nombre.toLowerCase()
    );

    if (!proveedor) {
      proveedor = {
        id: this.generarId(),
        nombre: data.nombre,
        nrc: data.nrc,
        nit: data.nit,
        categoria: data.categoria,
        fechaUltimaCompra: new Date(),
        totalCompras: 0
      };
      this.proveedores.push(proveedor);
      this.persistirEnStorage();
    }

    return proveedor;
  }

  /**
   * Registra un movimiento de inventario
   */
  private async registrarMovimiento(movimiento: Omit<MovimientoInventario, 'id'>): Promise<void> {
    this.movimientos.push({
      ...movimiento,
      id: this.generarId()
    });

    this.persistirEnStorage();
  }

  /**
   * Genera reporte de Kardex para un producto
   */
  generarReporteKardex(productoId: string): ReporteKardex | null {
    const producto = this.productos.find(p => p.id === productoId);
    if (!producto) return null;

    const movimientosProducto = this.movimientos
      .filter(m => m.productoId === productoId)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    const movimientosKardex: MovimientoKardex[] = [];
    let saldoCantidad = 0;
    let saldoValor = 0;

    for (const movimiento of movimientosProducto) {
      const costoUnitario = movimiento.costoUnitario || producto.costoPromedio;
      const valor = movimiento.cantidad * costoUnitario;

      if (movimiento.tipo === 'entrada') {
        saldoCantidad += movimiento.cantidad;
        saldoValor += valor;
      } else {
        saldoCantidad -= movimiento.cantidad;
        saldoValor -= valor;
      }

      movimientosKardex.push({
        fecha: movimiento.fecha,
        documento: movimiento.documentoReferencia,
        tipo: movimiento.tipo === 'entrada' ? 'ENTRADA' : 'SALIDA',
        cantidad: movimiento.cantidad,
        costoUnitario,
        valor,
        saldoCantidad,
        saldoValor
      });
    }

    return {
      productoId: producto.id,
      descripcion: producto.descripcion,
      codigo: producto.codigo || '',
      movimientos: movimientosKardex,
      saldoFinal: {
        cantidad: saldoCantidad,
        valor: saldoValor
      }
    };
  }

  /**
   * Genera resumen de inventario
   */
  generarResumenInventario(): ResumenInventario {
    const categorias: { [key: string]: { cantidad: number; valor: number; productos: number } } = {};
    let valorTotalInventario = 0;
    let productosBajoStock = 0;
    let sinInventario = 0;

    for (const producto of this.productos) {
      const valorProducto = producto.existenciasTotales * producto.costoPromedio;
      valorTotalInventario += valorProducto;

      // Contar por categoría
      if (!categorias[producto.categoria]) {
        categorias[producto.categoria] = { cantidad: 0, valor: 0, productos: 0 };
      }
      
      categorias[producto.categoria].cantidad += producto.existenciasTotales;
      categorias[producto.categoria].valor += valorProducto;
      categorias[producto.categoria].productos += 1;

      // Contear alertas de stock
      if (producto.existenciasTotales === 0) {
        sinInventario++;
      } else if (producto.existenciasTotales < this.config.alertaBajoStock) {
        productosBajoStock++;
      }
    }

    return {
      totalProductos: this.productos.length,
      totalCategorias: Object.keys(categorias).length,
      valorTotalInventario,
      productosBajoStock,
      sinInventario,
      categorias
    };
  }

  /**
   * Busca productos para facturación
   */
  buscarProductosFacturacion(query: string): Producto[] {
    const productosBase = this.productos.filter((p) => p.activo !== false);
    if (!query) return productosBase.slice(0, 20);

    const queryLower = query.toLowerCase();
    const palabrasQuery = extraerPalabrasClave(query);

    return productosBase
      .map(producto => {
        let score = 0;

        // Coincidencia exacta en descripción
        if (producto.descripcion.toLowerCase().includes(queryLower)) {
          score += 100;
        }

        // Coincidencia en palabras clave
        const coincidenciasPalabras = palabrasQuery.filter(p => 
          producto.palabrasClave.includes(p)
        );
        score += coincidenciasPalabras.length * 20;

        // Coincidencia en código
        if (producto.codigo?.toLowerCase().includes(queryLower)) {
          score += 50;
        }
        if (producto.codigoPrincipal?.toLowerCase().includes(queryLower)) {
          score += 50;
        }

        // Si es favorito, bono extra
        if (producto.esFavorito) {
          score += 10;
        }

        return { producto, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(item => item.producto);
  }

  /**
   * Genera ID único
   */
  private generarId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Exporta inventario a CSV
   */
  exportarInventarioCSV(): string {
    const headers = [
      'Código',
      'Descripción',
      'Categoría',
      'Existencias',
      'Costo Promedio',
      'Precio Sugerido',
      'Valor Total',
      'Proveedores'
    ];

    const rows = this.productos.map(p => [
      p.codigo || '',
      p.descripcion,
      p.categoria,
      p.existenciasTotales.toString(),
      p.costoPromedio.toFixed(2),
      p.precioSugerido.toFixed(2),
      (p.existenciasTotales * p.costoPromedio).toFixed(2),
      p.proveedores.join('; ')
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

// Exportar instancia singleton
export const inventarioService = new InventarioService();
