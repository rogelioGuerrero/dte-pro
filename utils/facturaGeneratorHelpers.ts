import { ProductData } from './productDb';

export const normalizeProductText = (value: string): string => {
  return (value || '').trim().replace(/\s+/g, ' ').toUpperCase();
};

export const resolveProductForDescription = (params: {
  raw: string;
  products: ProductData[];
}): ProductData | undefined => {
  const value = (params.raw || '').trim();
  if (!value) return undefined;

  const byCode = params.products.find((p) => p.codigo && p.codigo.trim() === value);
  if (byCode) return byCode;

  const needle = normalizeProductText(value);
  return params.products.find((p) => normalizeProductText(p.descripcion) === needle);
};
