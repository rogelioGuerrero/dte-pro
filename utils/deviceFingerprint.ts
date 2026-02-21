/**
 * Generador de fingerprint único para identificar la máquina/navegador
 * No depende de hardware específico, solo del entorno del navegador
 */

export class DeviceFingerprint {
  private static instance: DeviceFingerprint;
  private fingerprint: string | null = null;

  private constructor() {}

  static getInstance(): DeviceFingerprint {
    if (!DeviceFingerprint.instance) {
      DeviceFingerprint.instance = new DeviceFingerprint();
    }
    return DeviceFingerprint.instance;
  }

  /**
   * Genera un fingerprint único basado en características del navegador
   */
  async generateFingerprint(): Promise<string> {
    if (this.fingerprint) {
      return this.fingerprint;
    }

    try {
      // Recolectar características del navegador
      const components = await this.collectComponents();
      
      // Generar hash de las componentes
      const fingerprint = await this.hashComponents(components);
      
      // Cachear el resultado
      this.fingerprint = fingerprint;
      
      return fingerprint;
    } catch (error) {
      console.error('Error generando fingerprint:', error);
      // Fallback: generar un ID aleatorio (menos seguro pero funcional)
      return 'fallback-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }
  }

  /**
   * Recolecta componentes del navegador para el fingerprint
   */
  private async collectComponents(): Promise<string> {
    const components: string[] = [];

    // 1. User Agent
    components.push(navigator.userAgent);

    // 2. Idioma
    components.push(navigator.language);

    // 3. Plataforma
    components.push(navigator.platform);

    // 4. Resolución de pantalla
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

    // 5. Zona horaria
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // 6. Canvas fingerprint
    components.push(await this.getCanvasFingerprint());

    // 7. WebGL fingerprint
    components.push(this.getWebGLFingerprint());

    // 8. Fonts disponibles (versión simplificada)
    components.push(this.getFontsFingerprint());

    // 9. Plugins del navegador
    components.push(this.getPluginsFingerprint());

    // 10. Características de almacenamiento
    components.push(await this.getStorageFingerprint());

    return components.join('|');
  }

  /**
   * Genera fingerprint usando Canvas API
   */
  private async getCanvasFingerprint(): Promise<string> {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve('no-canvas');
          return;
        }

        // Dibujar texto y formas específicas
        canvas.width = 200;
        canvas.height = 50;
        
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        
        ctx.fillStyle = '#069';
        ctx.fillText('DTE App 📊', 2, 15);
        
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Fingerprint', 4, 35);
        
        // Convertir a base64
        const dataURL = canvas.toDataURL();
        resolve(dataURL.slice(-50)); // Tomar solo los últimos 50 caracteres
      } catch (error) {
        resolve('canvas-error');
      }
    });
  }

  /**
   * Genera fingerprint usando WebGL
   */
  private getWebGLFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        return 'no-webgl';
      }

      // Cast a WebGLRenderingContext para acceder a las extensiones
      const webglContext = gl as WebGLRenderingContext;
      const debugInfo = webglContext.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = webglContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = webglContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        return `${vendor}|${renderer}`;
      } else {
        return 'webgl-no-debug';
      }
    } catch (error) {
      return 'webgl-error';
    }
  }

  /**
   * Detecta fuentes disponibles (versión simplificada)
   */
  private getFontsFingerprint(): string {
    const testFonts = [
      'Arial', 'Verdana', 'Times New Roman', 'Courier New', 
      'Georgia', 'Palatino', 'Garamond', 'Comic Sans MS',
      'Trebuchet MS', 'Arial Black', 'Impact'
    ];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-font-canvas';

    const availableFonts: string[] = [];
    const testString = 'mmmmmmmmmmlli';

    // Medir con fuente por defecto
    ctx.font = '72px monospace';
    const defaultWidth = ctx.measureText(testString).width;

    // Probar cada fuente
    testFonts.forEach(font => {
      ctx.font = `72px '${font}', monospace`;
      const width = ctx.measureText(testString).width;
      if (width !== defaultWidth) {
        availableFonts.push(font);
      }
    });

    return availableFonts.join(',');
  }

  /**
   * Obtiene fingerprint de plugins del navegador
   */
  private getPluginsFingerprint(): string {
    const plugins = Array.from(navigator.plugins).map(p => p.name).sort();
    return plugins.join('|');
  }

  /**
   * Verifica capacidades de almacenamiento
   */
  private async getStorageFingerprint(): Promise<string> {
    const features: string[] = [];

    // Verificar localStorage
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      features.push('localStorage');
    } catch (e) {
      features.push('no-localStorage');
    }

    // Verificar sessionStorage
    try {
      sessionStorage.setItem('test', 'test');
      sessionStorage.removeItem('test');
      features.push('sessionStorage');
    } catch (e) {
      features.push('no-sessionStorage');
    }

    // Verificar IndexedDB
    if ('indexedDB' in window) {
      features.push('indexedDB');
    } else {
      features.push('no-indexedDB');
    }

    return features.join(',');
  }

  /**
   * Genera hash SHA-256 de las componentes
   */
  private async hashComponents(components: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(components);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      // Convertir a string base64url
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashBase64 = btoa(String.fromCharCode(...hashArray))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      return hashBase64.substring(0, 32); // Primeros 32 caracteres
    } catch (error) {
      // Fallback si crypto.subtle no está disponible
      return this.simpleHash(components);
    }
  }

  /**
   * Hash simple como fallback
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Verifica si el fingerprint actual coincide con uno guardado
   */
  async verifyFingerprint(storedFingerprint: string): Promise<boolean> {
    const currentFingerprint = await this.generateFingerprint();
    return currentFingerprint === storedFingerprint;
  }

  /**
   * Limpia el fingerprint caché (para forzar regeneración)
   */
  clearCache(): void {
    this.fingerprint = null;
  }
}

// Exportar instancia singleton
export const deviceFingerprint = DeviceFingerprint.getInstance();
