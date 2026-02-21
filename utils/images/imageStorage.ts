
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ImageDBSchema extends DBSchema {
  product_images: {
    key: string; // productId
    value: {
      productId: string;
      imageBlob: Blob;
      updatedAt: number;
    };
  };
}

const DB_NAME = 'dte_images_db';
const STORE_NAME = 'product_images';
const DB_VERSION = 1;

class ImageStorageService {
  private dbPromise: Promise<IDBPDatabase<ImageDBSchema>>;

  constructor() {
    this.dbPromise = openDB<ImageDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'productId' });
        }
      },
    });
  }

  async saveImage(productId: string, imageBlob: Blob): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORE_NAME, {
      productId,
      imageBlob,
      updatedAt: Date.now(),
    });
  }

  async getImage(productId: string): Promise<Blob | null> {
    try {
      const db = await this.dbPromise;
      const record = await db.get(STORE_NAME, productId);
      return record ? record.imageBlob : null;
    } catch (error) {
      console.error('Error recuperando imagen:', error);
      return null;
    }
  }

  async deleteImage(productId: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, productId);
  }
  
  async getImageUrl(productId: string): Promise<string | null> {
    const blob = await this.getImage(productId);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }
}

export const imageStorage = new ImageStorageService();
