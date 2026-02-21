import { openDB } from 'idb';
import { getProducts, ProductData } from './productDb';

export type InventoryMovementType = 'IN' | 'OUT' | 'ADJUST';
export type InventoryMovementSource = 'purchase_dte' | 'sales_dte' | 'manual';

export interface InventoryMovement {
  id?: number;
  uniqueKey: string;
  productKey: string;
  productCode: string;
  productDesc: string;
  date: string; // YYYY-MM-DD
  type: InventoryMovementType;
  qty: number;
  unitCost: number; // for IN/ADJUST
  source: InventoryMovementSource;
  docRef: string;
  timestamp: number;
  // Nuevos campos para inventario completo
  providerName?: string;
  providerNit?: string;
  lotDate?: string; // Fecha específica del lote
}

export interface InventoryStock {
  productKey: string;
  productCode: string;
  productDesc: string;
  onHand: number;
  avgCost: number;
  updatedAt: number;
}

const DB_NAME = 'dte-inventory-db';
const DB_VERSION = 1;
const MOVEMENTS_STORE = 'inventory_movements';
const STOCK_STORE = 'inventory_stock';

const buildProductKeyFromCode = (codigo: string): string => {
  return `COD:${(codigo || '').trim()}`;
};

const normalizeText = (value: string): string => {
  return (value || '').trim().replace(/\s+/g, ' ').toUpperCase();
};

const round = (val: number, decimals: number = 6): number => {
  const m = Math.pow(10, decimals);
  return Math.round(val * m) / m;
};

export const openInventoryDb = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(MOVEMENTS_STORE)) {
        const movements = db.createObjectStore(MOVEMENTS_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        movements.createIndex('timestamp', 'timestamp');
        movements.createIndex('productKey', 'productKey');
        movements.createIndex('docRef', 'docRef');
        movements.createIndex('uniqueKey', 'uniqueKey', { unique: true });
      }

      if (!db.objectStoreNames.contains(STOCK_STORE)) {
        const stock = db.createObjectStore(STOCK_STORE, {
          keyPath: 'productKey',
        });
        stock.createIndex('productCode', 'productCode');
        stock.createIndex('updatedAt', 'updatedAt');
      }
    },
  });
};

export const getAllStock = async (): Promise<InventoryStock[]> => {
  const db = await openInventoryDb();
  const all = await db.getAll(STOCK_STORE);
  return all.sort((a, b) => a.productCode.localeCompare(b.productCode));
};

export const clearInventory = async (): Promise<void> => {
  const db = await openInventoryDb();
  await db.clear(MOVEMENTS_STORE);
  await db.clear(STOCK_STORE);
};

type DTEItem = {
  codigo?: string | null;
  descripcion?: string;
  cantidad?: number;
  precioUni?: number;
};

type DTEParsed = {
  identificacion?: {
    fecEmi?: string;
    numeroControl?: string;
    codigoGeneracion?: string;
  };
  emisor?: {
    nombre?: string;
    nit?: string;
  };
  cuerpoDocumento?: DTEItem[];
};

