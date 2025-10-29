export interface ElectronAPI {
  openFile: () => Promise<string[]>;
  saveFile: (defaultFilename: string) => Promise<string | null>;
  getFileMetadata: (filePath: string) => Promise<{
    path: string;
    name: string;
    size: number;
    extension: string;
    modified: Date;
  } | null>;
  getVideoMetadata: (filePath: string) => Promise<{
    duration: number;
    width: number;
    height: number;
  } | null>;
  getPathForFile: (file: File) => string | null;
  generateThumbnail: (filePath: string, type: string) => Promise<string | null>;
  readFileAsDataURL: (filePath: string) => Promise<string | null>;
  getMediaDuration: (filePath: string) => Promise<number>;
  exportVideo: (tracks: any[], mediaAssets: any[], outputPath: string, resolution: string) => Promise<{ success: boolean }>;
  getRecordingSources: () => Promise<Array<{ id: string; name: string; thumbnail: string }>>;
  saveRecording: (blobData: string, filePath: string) => Promise<{ success: boolean; filePath?: string; fileSize?: number; error?: string }>;
  showRecordingSaveDialog: (defaultFilename: string) => Promise<string | null>;
  convertRecordingToMP4: (webmPath: string, mp4Path: string, quality?: 'high' | 'medium' | 'low', frameRate?: number) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (filePath: string) => Promise<void>;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
  // System audio loopback (electron-audio-loopback)
  enableLoopbackAudio: () => Promise<void>;
  disableLoopbackAudio: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

