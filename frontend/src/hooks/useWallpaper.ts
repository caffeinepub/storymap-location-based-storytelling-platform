import { useState, useEffect, useCallback } from 'react';

const WALLPAPER_STORAGE_KEY = 'storymap-wallpaper';

interface WallpaperMetadata {
  dataUrl: string;
  fileName: string;
  timestamp: number;
}

interface WallpaperState {
  url: string | null;
  fileName: string | null;
}

/**
 * Hook to manage wallpaper state with localStorage persistence using data URLs for reload stability
 */
export function useWallpaper() {
  const [wallpaper, setWallpaper] = useState<WallpaperState>({
    url: null,
    fileName: null,
  });

  // Load persisted wallpaper on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(WALLPAPER_STORAGE_KEY);
      if (stored) {
        const metadata: WallpaperMetadata = JSON.parse(stored);
        setWallpaper({
          url: metadata.dataUrl,
          fileName: metadata.fileName,
        });
      }
    } catch (error) {
      // Silently ignore storage errors
      console.warn('Failed to load wallpaper from storage:', error);
    }
  }, []);

  /**
   * Convert File to data URL for persistent storage
   */
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as data URL'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  /**
   * Apply a new wallpaper from a File
   */
  const applyWallpaper = useCallback(async (file: File) => {
    try {
      // Convert file to data URL for persistent storage
      const dataUrl = await fileToDataUrl(file);

      const newWallpaper: WallpaperState = {
        url: dataUrl,
        fileName: file.name,
      };

      setWallpaper(newWallpaper);

      // Persist to localStorage
      try {
        const metadata: WallpaperMetadata = {
          dataUrl: dataUrl,
          fileName: file.name,
          timestamp: Date.now(),
        };
        localStorage.setItem(WALLPAPER_STORAGE_KEY, JSON.stringify(metadata));
      } catch (error) {
        // Silently ignore storage errors
        console.warn('Failed to persist wallpaper to storage:', error);
      }
    } catch (error) {
      console.error('Failed to apply wallpaper:', error);
      throw error;
    }
  }, []);

  /**
   * Remove the current wallpaper
   */
  const removeWallpaper = useCallback(() => {
    setWallpaper({
      url: null,
      fileName: null,
    });

    // Remove from localStorage
    try {
      localStorage.removeItem(WALLPAPER_STORAGE_KEY);
    } catch (error) {
      // Silently ignore storage errors
      console.warn('Failed to remove wallpaper from storage:', error);
    }
  }, []);

  return {
    wallpaper,
    applyWallpaper,
    removeWallpaper,
  };
}

export default useWallpaper;
