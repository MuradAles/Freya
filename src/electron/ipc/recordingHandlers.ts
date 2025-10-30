import { ipcMain, desktopCapturer, dialog, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';

// Determine FFmpeg path based on environment
function getFfmpegPath(): string {
  if (app.isPackaged) {
    // In production, binaries are in resources folder
    const resourcesPath = path.join(process.resourcesPath || app.getAppPath(), 'resources');
    return path.join(resourcesPath, 'ffmpeg.exe');
  } else {
    // In development, use the installer path with correct require pattern
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    return ffmpegPath;
  }
}

export function setupRecordingHandlers() {
  // Configure FFmpeg path
  const ffmpegPath = getFfmpegPath();
  ffmpeg.setFfmpegPath(ffmpegPath);
  // Get available screen/window sources for recording
  ipcMain.handle('recording:getSources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 200, height: 200 }
      });

      return sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL()
      }));
    } catch (error) {
      console.error('Error getting recording sources:', error);
      return [];
    }
  });

  // Save recording blob to file
  ipcMain.handle('recording:saveFile', async (_, blobData: string, filePath: string) => {
    try {
      // Convert base64 data to buffer
      const buffer = Buffer.from(blobData, 'base64');
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(filePath, buffer);
      
      return { success: true, filePath, fileSize: buffer.length };
    } catch (error) {
      console.error('Error saving recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Show save dialog for recording
  ipcMain.handle('recording:showSaveDialog', async (_, defaultFilename: string) => {
    try {
      // Determine file type from filename extension
      const isAudio = defaultFilename.toLowerCase().endsWith('.mp3');

      const filters = isAudio ? [
        { name: 'MP3 Audio', extensions: ['mp3'] },
        { name: 'WAV Audio', extensions: ['wav'] },
        { name: 'All Files', extensions: ['*'] }
      ] : [
        { name: 'MP4 Video', extensions: ['mp4'] },
        { name: 'WebM Video', extensions: ['webm'] },
        { name: 'All Files', extensions: ['*'] }
      ];

      const result = await dialog.showSaveDialog({
        defaultPath: defaultFilename,
        filters: filters
      });

      if (result.canceled) {
        return null;
      }

      return result.filePath;
    } catch (error) {
      console.error('Error showing save dialog:', error);
      return null;
    }
  });

  // Convert WebM recording to MP4 with quality and frame rate options
  ipcMain.handle('recording:convertToMP4', async (event, webmPath: string, mp4Path: string, quality: 'high' | 'medium' | 'low' = 'medium', targetFrameRate: number = 60) => {
    try {
      // Map quality to CRF values (lower = better quality, larger file)
      const crfMap = {
        high: '18',    // Visually lossless, ~5-10 MB/min
        medium: '23',  // High quality, ~2-5 MB/min (default)
        low: '28'      // Good quality, ~0.5-2 MB/min (smallest)
      };
      const crf = crfMap[quality];

      return new Promise((resolve) => {
        ffmpeg(webmPath)
          .output(mp4Path)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-preset', 'fast',       // Fast encoding with good compression
            '-crf', crf,              // Quality setting based on user choice
            '-r', targetFrameRate.toString(), // Set target frame rate
            '-movflags', '+faststart', // Web-optimized MP4
            '-threads', '0'           // Use all CPU cores
          ])
          .on('start', () => {
          })
          .on('progress', (progress) => {
            // Send progress to renderer
            if (progress.percent) {
              event.sender.send('recording:compressionProgress', progress.percent);
            }
          })
          .on('end', () => {
            event.sender.send('recording:compressionProgress', 100);
            resolve({ success: true });
          })
          .on('error', (err) => {
            console.error('❌ FFmpeg conversion error:', err.message);
            resolve({ success: false, error: err.message });
          })
          .run();
      });
    } catch (error) {
      console.error('Error converting recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Convert WebM recording to MP3 (audio-only)
  ipcMain.handle('recording:convertToMP3', async (event, webmPath: string, mp3Path: string, quality: 'high' | 'medium' | 'low' = 'medium') => {
    try {

      // Map quality to audio bitrate (kbps)
      const bitrateMap = {
        high: '320k',   // Highest quality MP3
        medium: '192k', // Good quality (default)
        low: '128k'     // Acceptable quality, smallest size
      };
      const bitrate = bitrateMap[quality];

      return new Promise((resolve) => {
        ffmpeg(webmPath)
          .output(mp3Path)
          .audioCodec('libmp3lame')
          .audioBitrate(bitrate)
          .outputOptions([
            '-q:a', '2'  // MP3 quality (0-9, lower is better)
          ])
          .on('start', () => {
          })
          .on('progress', (progress) => {
            // Send progress to renderer
            if (progress.percent) {
              event.sender.send('recording:compressionProgress', progress.percent);
            }
          })
          .on('end', () => {
            event.sender.send('recording:compressionProgress', 100);
            resolve({ success: true });
          })
          .on('error', (err) => {
            console.error('❌ FFmpeg conversion error:', err.message);
            resolve({ success: false, error: err.message });
          })
          .run();
      });
    } catch (error) {
      console.error('Error converting recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Delete a file
  ipcMain.handle('recording:deleteFile', async (_, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  });
}

