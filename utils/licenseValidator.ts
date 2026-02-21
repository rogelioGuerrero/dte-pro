import { deviceFingerprint } from './deviceFingerprint';
import { fetchLicensingConfig } from './remoteLicensing';

// Llave pública en formato JWK (debe coincidir con la generada)
const PUBLIC_KEY_JWK = {
  "kty": "EC",
  "x": "NO4prs_ZYvQDusQNvXIBxrhRLY_LoaDfDwZD72cL37s",
  "y": "R3Vd4Ocv79YvQKxymPGzxPrXkHXHw3XNB140uhKWnfY",
  "crv": "secp256k1"
};

export interface LicenseData {
  id: string;
  userId: string;
  issuedAt: string;
  expiresAt: string;
  maxExports: number;
  features: string[];
  email?: string;
  companyName?: string;
  deviceFingerprint?: string; // Nuevo campo opcional para fingerprint
  version: string;
}

export interface License {
  data: LicenseData;
  signature: string;
}

export class LicenseValidator {
  private publicKey: CryptoKey | null = null;
  private cachedLicense: LicenseData | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Importar llave pública
      this.publicKey = await window.crypto.subtle.importKey(
        'jwk',
        PUBLIC_KEY_JWK,
        { name: 'ECDSA', namedCurve: 'secp256k1' },
        true,
        ['verify']
      );
    } catch (error) {
      console.error('Error importando llave pública:', error);
    }
  }

  /**
   * Verifica una licencia usando Web Crypto API
   */
  async verifyLicense(license: License): Promise<boolean> {
    if (!this.publicKey) {
      console.error('Llave pública no inicializada');
      return false;
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(license.data));
      
      // Convertir firma de base64 a ArrayBuffer
      const signature = Uint8Array.from(atob(license.signature), c => c.charCodeAt(0));
      
      // Verificar firma
      const isValid = await window.crypto.subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        this.publicKey,
        signature,
        data
      );

      if (isValid) {
        // Verificar expiración
        const now = new Date();
        const expiresAt = new Date(license.data.expiresAt);
        
        if (expiresAt < now) {
          console.warn('Licencia expirada');
          return false;
        }

        // Verificar fingerprint del dispositivo si está presente
        if (license.data.deviceFingerprint) {
          const fingerprintMatch = await deviceFingerprint.verifyFingerprint(license.data.deviceFingerprint);
          if (!fingerprintMatch) {
            console.warn('Licencia no válida para esta máquina');
            return false;
          }
        }

        // Guardar en caché
        this.cachedLicense = license.data;
        await this.saveLicenseToStorage(license);
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error verificando licencia:', error);
      return false;
    }
  }

  /**
   * Carga licencia desde almacenamiento local
   */
  async loadLicenseFromStorage(): Promise<LicenseData | null> {
    try {
      // Intentar cargar desde IndexedDB primero
      const stored = localStorage.getItem('dte-license');
      if (stored) {
        const license: License = JSON.parse(stored);
        
        // Verificar que aún sea válida
        if (await this.verifyLicense(license)) {
          return license.data;
        } else {
          // Si no es válida, limpiar
          localStorage.removeItem('dte-license');
          this.cachedLicense = null;
        }
      }
    } catch (error) {
      console.error('Error cargando licencia:', error);
    }

    return null;
  }

  /**
   * Guarda licencia en almacenamiento local
   */
  private async saveLicenseToStorage(license: License): Promise<void> {
    try {
      localStorage.setItem('dte-license', JSON.stringify(license));
    } catch (error) {
      console.error('Error guardando licencia:', error);
    }
  }

  /**
   * Verifica si el usuario tiene licencia válida
   */
  async hasValidLicense(): Promise<boolean> {
    // Verificar si el licenciamiento está desactivado remotamente
    const licensingConfig = await fetchLicensingConfig();
    if (!licensingConfig.enabled) {
      return true; // Si está desactivado, comportarse como si siempre tuviera licencia
    }

    if (this.cachedLicense) {
      // Verificar expiración
      const now = new Date();
      const expiresAt = new Date(this.cachedLicense.expiresAt);
      return expiresAt >= now;
    }

    // Intentar cargar desde almacenamiento
    const license = await this.loadLicenseFromStorage();
    return license !== null;
  }

  /**
   * Obtiene los datos de la licencia actual
   */
  getCurrentLicense(): LicenseData | null {
    return this.cachedLicense;
  }

  /**
   * Verifica si puede exportar (si hay límite)
   */
  async canExport(): Promise<boolean> {
    // Verificar si el licenciamiento está desactivado remotamente
    const licensingConfig = await fetchLicensingConfig();
    if (!licensingConfig.enabled) {
      return true; // Si está desactivado, siempre puede exportar
    }

    if (!this.cachedLicense) {
      return false;
    }

    // Si maxExports es -1, es ilimitado
    if (this.cachedLicense.maxExports === -1) {
      return true;
    }

    // Verificar límite diario
    const today = new Date().toDateString();
    const exportCount = parseInt(localStorage.getItem(`exports-${today}`) || '0');
    
    return exportCount < this.cachedLicense.maxExports;
  }

  /**
   * Registra una exportación
   */
  registerExport(): void {
    const today = new Date().toDateString();
    const currentCount = parseInt(localStorage.getItem(`exports-${today}`) || '0');
    localStorage.setItem(`exports-${today}`, (currentCount + 1).toString());
  }

  /**
   * Obtiene el número de exportaciones restantes hoy
   */
  async getRemainingExports(): Promise<number> {
    // Verificar si el licenciamiento está desactivado remotamente
    const licensingConfig = await fetchLicensingConfig();
    if (!licensingConfig.enabled) {
      return -1; // Ilimitado
    }

    if (!this.cachedLicense) {
      return 0;
    }

    if (this.cachedLicense.maxExports === -1) {
      return -1; // Ilimitado
    }

    const today = new Date().toDateString();
    const used = parseInt(localStorage.getItem(`exports-${today}`) || '0');
    return Math.max(0, this.cachedLicense.maxExports - used);
  }

  /**
   * Limpia la licencia (para logout o testing)
   */
  clearLicense(): void {
    localStorage.removeItem('dte-license');
    this.cachedLicense = null;
  }
}

// Instancia global
export const licenseValidator = new LicenseValidator();

// Función de conveniencia para usar en otros módulos
export async function checkLicense(): Promise<boolean> {
  return await licenseValidator.hasValidLicense();
}
