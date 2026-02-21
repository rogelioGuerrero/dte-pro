// Manejo de certificados .p12 en el navegador
// Usa node-forge para extraer clave privada y certificado

import forge from 'node-forge';

export interface CertificadoInfo {
  subject: {
    commonName: string;
    organization?: string;
    country?: string;
  };
  issuer: {
    commonName: string;
    organization?: string;
  };
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
  isValid: boolean;
}

export interface P12Result {
  success: boolean;
  privateKey?: forge.pki.rsa.PrivateKey;
  certificate?: forge.pki.Certificate;
  certificateInfo?: CertificadoInfo;
  certificatePem?: string;
  error?: string;
}

export interface FirmaJWSResult {
  success: boolean;
  jws?: string;
  error?: string;
}

// Leer y parsear archivo .p12
export const leerP12 = async (
  p12File: File | ArrayBuffer,
  password: string
): Promise<P12Result> => {
  try {
    // Obtener ArrayBuffer del archivo
    let p12Buffer: ArrayBuffer;
    if (p12File instanceof File) {
      p12Buffer = await p12File.arrayBuffer();
    } else {
      p12Buffer = p12File;
    }

    // Convertir a formato que forge entiende
    const p12Der = forge.util.createBuffer(new Uint8Array(p12Buffer));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    
    // Parsear PKCS#12
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    // Extraer clave privada
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    
    if (!keyBag || keyBag.length === 0) {
      return { success: false, error: 'No se encontró clave privada en el certificado' };
    }
    
    const privateKey = keyBag[0].key as forge.pki.rsa.PrivateKey;
    if (!privateKey) {
      return { success: false, error: 'No se pudo extraer la clave privada' };
    }

    // Extraer certificado
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];
    
    if (!certBag || certBag.length === 0) {
      return { success: false, error: 'No se encontró certificado' };
    }
    
    const certificate = certBag[0].cert as forge.pki.Certificate;
    if (!certificate) {
      return { success: false, error: 'No se pudo extraer el certificado' };
    }

    // Extraer información del certificado
    const now = new Date();
    const validFrom = certificate.validity.notBefore;
    const validTo = certificate.validity.notAfter;
    
    const getAttr = (attrs: forge.pki.CertificateField[], shortName: string): string => {
      const attr = attrs.find(a => a.shortName === shortName);
      return attr?.value as string || '';
    };

    const certificateInfo: CertificadoInfo = {
      subject: {
        commonName: getAttr(certificate.subject.attributes, 'CN'),
        organization: getAttr(certificate.subject.attributes, 'O'),
        country: getAttr(certificate.subject.attributes, 'C'),
      },
      issuer: {
        commonName: getAttr(certificate.issuer.attributes, 'CN'),
        organization: getAttr(certificate.issuer.attributes, 'O'),
      },
      validFrom,
      validTo,
      serialNumber: certificate.serialNumber,
      isValid: now >= validFrom && now <= validTo,
    };

    // Convertir certificado a PEM para incluir en JWS
    const certificatePem = forge.pki.certificateToPem(certificate);

    return {
      success: true,
      privateKey,
      certificate,
      certificateInfo,
      certificatePem,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    // Mensajes de error más amigables
    if (errorMessage.includes('Invalid password') || errorMessage.includes('PKCS#12')) {
      return { success: false, error: 'Contraseña incorrecta del certificado' };
    }
    if (errorMessage.includes('ASN.1')) {
      return { success: false, error: 'Archivo .p12 inválido o corrupto' };
    }
    
    return { success: false, error: `Error al leer certificado: ${errorMessage}` };
  }
};

// Firmar DTE con JWS RS512
export const firmarDTEConP12 = async (
  dte: object,
  privateKey: forge.pki.rsa.PrivateKey,
  certificatePem: string
): Promise<FirmaJWSResult> => {
  try {
    // Header JWS según especificación MH
    const header = {
      alg: 'RS512',
      typ: 'JWT',
      // x5c contiene el certificado en base64 (sin headers PEM)
      x5c: [certificatePemToBase64(certificatePem)],
    };

    // Codificar header y payload en Base64URL
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(dte));

    // Mensaje a firmar
    const message = `${headerB64}.${payloadB64}`;

    // Crear hash SHA-512 y firmar
    const md = forge.md.sha512.create();
    md.update(message, 'utf8');
    
    // Firmar con RSASSA-PKCS1-v1_5
    const signature = privateKey.sign(md);

    // Codificar firma en Base64URL
    const signatureB64 = base64UrlEncode(signature);

    // JWS completo
    const jws = `${headerB64}.${payloadB64}.${signatureB64}`;

    return { success: true, jws };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al firmar DTE',
    };
  }
};

// Verificar firma JWS
export const verificarFirmaJWS = (
  jws: string,
  certificate: forge.pki.Certificate
): boolean => {
  try {
    const parts = jws.split('.');
    if (parts.length !== 3) return false;

    const [headerB64, payloadB64, signatureB64] = parts;
    const message = `${headerB64}.${payloadB64}`;
    
    // Decodificar firma
    const signature = base64UrlDecode(signatureB64);

    // Verificar con clave pública del certificado
    const md = forge.md.sha512.create();
    md.update(message, 'utf8');

    const publicKey = certificate.publicKey as forge.pki.rsa.PublicKey;
    return publicKey.verify(md.digest().bytes(), signature);
  } catch {
    return false;
  }
};

// Utilidades de codificación Base64URL
const base64UrlEncode = (str: string): string => {
  // Convertir string a bytes y luego a base64
  const bytes = forge.util.encodeUtf8(str);
  const base64 = forge.util.encode64(bytes);
  
  // Convertir a Base64URL
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const base64UrlDecode = (str: string): string => {
  // Restaurar caracteres Base64 estándar
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // Agregar padding si es necesario
  while (base64.length % 4) {
    base64 += '=';
  }
  
  return forge.util.decode64(base64);
};

// Extraer certificado de PEM a Base64 (sin headers)
const certificatePemToBase64 = (pem: string): string => {
  return pem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\r?\n/g, '');
};

// Validar que el certificado sea válido para firmar DTEs
export const validarCertificadoDTE = (info: CertificadoInfo): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (!info.isValid) {
    const now = new Date();
    if (now < info.validFrom) {
      errors.push('El certificado aún no es válido');
    } else if (now > info.validTo) {
      errors.push('El certificado ha expirado');
    }
  }

  // Verificar que sea emitido por MH (en producción)
  // Por ahora solo validamos que tenga los campos básicos
  if (!info.subject.commonName) {
    errors.push('El certificado no tiene nombre del titular');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Formatear fecha de certificado
export const formatearFechaCertificado = (date: Date): string => {
  return date.toLocaleDateString('es-SV', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
