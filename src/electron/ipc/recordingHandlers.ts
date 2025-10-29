import { ipcMain, desktopCapturer, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

export function setupRecordingHandlers() {
  // Configure FFmpeg path using @ffmpeg-installer
  const ffmpegPath = ffmpegInstaller.path;
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log('✅ FFmpeg configured at:', ffmpegPath);
  // Get available screen/window sources for recording
  ipcMain.handle('recording:getSources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 200, height: 200 }
      });

      console.log('🎥 Available recording sources:', sources.length);

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
      
      console.log('✅ Recording saved to:', filePath);
      console.log('📊 File size:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');
      
      return { success: true, filePath, fileSize: buffer.length };
    } catch (error) {
      console.error('Error saving recording:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Show save dialog for recording
  ipcMain.handle('recording:showSaveDialog', async (_, defaultFilename: string) => {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: defaultFilename,
        filters: [
          { name: 'MP4 Video', extensions: ['mp4'] }, // Save as MP4
          { name: 'WebM Video', extensions: ['webm'] },
          { name: 'All Files', extensions: ['*'] }
        ]
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

  // Convert WebM recording to MP4
  ipcMain.handle('recording:convertToMP4', async (_, webmPath: string, mp4Path: string) => {
    try {
      console.log('🎬 Converting WebM to MP4...');
      console.log('   Source:', webmPath);
      console.log('   Target:', mp4Path);

      return new Promise((resolve) => {
        ffmpeg(webmPath)
          .output(mp4Path)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions(['-preset', 'fast', '-crf', '23'])
          .on('start', (cmdLine) => {
            console.log('🔥 FFmpeg command:', cmdLine);
          })
          .on('end', () => {
            console.log('✅ WebM → MP4 conversion complete');
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
        console.log('🗑️  Deleted file:', filePath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  });
}

