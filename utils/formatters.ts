// Utilidades de formato y cálculos básicos
export const generarUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
};

export const generarNumeroControl = (
  tipoDte: string,
  correlativo: number,
  codEstableMH: string | null,
  codPuntoVentaMH: string | null
): string => {
  const tipoDoc = tipoDte.padStart(2, '0');
  const corr = correlativo.toString().padStart(15, '0');

  const establecimiento = (codEstableMH || 'M001').padEnd(4, '0').slice(0, 4);
  const puntoVenta = (codPuntoVentaMH || 'P001').padEnd(4, '0').slice(0, 4);
  const segmentoMedio = `${establecimiento}${puntoVenta}`;

  return `DTE-${tipoDoc}-${segmentoMedio}-${corr}`;
};

export const redondear = (valor: number, decimales: number = 2): number => {
  const factor = Math.pow(10, decimales);
  const rounded = Math.round((valor + Number.EPSILON) * factor) / factor;
  return Number(rounded.toFixed(decimales));
};

export const numeroALetras = (num: number): string => {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE'];

  const entero = Math.floor(num);
  const centavos = Math.round((num - entero) * 100);

  if (entero === 0) return `CERO DÓLARES CON ${centavos.toString().padStart(2, '0')}/100 USD`;

  let resultado = '';

  if (entero >= 1000) {
    const miles = Math.floor(entero / 1000);
    resultado += miles === 1 ? 'MIL ' : `${unidades[miles]} MIL `;
  }

  const resto = entero % 1000;
  if (resto >= 100) {
    const centenas = Math.floor(resto / 100);
    if (centenas === 1 && resto % 100 === 0) {
      resultado += 'CIEN ';
    } else {
      const centenasTexto = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
      resultado += centenasTexto[centenas] + ' ';
    }
  }

  const decenaUnidad = resto % 100;
  if (decenaUnidad > 0) {
    if (decenaUnidad < 10) {
      resultado += unidades[decenaUnidad];
    } else if (decenaUnidad < 16) {
      resultado += especiales[decenaUnidad - 10];
    } else if (decenaUnidad < 20) {
      resultado += 'DIECI' + unidades[decenaUnidad - 10].toLowerCase();
    } else {
      const d = Math.floor(decenaUnidad / 10);
      const u = decenaUnidad % 10;
      if (u === 0) {
        resultado += decenas[d];
      } else if (d === 2) {
        resultado += 'VEINTI' + unidades[u].toLowerCase();
      } else {
        resultado += decenas[d] + ' Y ' + unidades[u];
      }
    }
  }

  const moneda = entero === 1 ? 'DÓLAR' : 'DÓLARES';
  return `${resultado.trim()} ${moneda} CON ${centavos.toString().padStart(2, '0')}/100 USD`;
};

export const obtenerFechaActual = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

export const obtenerHoraActual = (): string => {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/El_Salvador',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
};
