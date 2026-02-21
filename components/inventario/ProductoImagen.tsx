import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { imageStorage } from '../../utils/images/imageStorage';
import { Producto } from '../../types/inventario';

interface ProductoImagenProps {
  producto: Producto;
  className?: string;
  fallbackIconClass?: string;
}

export const ProductoImagen: React.FC<ProductoImagenProps> = ({ 
  producto, 
  className = "w-12 h-12", 
  fallbackIconClass = "w-6 h-6 text-gray-400"
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (producto.hasImage) {
        try {
          const url = await imageStorage.getImageUrl(producto.id);
          if (active) {
            setImageUrl(url);
            setLoading(false);
          }
        } catch (e) {
          if (active) setLoading(false);
        }
      } else {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [producto.id, producto.hasImage, producto.imageTimestamp]);

  if (loading) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center animate-pulse`}>
        <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <img 
        src={imageUrl} 
        alt={producto.descripcion} 
        className={`${className} object-cover rounded-lg bg-white border border-gray-100`}
      />
    );
  }

  return (
    <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center`}>
      <Package className={fallbackIconClass} />
    </div>
  );
};