export const applyPurchasesFromDTE = async (
  jsonString: string
): Promise<{ imported: number; skipped: number; missingCodes: number; resolvedByDesc: number; updatedStock: number }> => {
  const parsed = JSON.parse(jsonString);
  const dtes: DTEParsed[] = Array.isArray(parsed) ? parsed : [parsed];

  const products = await getProducts();
  const productByKey = new Map<string, ProductData>();
  for (const p of products) productByKey.set(p.key, p);

  const productByDesc = new Map<string, ProductData>();
  for (const p of products) {
    const k = normalizeText(p.descripcion);
    if (k && !productByDesc.has(k)) productByDesc.set(k, p);
  }

  const db = await openInventoryDb();
  let imported = 0;
  let skipped = 0;
  let missingCodes = 0;
  let resolvedByDesc = 0;
  let updatedStock = 0;

  for (const dte of dtes) {
    const docRef =
      (dte?.identificacion?.codigoGeneracion || dte?.identificacion?.numeroControl || '').trim();
    const date = (dte?.identificacion?.fecEmi || '').trim();

    // Extraer datos del proveedor (emisor en compras)
    const providerName = (dte?.emisor?.nombre || '').trim();
    const providerNit = (dte?.emisor?.nit || '').trim();

    const items = Array.isArray(dte?.cuerpoDocumento) ? dte.cuerpoDocumento : [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rawCodigo = (item?.codigo || '').toString().trim();
      const rawDesc = (item?.descripcion || '').toString().trim();
      const qty = typeof item?.cantidad === 'number' ? item.cantidad : 0;
      const unitCost = typeof item?.precioUni === 'number' ? item.precioUni : 0;

      let codigo = rawCodigo;
      let catalogProduct: ProductData | undefined;

      if (!codigo) {
        const byDesc = rawDesc ? productByDesc.get(normalizeText(rawDesc)) : undefined;
        if (byDesc?.codigo) {
          codigo = byDesc.codigo;
          catalogProduct = byDesc;
          resolvedByDesc++;
        } else {
          missingCodes++;
          continue;
        }
      }
      if (!qty || qty <= 0) {
        skipped++;
        continue;
      }

      const productKey = buildProductKeyFromCode(codigo);
      catalogProduct = catalogProduct || productByKey.get(productKey);
      const productDesc = (catalogProduct?.descripcion || rawDesc || '').toString().trim();

      const uniqueKey = `${docRef || 'NOREF'}|IN|${productKey}|${String(i)}`;

      const movement: Omit<InventoryMovement, 'id'> = {
        uniqueKey,
        productKey,
        productCode: codigo,
        productDesc,
        date: date || new Date().toISOString().split('T')[0],
        type: 'IN',
        qty: round(qty, 6),
        unitCost: round(unitCost, 6),
        source: 'purchase_dte',
        docRef: docRef || 'NOREF',
        timestamp: Date.now(),
        // Datos adicionales del inventario
        providerName: providerName || undefined,
        providerNit: providerNit || undefined,
        lotDate: date || undefined,
      };

      try {
        await db.add(MOVEMENTS_STORE, movement);
        imported++;
      } catch {
        skipped++;
        continue;
      }

      // Update stock (promedio ponderado)
      const current = (await db.get(STOCK_STORE, productKey)) as InventoryStock | undefined;
      const currentOnHand = current?.onHand ?? 0;
      const currentAvg = current?.avgCost ?? 0;

      const newOnHand = round(currentOnHand + movement.qty, 6);
      const newAvg =
        newOnHand <= 0
          ? 0
          : round(
              (currentOnHand * currentAvg + movement.qty * movement.unitCost) / newOnHand,
              6
            );

      const nextStock: InventoryStock = {
        productKey,
        productCode: codigo,
        productDesc,
        onHand: newOnHand,
        avgCost: newAvg,
        updatedAt: Date.now(),
      };

      await db.put(STOCK_STORE, nextStock);
      updatedStock++;
    }
  }

  return { imported, skipped, missingCodes, resolvedByDesc, updatedStock };
};

export const getStockForProductCode = async (codigo: string): Promise<InventoryStock | undefined> => {
  const key = buildProductKeyFromCode(codigo);
  const db = await openInventoryDb();
  return (await db.get(STOCK_STORE, key)) as InventoryStock | undefined;
};

export const validateStockForSale = async (
  items: Array<{ codigo?: string | null; cantidad: number; descripcion?: string }>
): Promise<{ ok: true } | { ok: false; message: string }> => {
  const db = await openInventoryDb();

  for (const item of items) {
    const codigo = (item.codigo || '').toString().trim();
    if (!codigo) {
      return { ok: false, message: 'Hay items sin código. Asigna un código en el catálogo.' };
    }

    const productKey = buildProductKeyFromCode(codigo);
    const stock = (await db.get(STOCK_STORE, productKey)) as InventoryStock | undefined;
    const onHand = stock?.onHand ?? 0;

    if (onHand < item.cantidad) {
      return {
        ok: false,
        message: `Sin stock para ${codigo}. Disponible: ${round(onHand, 2).toFixed(2)}`,
      };
    }
  }

  return { ok: true };
};

