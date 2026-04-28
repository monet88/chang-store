import { get, set, del, clear, keys } from 'idb-keyval';
import { GalleryImageFile } from '../types';

const GALLERY_STORE_KEY = 'chang-store-gallery-images';

/**
 * Gallery DB Wrapper
 * 
 * Lưu trữ ảnh gallery vào IndexedDB để tránh mất dữ liệu khi load lại trang
 * và giảm tải bộ nhớ RAM (OOM).
 */
export const galleryDB = {
  /**
   * Lưu một ảnh vào DB
   */
  async saveImage(image: GalleryImageFile): Promise<void> {
    try {
      // Chúng ta sẽ lưu từng ảnh theo khóa an toàn để dễ quản lý
      const key = image.driveFileId || image.base64.substring(0, 32);
      await set(`img_${key}`, image);
    } catch (error) {
      console.error('Failed to save image to IndexedDB:', error);
    }
  },

  /**
   * Lưu danh sách ảnh (ghi đè)
   */
  async saveAllImages(images: GalleryImageFile[]): Promise<void> {
    try {
      // Để đơn giản, chúng ta lưu toàn bộ mảng vào một key
      // Nếu số lượng ảnh quá lớn (> 100MB), nên cân nhắc lưu lẻ
      await set(GALLERY_STORE_KEY, images);
    } catch (error) {
      console.error('Failed to save gallery to IndexedDB:', error);
    }
  },

  /**
   * Lấy toàn bộ ảnh từ DB
   */
  async getAllImages(): Promise<GalleryImageFile[]> {
    try {
      const images = await get<GalleryImageFile[]>(GALLERY_STORE_KEY);
      return images || [];
    } catch (error) {
      console.error('Failed to get gallery from IndexedDB:', error);
      return [];
    }
  },

  /**
   * Xóa một ảnh
   */
  async deleteImage(key: string): Promise<void> {
    try {
      const images = await this.getAllImages();
      const filtered = images.filter(img => img.driveFileId !== key && img.base64.substring(0, 32) !== key);
      await this.saveAllImages(filtered);
    } catch (error) {
      console.error('Failed to delete image from IndexedDB:', error);
    }
  },

  /**
   * Xóa toàn bộ gallery
   */
  async clearAll(): Promise<void> {
    try {
      await del(GALLERY_STORE_KEY);
    } catch (error) {
      console.error('Failed to clear IndexedDB gallery:', error);
    }
  }
};
