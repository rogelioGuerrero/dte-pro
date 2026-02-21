import { ChevronDown } from 'lucide-react';

interface CatalogoItemBase {
  codigo: string | number;
  descripcion?: string;
  nombre?: string;
}

interface SelectCatalogoProps<T extends CatalogoItemBase> {
  catalogo: T[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  showCode?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
}

function SelectCatalogo<T extends CatalogoItemBase>({
  catalogo,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  showCode = true,
  disabled = false,
  className = '',
  label,
  required = false,
  error,
  size = 'md',
}: SelectCatalogoProps<T>) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  const getDisplayText = (item: T): string => {
    const text = item.descripcion || item.nombre || '';
    if (showCode) {
      return `${item.codigo} - ${text}`;
    }
    return text;
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`
            w-full ${sizeClasses[size]} border rounded-lg 
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
            outline-none appearance-none bg-white
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            ${error ? 'border-red-300' : 'border-gray-300'}
          `}
        >
          <option value="">{placeholder}</option>
          {catalogo.map((item) => (
            <option key={String(item.codigo)} value={item.codigo}>
              {getDisplayText(item)}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default SelectCatalogo;