export const applySalesFromDTE = async (
  dte: {
    identificacion?: { fecEmi?: string; numeroControl?: string; codigoGeneracion?: string };
    cuerpoDocumento?: Array<{ codigo?: string | null; descripcion?: string; cantidad?: number }>;
  }
): Promise<{ applied: number; skipped: number }> => {
  const db = await openInventoryDb();

  const docRef =
    (dte?.identificacion?.codigoGeneracion || dte?.identificacion?.numeroControl || '').trim() || 'NOREF';
  const date = (dte?.identificacion?.fecEmi || '').trim() || new Date().toISOString().split('T')[0];
  const items = Array.isArray(dte?.cuerpoDocumento) ? dte.cuerpoDocumento : [];

  let applied = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const codigo = (item?.codigo || '').toString().trim();
    const qty = typeof item?.cantidad === 'number' ? item.cantidad : 0;
    const productDesc = (item?.descripcion || '').toString().trim();

    if (!codigo || !qty || qty <= 0) {
      skipped++;
      continue;
    }

    const productKey = buildProductKeyFromCode(codigo);
    const uniqueKey = `${docRef}|OUT|${productKey}|${String(i)}`;

    const movement: Omit<InventoryMovement, 'id'> = {
      uniqueKey,
      productKey,
      productCode: codigo,
      productDesc,
      date,
      type: 'OUT',
      qty: round(qty, 6),
      unitCost: 0,
      source: 'sales_dte',
      docRef,
      timestamp: Date.now(),
    };

    try {
      await db.add(MOVEMENTS_STORE, movement);
    } catch {
      skipped++;
      continue;
    }

    const current = (await db.get(STOCK_STORE, productKey)) as InventoryStock | undefined;
    const currentOnHand = current?.onHand ?? 0;
    const currentAvg = current?.avgCost ?? 0;

    const newOnHand = round(currentOnHand - movement.qty, 6);
    const nextStock: InventoryStock = {
      productKey,
      productCode: codigo,
      productDesc: current?.productDesc || productDesc,
      onHand: newOnHand,
      avgCost: currentAvg,
      updatedAt: Date.now(),
    };
    await db.put(STOCK_STORE, nextStock);
    applied++;
  }

  return { applied, skipped };
};

export const revertSalesFromDTE = async (dte: {
  identificacion?: { numeroControl?: string; codigoGeneracion?: string };
}): Promise<
  | { ok: true; docRef: string; removed: number; affectedProducts: number }
  | { ok: false; message: string }
> => {
  const db = await openInventoryDb();
  const docRef =
    (dte?.identificacion?.codigoGeneracion || dte?.identificacion?.numeroControl || '').trim() || '';
  if (!docRef) return { ok: false, message: 'No se pudo determinar docRef del DTE' };

  const moves = (await db.getAllFromIndex(MOVEMENTS_STORE, 'docRef', docRef)) as InventoryMovement[];
  const salesMoves = moves.filter((m) => m?.source === 'sales_dte');
  if (salesMoves.length === 0) {
    return { ok: false, message: 'No hay movimientos de venta para revertir' };
  }

  const affectedKeys = Array.from(new Set(salesMoves.map((m) => m.productKey).filter(Boolean)));
  const saleEndTs = Math.max(...salesMoves.map((m) => m.timestamp || 0));

  // Seguridad: no revertir si hay movimientos posteriores para productos afectados
  for (const productKey of affectedKeys) {
    const allForProduct = (await db.getAllFromIndex(MOVEMENTS_STORE, 'productKey', productKey)) as InventoryMovement[];
    const hasLater = allForProduct.some((m) => (m.timestamp || 0) > saleEndTs);
    if (hasLater) {
      return {
        ok: false,
        message:
          'No se puede revertir porque existen movimientos posteriores (compras/ajustes/otras ventas) para uno o más productos de ese DTE',
      };
    }
  }

  let removed = 0;
  const tx = db.transaction([MOVEMENTS_STORE, STOCK_STORE], 'readwrite');
  const docIdx = tx.objectStore(MOVEMENTS_STORE).index('docRef');
  let c = await docIdx.openCursor(IDBKeyRange.only(docRef));
  while (c) {
    const m = c.value as InventoryMovement;
    if (m?.source === 'sales_dte') {
      await c.delete();
      removed++;
    }
    c = await c.continue();
  }

  for (const productKey of affectedKeys) {
    const remaining = (await tx.objectStore(MOVEMENTS_STORE).index('productKey').getAll(productKey)) as InventoryMovement[];
    if (!remaining || remaining.length === 0) {
      await tx.objectStore(STOCK_STORE).delete(productKey);
      continue;
    }
    const nextStock = computeStockFromMovements(productKey, remaining);
    await tx.objectStore(STOCK_STORE).put(nextStock);
  }

  await tx.done;
  return { ok: true, docRef, removed, affectedProducts: affectedKeys.length };
};

