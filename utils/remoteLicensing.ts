// Verificación remota del estado de licenciamiento
export interface RemoteLicensingConfig {
  enabled: boolean;
  announcement?: string;
  forceUserModeSelection?: boolean;
  minVersion?: string;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  dailyExportLimit?: number; // Límite configurable
}

export async function fetchLicensingConfig(): Promise<RemoteLicensingConfig> {
  try {
    // URL del endpoint de configuración desde variable de entorno
    const configUrl = import.meta.env.VITE_LICENSING_CONFIG_URL || '/api/licensing/config';
    
    const response = await fetch(configUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache por 5 minutos para no sobrecargar
      cache: 'force-cache'
    });

    if (!response.ok) {
      // Si el endpoint no existe, asumir licenciamiento desactivado
      if (response.status === 404) {
        return { enabled: false };
      }
      throw new Error('Error fetching licensing config');
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Si no es JSON (ej: HTML 404), asumir licenciamiento desactivado
      return { enabled: false };
    }

    const config = await response.json();
    return config;
  } catch (error) {
    console.error('Error fetching licensing config:', error);
    // En caso de error, usar configuración local por defecto
    return { enabled: false };
  }
}

// Verificar si el usuario debe seleccionar modo
export async function shouldShowUserModeSelection(): Promise<boolean> {
  // Si ya completó el setup, verificar configuración remota
  if (localStorage.getItem('dte_setup_completed')) {
    const remoteConfig = await fetchLicensingConfig();
    
    // Verificar modo mantenimiento
    if (remoteConfig.maintenanceMode) {
      // En modo mantenimiento, no mostrar selección de modo
      return false;
    }
    
    // Verificar versión mínima
    if (remoteConfig.minVersion) {
      const currentVersion = getCurrentAppVersion();
      if (currentVersion && compareVersions(currentVersion, remoteConfig.minVersion) < 0) {
        // Versión muy antigua, forzar actualización
        showForceUpdateModal(remoteConfig.minVersion);
        return false;
      }
    }
    
    if (!remoteConfig.enabled) {
      // Si el licenciamiento se desactivó, limpiar la notificación
      localStorage.removeItem('dte_licensing_notified');
      return false;
    }
    // Si está activado y no se había notificado
    if (remoteConfig.enabled && !localStorage.getItem('dte_licensing_notified')) {
      localStorage.setItem('dte_licensing_notified', 'true');
      return true;
    }
    return remoteConfig.enabled || remoteConfig.forceUserModeSelection;
  }

  // Primer uso - siempre mostrar setup
  return true;
}

// Obtener versión actual de la app
function getCurrentAppVersion(): string | null {
  // Puede venir de package.json o una variable de entorno
  return import.meta.env.VITE_APP_VERSION || '1.0.0';
}

// Comparar versiones (semver simple)
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    
    if (aPart < bPart) return -1;
    if (aPart > bPart) return 1;
  }
  
  return 0;
}

// Mostrar modal de actualización forzada
function showForceUpdateModal(minVersion: string) {
  // Guardar en localStorage para mostrar en App.tsx
  localStorage.setItem('dte_force_update', JSON.stringify({
    required: true,
    minVersion,
    message: `Por favor actualiza la app a la versión ${minVersion} para continuar.`
  }));

  // Notificar a la app actual (misma pestaña) para que reaccione inmediatamente
  try {
    window.dispatchEvent(new Event('dte-force-update'));
  } catch {
    // noop
  }
}
