import React from 'react';
import { useEmisor } from '../contexts/EmisorContext';
import { Building2 } from 'lucide-react';

interface EmisorSelectorProps {
  className?: string;
}

export const EmisorSelector: React.FC<EmisorSelectorProps> = ({ className }) => {
  const { emisores, businessId, setBusinessId, loading, currentRole, selectedEmisor } = useEmisor();

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Building2 className="w-4 h-4 text-gray-500" />
      <select
        value={selectedEmisor?.id || selectedEmisor?.business_id || businessId || ''}
        onChange={(e) => setBusinessId(e.target.value || null)}
        disabled={loading || emisores.length === 0}
        className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-500"
        title={businessId || 'Selecciona emisor'}
      >
        {emisores.length === 0 && <option value="">Sin emisores</option>}
        {emisores.map((em) => (
          <option key={em.id || em.business_id} value={em.id || em.business_id}>
            {em.nombre || em.business_id} {em.role ? `(${em.role})` : ''}
          </option>
        ))}
      </select>
      {currentRole && <span className="text-xs text-gray-500">Rol: {currentRole}</span>}
    </div>
  );
};
