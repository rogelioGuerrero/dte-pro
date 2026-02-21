import React, { useEffect } from 'react';
import { licenseValidator } from '../utils/licenseValidator';
import { notify } from '../utils/notifications';

export const MagicLicenseActivator: React.FC = () => {
  // Manejamos manualmente query params para no depender de react-router si no se usa en todo el proyecto
  // pero usaremos window.location para ser consistentes con el resto de la app que parece usar routing mixto
  
  useEffect(() => {
    const checkMagicLink = async () => {
      const params = new URLSearchParams(window.location.search);
      const licenseCode = params.get('license');

      if (licenseCode) {
        try {
          // Intentar decodificar y validar
          const jsonStr = atob(licenseCode);
          const licenseData = JSON.parse(jsonStr);

          // Guardar temporalmente para que validator lo lea
          localStorage.setItem('dte-license', JSON.stringify(licenseData));
          
          // Validar
          const isValid = await licenseValidator.hasValidLicense();
          
          if (isValid) {
            notify('¡Licencia activada exitosamente!', 'success');
            // Limpiar URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            
            // Recargar para aplicar cambios
            setTimeout(() => window.location.reload(), 1500);
          } else {
            console.error('Licencia inválida en URL');
            notify('La licencia del enlace no es válida o ha expirado', 'error');
            localStorage.removeItem('dte-license');
          }
        } catch (error) {
          console.error('Error procesando licencia mágica:', error);
          notify('Enlace de licencia corrupto', 'error');
        }
      }
    };

    checkMagicLink();
  }, []);

  return null; // Componente invisible
};
