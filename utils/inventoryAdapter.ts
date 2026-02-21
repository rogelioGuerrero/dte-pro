import { Producto } from '../types/inventario';
import { ProductData } from './productDb';
import { unidadesMedida } from '../catalogos/unidadesMedida';

/**
 * Maps an inventory product (Producto) to a billing product (ProductData).
 */
export const mapInventoryToProductData = (p: Producto): ProductData => {
  // Find unit code
  const unitName = (p.unidadBase || 'Unidad').toLowerCase();
  
  // Try to find exact match or match by abbreviation
  const unit = unidadesMedida.find(
    u => u.descripcion.toLowerCase() === unitName || u.abreviatura.toLowerCase() === unitName
  );
  
  // Use inventory ID as key if possible, or a fallback
  const key = `INV:${p.id}`;

  // Determine code
  const codigo = p.codigoPrincipal || p.codigo || '';

  return {
    // id is left undefined as it comes from IDB autoincrement usually, 
    // but for UI purposes key is used.
    key: key, 
    codigo: codigo,
    descripcion: p.descripcion,
    uniMedida: unit ? unit.codigo : 59, // Default to 59 (Unidad)
    tipoItem: 1, // Inventory items are typically Goods (1)
    precioUni: p.precioSugerido || 0,
    timestamp: Date.now(),
    stockMin: 0, // Not strictly used in billing UI
    favorite: p.esFavorito,
  };
};

/**
 * Merges products from ProductDB and InventoryService, prioritizing InventoryService
 * for price/description updates if codes match, or appending if new.
 */
export const mergeProducts = (
  dbProducts: ProductData[], 
  inventoryProducts: Producto[]
): ProductData[] => {
  const merged = new Map<string, ProductData>();

  // 1. Add DB products first
  for (const p of dbProducts) {
    // Normalize code for key
    const codeKey = p.codigo ? p.codigo.trim().toUpperCase() : `NOCODE:${p.key}`;
    merged.set(codeKey, p);
  }

  // 2. Add/Merge Inventory products
  for (const invP of inventoryProducts) {
    if (!invP.activo) continue; // Skip inactive products

    const mapped = mapInventoryToProductData(invP);
    const codeKey = mapped.codigo ? mapped.codigo.trim().toUpperCase() : `NOCODE:${mapped.key}`;

    const existing = merged.get(codeKey);
    if (existing) {
      // If it exists, we might want to update it with inventory data
      // assuming inventory is the "master" for price/stock.
      merged.set(codeKey, {
        ...existing,
        // Override fields that should come from inventory
        descripcion: mapped.descripcion,
        precioUni: mapped.precioUni,
        uniMedida: mapped.uniMedida,
        // Keep ID from DB if it exists so we don't break things relying on it?
        // But ProductData from DB has id. Mapped doesn't.
      });
    } else {
      merged.set(codeKey, mapped);
    }
  }

  return Array.from(merged.values());
};
