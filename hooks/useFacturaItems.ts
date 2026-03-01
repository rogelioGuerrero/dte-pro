import { useState, useCallback } from 'react';
import { redondear } from '../utils/dteGenerator';
import { ProductData } from '../utils/productDb';
import { resolveProductForDescription } from '../utils/facturaGeneratorHelpers';

export interface ItemForm {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadVenta: string;
  factorConversion: number;
  precioUni: number;
  precioUniRaw?: string;
  tipoItem: number;
  uniMedida: number;
  esExento: boolean;
  cargosNoBase: number;
  tributoCodigo?: string | null;
}

interface UseFacturaItemsParams {
  defaultItem: ItemForm;
  tipoDocumento: string;
  products: ProductData[];
}

export function useFacturaItems({ defaultItem, tipoDocumento, products }: UseFacturaItemsParams) {
  const [items, setItems] = useState<ItemForm[]>([{ ...defaultItem }]);

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, { ...defaultItem }]);
  }, [defaultItem]);

  const handleRemoveItem = useCallback((index: number) => {
    setItems((prev) => {
      if (prev.length === 1) return [{ ...defaultItem }];
      return prev.filter((_, i) => i !== index);
    });
  }, [defaultItem]);

  const handleItemChange = useCallback((index: number, field: keyof ItemForm, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }, []);

  const applyProductToItem = useCallback((index: number, p: ProductData, tipoDoc: string = tipoDocumento) => {
    setItems((prev) => {
      if (!prev[index]) return prev;
      const precioAplicar = tipoDoc === '01' ? redondear(p.precioUni * 1.13, 8) : p.precioUni;
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        codigo: p.codigo,
        descripcion: p.descripcion,
        unidadVenta: 'UNIDAD',
        factorConversion: 1,
        precioUni: precioAplicar,
        uniMedida: p.uniMedida,
        tipoItem: p.tipoItem,
      };
      return copy;
    });
  }, [tipoDocumento]);

  const handleItemDescriptionBlur = useCallback((index: number, tipoDoc: string = tipoDocumento) => {
    setItems((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const found = resolveProductForDescription({ raw: current.descripcion, products });
      if (!found) return prev;
      const precioAplicar = tipoDoc === '01' ? redondear(found.precioUni * 1.13, 8) : found.precioUni;
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        codigo: found.codigo,
        descripcion: found.descripcion,
        precioUni: precioAplicar,
        uniMedida: found.uniMedida,
        tipoItem: found.tipoItem,
      };
      return copy;
    });
  }, [products, tipoDocumento]);

  const handlePrecioUniChange = useCallback((index: number, val: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], precioUniRaw: val };
      return copy;
    });
  }, []);

  const handlePrecioUniBlur = useCallback((index: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const val = copy[index].precioUniRaw;
      if (val !== undefined && val !== '') {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          copy[index].precioUni = num;
        }
      }
      delete copy[index].precioUniRaw;
      return copy;
    });
  }, []);

  return {
    items,
    setItems,
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    applyProductToItem,
    handleItemDescriptionBlur,
    handlePrecioUniChange,
    handlePrecioUniBlur,
  };
}
