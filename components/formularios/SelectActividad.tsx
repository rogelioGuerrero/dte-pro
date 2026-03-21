import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Briefcase, X } from 'lucide-react';
import type { ActividadEconomica } from '../../catalogos';
import { loadActividadesEconomicas } from '../../utils/catalogosRuntime';

interface SelectActividadProps {
  value: string;
  description?: string;
  onChange: (codigo: string, descripcion: string) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
  allowManual?: boolean;
}

const SelectActividad: React.FC<SelectActividadProps> = ({
  value,
  description,
  onChange,
  disabled = false,
  required = false,
  label = 'Actividad Económica',
  placeholder = 'Buscar actividad...',
  className = '',
  allowManual = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [actividades, setActividades] = useState<ActividadEconomica[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [manualCode, setManualCode] = useState(value);
  const [manualDesc, setManualDesc] = useState('');
  const [manualError, setManualError] = useState('');

  // Obtener actividad seleccionada
  const selectedActividad = useMemo(() => {
    return actividades.find(a => a.codigo === value);
  }, [value, actividades]);

  const displayText = useMemo(() => {
    if (selectedActividad) return selectedActividad.descripcion;
    if (description) return description;
    if (value) return value;
    return '';
  }, [selectedActividad, description, value]);

  // Filtrar actividades
  const filteredActividades = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? actividades.filter((a) => a.codigo.includes(term) || a.descripcion.toLowerCase().includes(term))
      : actividades;

    return base.slice(0, 50);
  }, [search, actividades]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (actividades.length > 0) return;

    let mounted = true;
    setIsLoading(true);
    (async () => {
      try {
        const data = await loadActividadesEconomicas();
        if (!mounted) return;
        setActividades(data.actividadesEconomicas || []);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isOpen, actividades.length]);

  useEffect(() => {
    setManualCode(value || '');
  }, [value]);

  useEffect(() => {
    if (description) {
      setManualDesc(description);
      return;
    }
    if (selectedActividad) {
      setManualDesc(selectedActividad.descripcion);
      return;
    }
    if (!value) {
      setManualDesc('');
    }
  }, [description, selectedActividad, value]);

  const handleSelect = (actividad: ActividadEconomica) => {
    onChange(actividad.codigo, actividad.descripcion);
    setIsOpen(false);
    setSearch('');
    setManualError('');
  };

  const handleClear = () => {
    onChange('', '');
    setSearch('');
  };

  const openDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setSearch('');
  };

  const inputValue = isOpen ? search : (displayText || '');

  const handleManualApply = () => {
    if (!allowManual) return;
    const codigo = manualCode.trim();
    const descripcionManual = manualDesc.trim();
    if (!codigo || !descripcionManual) {
      setManualError('Completa código y descripción.');
      return;
    }
    setManualError('');
    onChange(codigo, descripcionManual);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase mb-1">
          <Briefcase className="w-3 h-3" />
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onFocus={() => openDropdown()}
          onChange={(e) => {
            if (!disabled && !isOpen) setIsOpen(true);
            setSearch(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              closeDropdown();
            }
            if (e.key === 'Enter') {
              const first = filteredActividades[0];
              if (isOpen && first) {
                e.preventDefault();
                handleSelect(first);
              }
            }
          }}
          disabled={disabled}
          placeholder={selectedActividad ? '' : placeholder}
          className={`
            w-full px-3 py-2 pr-10 border rounded-lg text-sm
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            ${isOpen ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300'}
          `}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {!!value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleClear();
                openDropdown();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (isOpen) closeDropdown();
              else openDropdown();
            }}
            disabled={disabled}
            className="text-gray-400"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Results */}
          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <p className="p-3 text-sm text-gray-400 text-center">Cargando...</p>
            ) : filteredActividades.length === 0 ? (
              <p className="p-3 text-sm text-gray-400 text-center">Sin resultados</p>
            ) : (
              filteredActividades.map(actividad => (
                <button
                  key={actividad.codigo}
                  onClick={() => handleSelect(actividad)}
                  className={`
                    w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors
                    ${actividad.codigo === value ? 'bg-blue-50' : ''}
                  `}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1 rounded shrink-0">
                      {actividad.codigo}
                    </span>
                    <span className="text-sm text-gray-700 line-clamp-2">
                      {actividad.descripcion}
                    </span>
                  </div>
                </button>
              ))
            )}
            {filteredActividades.length === 50 && (
              <p className="p-2 text-xs text-gray-400 text-center border-t">
                Mostrando primeros 50 resultados. Refina tu búsqueda.
              </p>
            )}
          </div>
        </div>
      )}

      {allowManual && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500 mb-2">¿No aparece en el catálogo? Ingresa la actividad manualmente.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-semibold uppercase text-slate-400 mb-1 block">Código</label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="86203"
                disabled={disabled}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold uppercase text-slate-400 mb-1 block">Descripción</label>
              <textarea
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Servicios médicos"
                disabled={disabled}
              />
            </div>
          </div>
          {manualError && <p className="text-xs text-red-500 mt-2">{manualError}</p>}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleManualApply}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
            >
              Usar valores manuales
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectActividad;
