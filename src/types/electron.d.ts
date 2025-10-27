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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

