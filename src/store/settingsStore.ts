import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  openaiApiKey: string;
  setOpenAiApiKey: (key: string) => void;
  canvasColor: string;
  setCanvasColor: (color: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      openaiApiKey: '',
      setOpenAiApiKey: (key: string) => set({ openaiApiKey: key }),
      canvasColor: '#000000',
      setCanvasColor: (color: string) => set({ canvasColor: color }),
    }),
    {
      name: 'freya-settings',
    }
  )
);