export const applyManualAdjustment = async (params: {
  productCode: string;
  productDesc: string;
  date?: string; // YYYY-MM-DD
  direction: 'IN' | 'OUT';
  qty: number;
  unitCost?: number; // only used for IN to adjust avgCost
  reason?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> => {
  const codigo = (params.productCode || '').trim();
  const qty = typeof params.qty === 'number' ? params.qty : 0;
  const unitCost = typeof params.unitCost === 'number' ? params.unitCost : 0;

  if (!codigo) return { ok: false, message: 'Código requerido' };
  if (!qty || qty <= 0) return { ok: false, message: 'Cantidad inválida' };

  const productKey = buildProductKeyFromCode(codigo);
  const date = (params.date || '').trim() || new Date().toISOString().split('T')[0];
  const productDesc = (params.productDesc || '').trim();
  const reason = (params.reason || '').trim();
  const docRef = `MANUAL:${date}:${reason || 'AJUSTE'}`;
  const uniqueKey = `${docRef}|${params.direction}|${productKey}|${String(Date.now())}`;

  const db = await openInventoryDb();
  const current = (await db.get(STOCK_STORE, productKey)) as InventoryStock | undefined;
  const currentOnHand = current?.onHand ?? 0;
  const currentAvg = current?.avgCost ?? 0;

  if (params.direction === 'OUT' && currentOnHand < qty) {
    return { ok: false, message: `Sin stock para ${codigo}. Disponible: ${round(currentOnHand, 2).toFixed(2)}` };
  }

  const movement: Omit<InventoryMovement, 'id'> = {
    uniqueKey,
    productKey,
    productCode: codigo,
    productDesc: current?.productDesc || productDesc,
    date,
    type: params.direction,
    qty: round(qty, 6),
    unitCost: params.direction === 'IN' ? round(unitCost, 6) : 0,
    source: 'manual',
    docRef,
    timestamp: Date.now(),
  };

  try {
    await db.add(MOVEMENTS_STORE, movement);
  } catch {
    return { ok: false, message: 'No se pudo registrar el ajuste' };
  }

  if (params.direction === 'IN') {
    const newOnHand = round(currentOnHand + movement.qty, 6);
    const newAvg =
      newOnHand <= 0
        ? 0
        : round(
            (currentOnHand * currentAvg + movement.qty * movement.unitCost) / newOnHand,
            6
          );

    const nextStock: InventoryStock = {
      productKey,
      productCode: codigo,
      productDesc: current?.productDesc || productDesc,
      onHand: newOnHand,
      avgCost: newAvg,
      updatedAt: Date.now(),
    };
    await db.put(STOCK_STORE, nextStock);
    return { ok: true };
  }

  const newOnHand = round(currentOnHand - movement.qty, 6);
  const nextStock: InventoryStock = {
    productKey,
    productCode: codigo,
    productDesc: current?.productDesc || productDesc,
    onHand: newOnHand,
    avgCost: currentAvg,
    updatedAt: Date.now(),
  };
  await db.put(STOCK_STORE, nextStock);
  return { ok: true };
};

const computeStockFromMovements = (productKey: string, movements: InventoryMovement[]): InventoryStock => {
  const byTime = [...movements].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  let onHand = 0;
  let avgCost = 0;
  let productCode = '';
  let productDesc = '';

  for (const m of byTime) {
    productCode = m.productCode || productCode;
    productDesc = m.productDesc || productDesc;

    if (m.type === 'IN' || m.type === 'ADJUST') {
      const qty = round(m.qty || 0, 6);
      const cost = round(m.unitCost || 0, 6);
      const newOnHand = round(onHand + qty, 6);
      const newAvg =
        newOnHand <= 0
          ? 0
          : round((onHand * avgCost + qty * cost) / newOnHand, 6);
      onHand = newOnHand;
      avgCost = newAvg;
      continue;
    }

    if (m.type === 'OUT') {
      const qty = round(m.qty || 0, 6);
      onHand = round(onHand - qty, 6);
      continue;
    }
  }

  return {
    productKey,
    productCode,
    productDesc,
    onHand,
    avgCost,
    updatedAt: Date.now(),
  };
};

export const revertLastPurchaseImport = async (): Promise<
  | { ok: true; docRef: string; removed: number; affectedProducts: number }
  | { ok: false; message: string }
> => {
  const db = await openInventoryDb();

  // 1) Encontrar el último movimiento de compras
  let lastPurchase: InventoryMovement | undefined;
  let cursor = await db.transaction(MOVEMENTS_STORE, 'readonly').store.index('timestamp').openCursor(null, 'prev');
  while (cursor) {
    const m = cursor.value as InventoryMovement;
    if (m?.source === 'purchase_dte') {
      lastPurchase = m;
      break;
    }
    cursor = await cursor.continue();
  }

  if (!lastPurchase?.docRef) {
    return { ok: false, message: 'No hay importaciones de compras para revertir' };
  }

  const docRef = lastPurchase.docRef;

  // 2) Obtener todos los movimientos de esa importación y productos afectados
  const purchaseMoves = (await db.getAllFromIndex(MOVEMENTS_STORE, 'docRef', docRef)) as InventoryMovement[];
  const purchaseMovesFiltered = purchaseMoves.filter((m) => m?.source === 'purchase_dte');
  if (purchaseMovesFiltered.length === 0) {
    return { ok: false, message: 'No se encontraron movimientos de compras para revertir' };
  }

  const affectedKeys = Array.from(new Set(purchaseMovesFiltered.map((m) => m.productKey).filter(Boolean)));
  const importEndTs = Math.max(...purchaseMovesFiltered.map((m) => m.timestamp || 0));

  // 3) Validación de seguridad: no permitir si hay movimientos posteriores para los productos afectados
  for (const productKey of affectedKeys) {
    const allForProduct = (await db.getAllFromIndex(MOVEMENTS_STORE, 'productKey', productKey)) as InventoryMovement[];
    const hasLater = allForProduct.some((m) => (m.timestamp || 0) > importEndTs);
    if (hasLater) {
      return {
        ok: false,
        message:
          'No se puede revertir porque existen movimientos posteriores (ventas/ajustes) para uno o más productos de esa importación',
      };
    }
  }

  // 4) Eliminar movimientos de esa importación (solo source purchase_dte con ese docRef)
  let removed = 0;
  const tx = db.transaction([MOVEMENTS_STORE, STOCK_STORE], 'readwrite');
  const docIdx = tx.objectStore(MOVEMENTS_STORE).index('docRef');
  let c = await docIdx.openCursor(IDBKeyRange.only(docRef));
  while (c) {
    const m = c.value as InventoryMovement;
    if (m?.source === 'purchase_dte') {
      await c.delete();
      removed++;
    }
    c = await c.continue();
  }

  // 5) Recalcular stock para productos afectados
  for (const productKey of affectedKeys) {
    const remaining = (await tx.objectStore(MOVEMENTS_STORE).index('productKey').getAll(productKey)) as InventoryMovement[];
    if (!remaining || remaining.length === 0) {
      await tx.objectStore(STOCK_STORE).delete(productKey);
      continue;
    }
    const nextStock = computeStockFromMovements(productKey, remaining);
    await tx.objectStore(STOCK_STORE).put(nextStock);
  }

  await tx.done;
  return { ok: true, docRef, removed, affectedProducts: affectedKeys.length };
};
