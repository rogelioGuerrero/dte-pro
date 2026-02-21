import { Producto, CategoriaAuto } from '../../types/inventario';

// Palabras a ignorar en la detección de similitud
const STOP_WORDS = [
  'de', 'la', 'el', 'en', 'para', 'con', 'por', 'y', 'o', 'del', 'los', 'las',
  'un', 'una', 'unos', 'unas', 'al', 'lo', 'le', 'les', 'mi', 'su', 'nuestro',
  'a', 'ante', 'bajo', 'cabe', 'con', 'contra', 'de', 'desde', 'durante', 'en',
  'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'sin', 'so',
  'sobre', 'tras', 'vs', 'the', 'and', 'or', 'for', 'to', 'in', 'on', 'at'
];

// Categorías predefinidas con palabras clave
export const CATEGORIAS_PREDEFINIDAS: CategoriaAuto[] = [
  {
    nombre: 'Eléctricos',
    palabrasClave: ['toma', 'adaptador', 'polarizado', 'contacto', 'electrónico', 'interruptor', 'socket', 'enchufe', 'cable'],
    icono: '⚡'
  },
  {
    nombre: 'Cocina',
    palabrasClave: ['espatula', 'bowl', 'chef', 'graft', 'cuchara', 'cuchillo', 'sartén', 'olla', 'bandeja'],
    icono: '🍳'
  },
  {
    nombre: 'Limpieza',
    palabrasClave: ['limpiador', 'limpia', 'trapeador', 'escoba', 'detergente', 'jabón', 'desinfectante'],
    icono: '🧹'
  },
  {
    nombre: 'Herramientas',
    palabrasClave: ['llave', 'destornillador', 'pinza', 'taladro', 'sierra', 'martillo', 'alicate'],
    icono: '🔧'
  },
  {
    nombre: 'Ferretería',
    palabrasClave: ['tornillo', 'tuerca', 'arandela', 'clavo', 'perno', 'ancla', 'tarugo'],
    icono: '🔩'
  },
  {
    nombre: 'Pintura',
    palabrasClave: ['pintura', 'brocha', 'rodillo', 'sellador', 'imprimación', 'thinner'],
    icono: '🎨'
  },
  {
    nombre: 'Fontanería',
    palabrasClave: ['tubo', 'codo', 'te', 'reducción', 'válvula', 'grifo', 'manguera', 'conexión'],
    icono: '🚰'
  },
  {
    nombre: 'Iluminación',
    palabrasClave: ['foco', 'lámpara', 'bombillo', 'led', 'luz', 'reflectores', 'dicroica'],
    icono: '💡'
  },
  {
    nombre: 'Oficina',
    palabrasClave: ['papel', 'cuaderno', 'lapicero', 'bolígrafo', 'carpeta', 'archivador', 'silla', 'escritorio'],
    icono: '📎'
  },
  {
    nombre: 'Electrónica',
    palabrasClave: ['batería', 'cargador', 'usb', 'cable', 'conector', 'adaptador', 'auricular'],
    icono: '📱'
  },
  {
    nombre: 'Construcción',
    palabrasClave: ['cemento', 'arena', 'bloque', 'ladrillo', 'varilla', 'malla', 'mezcla'],
    icono: '🏗️'
  },
  {
    nombre: 'Varios',
    palabrasClave: [],
    icono: '📦'
  }
];

/**
 * Extrae palabras clave de un texto, eliminando stop words y caracteres especiales
 */
export const extraerPalabrasClave = (texto: string): string[] => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s]/g, ' ') // Reemplazar caracteres no alfanuméricos por espacio
    .split(/\s+/)
    .filter(palabra => 
      palabra.length > 2 && 
      !STOP_WORDS.includes(palabra) &&
      !/^\d+$/.test(palabra) // Excluir números puros
    )
    .filter((palabra, index, arr) => arr.indexOf(palabra) === index); // Eliminar duplicados
};

/**
 * Calcula la similitud entre dos textos usando el coeficiente de Jaccard
 */
export const calcularSimilitudJaccard = (texto1: string, texto2: string): number => {
  const palabras1 = extraerPalabrasClave(texto1);
  const palabras2 = extraerPalabrasClave(texto2);
  
  if (palabras1.length === 0 && palabras2.length === 0) return 1;
  if (palabras1.length === 0 || palabras2.length === 0) return 0;
  
  const interseccion = palabras1.filter(p => palabras2.includes(p));
  const union = [...new Set([...palabras1, ...palabras2])];
  
  return interseccion.length / union.length;
};

/**
 * Calcula similitud considerando tanto palabras clave como estructura
 */
