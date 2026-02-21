import { useEffect, useState } from 'react';
import { getAllStock, InventoryStock } from '../utils/inventoryDb';

export const useStockByCode = (): {
  stockByCode: Record<string, InventoryStock>;
} => {
  const [stockByCode, setStockByCode] = useState<Record<string, InventoryStock>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const all = await getAllStock();
        const map: Record<string, InventoryStock> = {};
        for (const s of all) {
          const code = (s.productCode || '').trim();
          if (code) map[code] = s;
        }
        setStockByCode(map);
      } catch {
        // ignore
      }
    };

    load();
  }, []);

  return { stockByCode };
};
