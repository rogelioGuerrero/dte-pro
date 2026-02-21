import { DTEJSON } from './dteGenerator';

export type FacturaItemLike = {
  codigo?: string;
  descripcion?: string;
  factorConversion?: number;
};

 type Presentacion = { nombre: string; factor: number };

export const getPresentacionesForCodigo = (params: {
  codigo: string;
  findProductoByCodigo?: (codigo: string) => any;
 }): Presentacion[] => {
  const producto = params.findProductoByCodigo?.(params.codigo);
  if (!producto) return [{ nombre: 'UNIDAD', factor: 1 }];

  const base = (producto.unidadBase || 'UNIDAD').toUpperCase();
  const pres: Presentacion[] = Array.isArray(producto.presentaciones) && producto.presentaciones.length
    ? (producto.presentaciones as any[]).map((p: any) => ({
        nombre: (p.nombre || '').toUpperCase(),
        factor: Number(p.factor) || 1,
      }))
    : [{ nombre: base, factor: 1 }];

  if (!pres.some((x: Presentacion) => x.nombre === base)) pres.unshift({ nombre: base, factor: 1 });
  if (!pres.some((x: Presentacion) => x.nombre === 'UNIDAD')) pres.unshift({ nombre: 'UNIDAD', factor: 1 });

  const unique: Presentacion[] = [];
  for (const x of pres) {
    if (!x.nombre) continue;
    if (unique.some((u) => u.nombre === x.nombre)) continue;
    unique.push(x);
  }
  return unique;
};

export const buildInventarioDTEFromGenerated = (params: {
  dte: DTEJSON;
  items: FacturaItemLike[];
}): any => {
  const body = Array.isArray((params.dte as any)?.cuerpoDocumento) ? (params.dte as any).cuerpoDocumento : [];
  const used = new Array(params.items.length).fill(false);

  const converted = body.map((it: any) => {
    const codigo = ((it?.codigo || '') as string).toString().trim();
    const desc = ((it?.descripcion || '') as string).toString().trim();

    const matchIdx = params.items.findIndex((x, i) => {
      if (used[i]) return false;
      const c = (x.codigo || '').toString().trim();
      const d = (x.descripcion || '').toString().trim();
      if (codigo && c) return c === codigo;
      return d === desc;
    });

    const form = matchIdx >= 0 ? params.items[matchIdx] : undefined;
    if (matchIdx >= 0) used[matchIdx] = true;

    const factor = form ? Number(form.factorConversion) || 1 : 1;
    const cantidad = Number(it?.cantidad) || 0;
    return { ...it, cantidad: cantidad * factor };
  });

  return { ...params.dte, cuerpoDocumento: converted };
};

export const validateStockForInventario = async (params: {
  goods: Array<{ codigo: string; cantidad: number; descripcion?: string }>;
  findProductoByCodigo?: (codigo: string) => any;
}): Promise<{ ok: true } | { ok: false; message: string }> => {
  for (const g of params.goods) {
    const codigo = (g.codigo || '').trim();
    if (!codigo) continue;
    const producto = params.findProductoByCodigo?.(codigo) as any;
    if (!producto) continue;
    const qty = Number(g.cantidad) || 0;
    if (qty <= 0) continue;
    const stock = Number(producto.existenciasTotales) || 0;
    if (stock < qty) {
      return {
        ok: false,
        message: `Stock insuficiente para "${producto.descripcion}". Disponible: ${stock}, solicitado: ${qty}`,
      };
    }
  }
  return { ok: true };
};
