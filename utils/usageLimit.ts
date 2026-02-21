import { licenseValidator } from './licenseValidator';
import { getUserModeConfig } from './userMode';
import { fetchLicensingConfig } from './remoteLicensing';

const STORAGE_KEY = 'dte_daily_export_limit';

interface DailyUsage {
  date: string;
  count: number;
}

const getTodayString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const readUsage = (): DailyUsage | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyUsage;
  } catch {
    return null;
  }
};

const writeUsage = (usage: DailyUsage) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // ignore quota or other errors
  }
};

export const consumeExportSlot = async (): Promise<{ allowed: boolean; remaining: number; message?: string }> => {
  // Verificar si el licenciamiento está activado remotamente
  const licensingConfig = await fetchLicensingConfig();
  if (!licensingConfig.enabled) {
    return { allowed: true, remaining: -1 }; // Siempre permitido, ilimitado
  }

  // Verificar modo mantenimiento
  if (licensingConfig.maintenanceMode) {
    return { 
      allowed: false, 
      remaining: 0, 
      message: licensingConfig.maintenanceMessage || 'La aplicación está en mantenimiento.' 
    };
  }

  // Obtener modo de usuario
  const userMode = getUserModeConfig();
  
  // Verificar si tiene licencia válida
  const hasLicense = await licenseValidator.hasValidLicense();
  
  // Si no tiene licencia, usar límite gratuito según modo
  if (!hasLicense) {
    const maxPerDay = licensingConfig.dailyExportLimit || 5; // Usar límite desde servidor
    const today = getTodayString();
    const current = readUsage();

    let usage: DailyUsage;
    if (!current || current.date !== today) {
      usage = { date: today, count: 0 };
    } else {
      usage = current;
    }

    if (usage.count >= maxPerDay) {
      const actionType = userMode.mode === 'negocio' ? 'facturar' : 'exportar';
      return {
        allowed: false,
        remaining: 0,
        message: `Has alcanzado el límite gratuito de ${maxPerDay} ${actionType === 'facturar' ? 'facturas' : 'exportaciones'} por día.`
      };
    }

    usage.count += 1;
    writeUsage(usage);

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('dte-usage-updated'));
    }

    return { allowed: true, remaining: maxPerDay - usage.count };
  }

  // Si tiene licencia, verificar sus límites
  const canExport = await licenseValidator.canExport();
  if (!canExport) {
    const remainingExports = await licenseValidator.getRemainingExports();
    return {
      allowed: false,
      remaining: Math.max(0, remainingExports),
      message: remainingExports > 0 
        ? `Has alcanzado el límite de exportaciones de tu licencia por hoy. Restantes: ${remainingExports}`
        : 'Has alcanzado el límite de exportaciones de tu licencia por hoy.'
    };
  }

  // Registrar exportación para la licencia
  licenseValidator.registerExport();
  const remainingExports = await licenseValidator.getRemainingExports();

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('dte-usage-updated'));
  }

  return { 
    allowed: true, 
    remaining: remainingExports === -1 ? 999 : remainingExports // -1 = ilimitado
  };
};

export const getUsageInfo = async (): Promise<{ count: number; remaining: number; max: number; hasLicense: boolean }> => {
  // Verificar si el licenciamiento está activado remotamente
  const licensingConfig = await fetchLicensingConfig();
  if (!licensingConfig.enabled) {
    return { count: 0, remaining: -1, max: -1, hasLicense: true }; // Ilimitado
  }

  const hasLicense = await licenseValidator.hasValidLicense();
  
  if (!hasLicense) {
    const maxPerDay = licensingConfig.dailyExportLimit || 5; // Usar límite desde servidor
    const today = getTodayString();
    const current = readUsage();

    let usage: DailyUsage;
    if (!current || current.date !== today) {
      usage = { date: today, count: 0 };
    } else {
      usage = current;
    }

    return {
      count: usage.count,
      remaining: maxPerDay - usage.count,
      max: maxPerDay,
      hasLicense: false
    };
  }

  // Si tiene licencia, obtener sus límites
  const remainingExports = await licenseValidator.getRemainingExports();
  const maxExports = remainingExports === -1 ? -1 : (await licenseValidator.getCurrentLicense())?.maxExports || -1;
  const today = getTodayString();
  const current = readUsage();

  let usage: DailyUsage;
  if (!current || current.date !== today) {
    usage = { date: today, count: 0 };
  } else {
    usage = current;
  }

  return {
    count: usage.count,
    remaining: remainingExports,
    max: maxExports,
    hasLicense: true
  };
};
