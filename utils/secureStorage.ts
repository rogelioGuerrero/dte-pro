// Almacenamiento seguro para certificados y credenciales
// El certificado .p12 y su contraseña se guardan en IndexedDB
// La seguridad depende del dispositivo (PIN/biometría del teléfono)

const DB_NAME = 'dte_secure_db';
const DB_VERSION = 2;
const STORE_NAME = 'credentials';

interface StoredCertificate {
  id: string;
  certificateBase64: string;
  password: string;
  savedAt: string;
}

// Abrir o crear la base de datos
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Eliminar store anterior si existe (migración)
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
  });
};

// Convertir ArrayBuffer a Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Convertir Base64 a ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// Guardar certificado (sin encriptación adicional - la seguridad es del dispositivo)
export const saveCertificate = async (
  certificateData: ArrayBuffer, 
  certificatePassword: string
): Promise<void> => {
  const db = await openDB();
  
  const storedCert: StoredCertificate = {
    id: 'certificate',
    certificateBase64: arrayBufferToBase64(certificateData),
    password: certificatePassword,
    savedAt: new Date().toISOString(),
  };
  
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  await new Promise<void>((resolve, reject) => {
    const req = store.put(storedCert);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  
  db.close();
};

// Obtener certificado guardado
export const getCertificate = async (): Promise<{ certificate: ArrayBuffer; password: string } | null> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const storedCert = await new Promise<StoredCertificate | undefined>((resolve, reject) => {
      const req = store.get('certificate');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    db.close();
    
    if (!storedCert) return null;
    
    return {
      certificate: base64ToArrayBuffer(storedCert.certificateBase64),
      password: storedCert.password,
    };
  } catch (error) {
    console.error('Error al obtener certificado:', error);
    return null;
  }
};

// Verificar si hay certificado guardado
export const hasCertificate = async (): Promise<boolean> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const result = await new Promise<StoredCertificate | undefined>((resolve, reject) => {
      const req = store.get('certificate');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    db.close();
    return !!result;
  } catch {
    return false;
  }
};

// Eliminar todos los datos seguros
export const clearSecureData = async (): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  await new Promise<void>((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  
  db.close();
};

// Verificar si el onboarding está completo
export const isOnboardingComplete = (): boolean => {
  return localStorage.getItem('dte_onboarding_complete') === 'true';
};

// Marcar onboarding como completo
export const setOnboardingComplete = (complete: boolean): void => {
  if (complete) {
    localStorage.setItem('dte_onboarding_complete', 'true');
  } else {
    localStorage.removeItem('dte_onboarding_complete');
  }
};
