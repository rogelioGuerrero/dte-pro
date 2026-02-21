import React, { useState, useEffect } from 'react';
import { X, Check, Shield } from 'lucide-react';
import { licenseValidator } from '../utils/licenseValidator';
import { DeviceLicenseRequest } from './DeviceLicenseRequest';

interface LicenseManagerProps {
  onLicenseValid?: () => void;
  onClose?: () => void;
}

export const LicenseManager: React.FC<LicenseManagerProps> = ({ onLicenseValid, onClose }) => {
  const [currentLicense, setCurrentLicense] = useState<any>(null);

  useEffect(() => {
    checkCurrentLicense();
  }, []);

  const checkCurrentLicense = async () => {
    const license = licenseValidator.getCurrentLicense();
    if (license) {
      setCurrentLicense(license);
    }
  };

  const clearLicense = () => {
    licenseValidator.clearLicense();
    setCurrentLicense(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Gestión de Licencia</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {currentLicense ? (
            // Vista de licencia activa
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-5 h-5" />
                <span className="font-medium">Licencia Activa</span>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="text-sm">
                  <span className="text-gray-600">ID:</span>
                  <span className="ml-2 font-mono text-xs">{currentLicense.id}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Usuario:</span>
                  <span className="ml-2">{currentLicense.email || currentLicense.userId}</span>
                </div>
                {currentLicense.companyName && (
                  <div className="text-sm">
                    <span className="text-gray-600">Empresa:</span>
                    <span className="ml-2">{currentLicense.companyName}</span>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-gray-600">Expira:</span>
                  <span className="ml-2">
                    {new Date(currentLicense.expiresAt).toLocaleDateString('es-ES')}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Exportaciones:</span>
                  <span className="ml-2">
                    {currentLicense.maxExports === -1 
                      ? 'Ilimitadas' 
                      : `${currentLicense.maxExports} por día`
                    }
                  </span>
                </div>
              </div>

              <button
                onClick={clearLicense}
                className="w-full py-2 px-4 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                Eliminar Licencia
              </button>
            </div>
          ) : (
          // Vista de solicitud de licencia atada a dispositivo
          <DeviceLicenseRequest onLicenseUploaded={onLicenseValid} />
          )}
        </div>
      </div>
    </div>
  );
};
