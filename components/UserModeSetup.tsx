import React, { useState, useEffect } from 'react';
import { ArrowRight, Users, Store } from 'lucide-react';
import { UserMode, setUserMode } from '../utils/userMode';
import { fetchLicensingConfig } from '../utils/remoteLicensing';

interface UserModeSetupProps {
  onComplete: () => void;
}

export const UserModeSetup: React.FC<UserModeSetupProps> = ({ onComplete }) => {
  const [selectedMode, setSelectedMode] = useState<UserMode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [licensingEnabled, setLicensingEnabled] = useState<boolean | null>(null);

  // Verificar si el licenciamiento está activado
  useEffect(() => {
    const checkLicensing = async () => {
      const config = await fetchLicensingConfig();
      setLicensingEnabled(config.enabled);
      
      if (!config.enabled) {
        // Si no está activado, usar modo profesional por defecto y continuar
        setUserMode('profesional');
        onComplete();
      }
    };
    checkLicensing();
  }, [onComplete]);

  if (licensingEnabled === false) {
    return null;
  }

  const modes = [
    {
      key: 'profesional' as UserMode,
      title: 'Profesional',
      description: 'Gestiono facturación, libros y declaraciones',
      icon: Users,
      color: 'bg-blue-500',
      features: ['Libros IVA', 'Declaraciones', 'Gestión de clientes', 'Facturación de servicios']
    },
    {
      key: 'negocio' as UserMode,
      title: 'Negocio / Tienda',
      description: 'Vendo productos o servicios y necesito facturar',
      icon: Store,
      color: 'bg-green-500',
      features: ['Facturación', 'Inventario', 'Clientes', 'Historial', 'Libros IVA']
    }
  ];

  const handleContinue = async () => {
    if (!selectedMode) return;
    
    setIsLoading(true);
    
    // Guardar modo seleccionado
    setUserMode(selectedMode);
    
    // Simular carga
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setIsLoading(false);
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Gestión Integral de Facturación Electrónica
          </h1>
          <p className="text-gray-600">
            Seleccione el tipo de uso para su negocio
          </p>
        </div>

        {/* Mode Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isSelected = selectedMode === mode.key;
            
            return (
              <div
                key={mode.key}
                onClick={() => setSelectedMode(mode.key)}
                className={`relative cursor-pointer rounded-xl border-2 p-6 transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
                
                <div className={`w-12 h-12 ${mode.color} rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {mode.title}
                </h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  {mode.description}
                </p>
                
                <ul className="space-y-2">
                  {mode.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-700">
                      <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="flex justify-center">
          <button
            onClick={handleContinue}
            disabled={!selectedMode || isLoading}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-medium transition-all ${
              selectedMode && !isLoading
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Configurando...
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
