import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MediaAsset } from '../types/media';

interface MediaStore {
  mediaLibrary: MediaAsset[];
  
  // Actions
  addMedia: (asset: MediaAsset) => void;
  removeMedia: (id: string) => void;
  getMediaById: (id: string) => MediaAsset | undefined;
  clearLibrary: () => void;
}

export const useMediaStore = create<MediaStore>()(
  persist(
    (set, get) => ({
      mediaLibrary: [],
      
      addMedia: (asset) => set((state) => ({
        mediaLibrary: [...state.mediaLibrary, asset]
      })),
      
      removeMedia: (id) => set((state) => ({
        mediaLibrary: state.mediaLibrary.filter(media => media.id !== id)
      })),
      
      getMediaById: (id) => {
        return get().mediaLibrary.find(media => media.id === id);
      },
      
      clearLibrary: () => set({ mediaLibrary: [] }),
    }),
    {
      name: 'clipforge-media-storage',
    }
  )
);