export const calcularSimilitudAvanzada = (texto1: string, texto2: string): number => {
  // Similitud de Jaccard para palabras clave
  const similitudJaccard = calcularSimilitudJaccard(texto1, texto2);
  
  // Similitud por longitud (penalizar diferencias extremas)
  const len1 = texto1.length;
  const len2 = texto2.length;
  const similitudLongitud = 1 - Math.abs(len1 - len2) / Math.max(len1, len2);
  
  // Similitud por palabras iniciales (importante para códigos)
  const palabras1 = texto1.split(/\s+/);
  const palabras2 = texto2.split(/\s+/);
  let mismasIniciales = 0;
  const minLength = Math.min(palabras1.length, palabras2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (palabras1[i][0] === palabras2[i][0]) {
      mismasIniciales++;
    }
  }
  
  const similitudIniciales = minLength > 0 ? mismasIniciales / minLength : 0;
  
  // Combinar las similitudes con pesos
  return (similitudJaccard * 0.6) + (similitudLongitud * 0.2) + (similitudIniciales * 0.2);
};

/**
 * Detecta la categoría de un producto basado en su descripción
 */
export const detectarCategoria = (descripcion: string): { nombre: string; icono: string } => {
  const palabras = extraerPalabrasClave(descripcion);
  const desc = descripcion.toLowerCase();
  
  // Buscar coincidencias exactas primero
  for (const categoria of CATEGORIAS_PREDEFINIDAS) {
    if (categoria.palabrasClave.some(palabra => desc.includes(palabra))) {
      return { nombre: categoria.nombre, icono: categoria.icono || '📦' };
    }
  }
  
  // Buscar coincidencias parciales
  for (const categoria of CATEGORIAS_PREDEFINIDAS) {
    const coincidencias = categoria.palabrasClave.filter(palabra => 
      palabras.some(p => p.includes(palabra) || palabra.includes(p))
    );
    
    if (coincidencias.length > 0) {
      return { nombre: categoria.nombre, icono: categoria.icono || '📦' };
    }
  }
  
  return { nombre: 'Varios', icono: '📦' };
};

/**
 * Busca productos similares en una lista
 */
export const buscarProductosSimilares = (
  descripcion: string,
  productosExistentes: Producto[],
  umbral: number = 0.7
): Producto[] => {
  const similares: { producto: Producto; similitud: number }[] = [];
  
  for (const producto of productosExistentes) {
    // Comparar con la descripción principal
    const similitud1 = calcularSimilitudAvanzada(descripcion, producto.descripcion);
    
    // Comparar con variantes si existen
    let similitudMax = similitud1;
    if (producto.variantes.length > 0) {
      for (const variante of producto.variantes) {
        const similitudVariante = calcularSimilitudAvanzada(descripcion, variante);
        similitudMax = Math.max(similitudMax, similitudVariante);
      }
    }
    
    if (similitudMax >= umbral) {
      similares.push({ producto, similitud: similitudMax });
    }
  }
  
  // Ordenar por similitud descendente
  return similares
    .sort((a, b) => b.similitud - a.similitud)
    .map(item => item.producto);
};

/**
 * Genera un código de producto único
 */
export const generarCodigoProducto = (categoria: string, existentes: string[]): string => {
  const prefijo = categoria.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
  let correlativo = 1;
  
  while (true) {
    const codigo = `${prefijo}-${correlativo.toString().padStart(3, '0')}`;
    if (!existentes.includes(codigo)) {
      return codigo;
    }
    correlativo++;
  }
};

/**
 * Limpia y normaliza una descripción de producto
 */
export const normalizarDescripcion = (descripcion: string): string => {
  return descripcion
    .trim()
    .replace(/\s+/g, ' ') // Reducir múltiples espacios a uno
    .replace(/[^a-zA-Z0-9\s\-\/]/g, '') // Mantener solo alfanuméricos, espacios, guiones y slashes
    .toUpperCase();
};

/**
 * Extrae códigos o números de una descripción (ej: "419/1160")
 */
export const extraerCodigosDescripcion = (descripcion: string): string[] => {
  const codigos: string[] = [];
  
  // Extraer patrones como XXXX/XXXX o XXXX-XXXX
  const patron1 = descripcion.match(/\b\d{3,4}[-\/]\d{3,6}\b/g);
  if (patron1) codigos.push(...patron1);
  
  // Extraer números de 4+ dígitos consecutivos
  const patron2 = descripcion.match(/\b\d{4,}\b/g);
  if (patron2) codigos.push(...patron2);
  
  // Extraer códigos alfanuméricos (ej: "52016")
  const patron3 = descripcion.match(/\b[A-Z0-9]{4,}\b/g);
  if (patron3) codigos.push(...patron3);
  
  return [...new Set(codigos)]; // Eliminar duplicados
};
