import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useEmisor } from '../contexts/EmisorContext';
import { notify } from '../utils/notifications';

interface LogoUploaderProps {
  currentLogo?: string;
  onLogoChange: (logo: string | undefined) => void;
  compact?: boolean;
}

const LogoUploader: React.FC<LogoUploaderProps> = ({
  currentLogo,
  onLogoChange,
  compact = false
}) => {
  const { businessId } = useEmisor();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 500 * 1024; // 500KB
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

  const handleFile = async (file: File) => {
    setError(null);
    if (!businessId) {
      setError('Selecciona un emisor antes de subir logo');
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Formato no válido. Use PNG, JPG, SVG o WebP');
      return;
    }

    if (file.size > MAX_SIZE) {
      setError('El archivo es muy grande. Máximo 500KB');
      return;
    }

    setIsUploading(true);
    const filePath = `logos/${businessId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('business-logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error subiendo logo:', uploadError);
      setError('Error al subir logo. Intenta de nuevo.');
      setIsUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('business-logos')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;
    onLogoChange(publicUrl);
    setIsUploading(false);
    notify('Logo subido exitosamente', 'success');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemove = () => {
    onLogoChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {currentLogo ? (
          <div className="relative group">
            <img 
              src={currentLogo} 
              alt="Logo" 
              className="w-12 h-12 object-contain rounded-lg border border-gray-200 bg-white"
            />
            <button
              onClick={handleRemove}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleClick}
            className="w-12 h-12 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700">Logo</p>
          <p className="text-xs text-gray-500">
            {currentLogo ? 'Click para cambiar' : 'PNG, JPG o SVG (máx 500KB)'}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-500 uppercase">
        Logo de la Empresa
      </label>
      
      {currentLogo ? (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <img 
            src={currentLogo} 
            alt="Logo" 
            className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white p-1"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Logo cargado</p>
            <p className="text-xs text-gray-500">Se mostrará en las facturas</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClick}
              disabled={isUploading}
              className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Cambiar
            </button>
            <button
              onClick={handleRemove}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all
            ${isDragging 
              ? 'border-indigo-500 bg-indigo-50' 
              : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
            }
          `}
        >
          <div className="flex flex-col items-center text-center">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center mb-3
              ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}
            `}>
              {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
            </div>
            <p className="text-sm font-medium text-gray-700">
              {isUploading ? 'Subiendo...' : (isDragging ? 'Suelta la imagen aquí' : 'Arrastra tu logo o haz click')}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG, SVG o WebP (máximo 500KB)
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <X className="w-3 h-3" />
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
};

export default LogoUploader;
