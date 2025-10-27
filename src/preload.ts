// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, webUtils } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File dialog
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultFilename: string) => ipcRenderer.invoke('dialog:saveFile', defaultFilename),
  
  // File metadata
  getFileMetadata: (filePath: string) => ipcRenderer.invoke('file:getMetadata', filePath),
  
  // Get file path from File object (recommended method for Electron 32+)
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch (error) {
      console.error('Error getting path for file:', error);
      return null;
    }
  },
  
  // Generate thumbnail in main process
  generateThumbnail: (filePath: string, type: string) => ipcRenderer.invoke('file:generateThumbnail', filePath, type),

  // Read file as data URL for preview
  readFileAsDataURL: (filePath: string) => ipcRenderer.invoke('file:readAsDataURL', filePath),

  // Get media duration using ffmpeg
  getMediaDuration: (filePath: string) => ipcRenderer.invoke('file:getDuration', filePath),
});
