import { ipcMain, dialog, nativeImage, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';

// Determine FFmpeg path based on environment
function getFfmpegPath(): string {
  if (app.isPackaged) {
    const resourcesPath = path.join(process.resourcesPath || app.getAppPath(), 'resources');
    return path.join(resourcesPath, 'ffmpeg.exe');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@ffmpeg-installer/ffmpeg').path;
  }
}

function getFfprobePath(): string {
  if (app.isPackaged) {
    const resourcesPath = path.join(process.resourcesPath || app.getAppPath(), 'resources');
    return path.join(resourcesPath, 'ffprobe.exe');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@ffprobe-installer/ffprobe').path;
  }
}

export function setupFileHandlers() {
  // Configure FFmpeg paths
  ffmpeg.setFfmpegPath(getFfmpegPath());
  ffmpeg.setFfprobePath(getFfprobePath());
  // Handle file picker dialog
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Media Files',
          extensions: ['mp4', 'mov', 'webm', 'mp3', 'wav', 'png', 'jpg', 'jpeg']
        },
        {
          name: 'Video Files',
          extensions: ['mp4', 'mov', 'webm']
        },
        {
          name: 'Audio Files',
          extensions: ['mp3', 'wav']
        },
        {
          name: 'Image Files',
          extensions: ['png', 'jpg', 'jpeg']
        },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return [];
    }

    return result.filePaths;
  });

  // Handle file save dialog
  ipcMain.handle('dialog:saveFile', async (_, defaultFilename: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultFilename,
      filters: [
        {
          name: 'Video Files',
          extensions: ['mp4']
        },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return null;
    }

    return result.filePath;
  });

  // Get file metadata
  ipcMain.handle('file:getMetadata', async (_, filePath: string) => {
    try {
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        extension: ext,
        modified: stats.mtime
      };
    } catch (error) {
      console.error('Error reading file metadata:', error);
      return null;
    }
  });

  // Read file as data URL for preview
  ipcMain.handle('file:readAsDataURL', async (_, filePath: string) => {
    try {
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      const ext = path.extname(filePath).toLowerCase();

      // Determine MIME type
      const mimeTypes: { [key: string]: string } = {
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.ogg': 'audio/ogg',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };

      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Error reading file as data URL:', error);
      return null;
    }
  });

  // Generate thumbnail for image files
  ipcMain.handle('file:generateThumbnail', async (_, filePath: string, type: string) => {
    try {
      if (type === 'image') {
        // For images, create a resized thumbnail using nativeImage
        const image = nativeImage.createFromPath(filePath);
        if (image.isEmpty()) {
          return null;
        }
        
        // Resize to max 200x200 while maintaining aspect ratio
        const { width, height } = image.getSize();
        let newWidth = width;
        let newHeight = height;
        
        if (width > 200 || height > 200) {
          const ratio = Math.min(200 / width, 200 / height);
          newWidth = Math.round(width * ratio);
          newHeight = Math.round(height * ratio);
        }
        
        const resized = image.resize({ width: newWidth, height: newHeight });
        return resized.toDataURL();
      } else if (type === 'video') {
        // For videos, try to create thumbnail from first frame
        try {
          const thumbnail = await nativeImage.createThumbnailFromPath(filePath, { width: 200, height: 200 });
          return thumbnail.toDataURL();
        } catch (e) {
          console.log('Could not create video thumbnail, returning null');
          return null;
        }
      } else if (type === 'audio') {
        // For audio, we'll generate a placeholder in the renderer
        return null;
      }
      return null;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  });

  // Get media duration using fluent-ffmpeg
  ipcMain.handle('file:getDuration', async (_, filePath: string) => {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err || !metadata) {
          console.log('Could not get media duration:', err);
          resolve(0);
          return;
        }
        
        const duration = metadata.format.duration || 0;
        console.log('✅ Got media duration:', duration);
        resolve(duration);
      });
    });
  });
}

