// PIN de administrador desde variable de entorno
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '';

export const validateAdminPin = (pin: string): boolean => {
  // Si no hay PIN configurado en producción, denegar acceso
  if (!ADMIN_PIN && !import.meta.env.DEV) {
    return false;
  }
  
  // En desarrollo sin PIN, permitir acceso para facilitar pruebas
  if (!ADMIN_PIN && import.meta.env.DEV) {
    return true;
  }
  
  return pin === ADMIN_PIN;
};

// Verificar si hay PIN configurado
export const hasAdminPin = (): boolean => {
  return !!ADMIN_PIN;
};
