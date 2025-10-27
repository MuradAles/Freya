import { create } from 'zustand';
import type { MediaAsset } from '../types/media';

interface UIStore {
  // Recording state
  isRecording: boolean;
  recordingSources: {
    screen: boolean;
    camera: boolean;
    microphone: boolean;
  };
  
  // Export state
  isExporting: boolean;
  exportProgress: number;
  
  // UI state
  selectedPanel: 'media' | 'recording';
  
  // Selection
  selectedMediaId: string | null;
  selectedClipIds: string[];
  
  // Actions
  setRecording: (isRecording: boolean) => void;
  setRecordingSource: (source: 'screen' | 'camera' | 'microphone', enabled: boolean) => void;
  setExporting: (isExporting: boolean) => void;
  setExportProgress: (progress: number) => void;
  setSelectedPanel: (panel: 'media' | 'recording') => void;
  setSelectedMedia: (mediaId: string | null) => void;
  setSelectedClips: (clipIds: string[]) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // Initial state
  isRecording: false,
  recordingSources: {
    screen: false,
    camera: false,
    microphone: false,
  },
  
  isExporting: false,
  exportProgress: 0,
  
  selectedPanel: 'media',
  
  selectedMediaId: null,
  selectedClipIds: [],
  
  // Actions
  setRecording: (isRecording) => set({ isRecording }),
  
  setRecordingSource: (source, enabled) => set((state) => ({
    recordingSources: {
      ...state.recordingSources,
      [source]: enabled
    }
  })),
  
  setExporting: (isExporting) => set({ isExporting }),
  
  setExportProgress: (progress) => set({ exportProgress: Math.max(0, Math.min(100, progress)) }),
  
  setSelectedPanel: (panel) => set({ selectedPanel: panel }),
  
  setSelectedMedia: (mediaId) => set({ selectedMediaId: mediaId }),
  
  setSelectedClips: (clipIds) => set({ selectedClipIds: clipIds }),
}));

