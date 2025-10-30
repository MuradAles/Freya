import type { MediaAsset } from '../types/media';
import { generateThumbnail, getVideoDuration } from './thumbnailGenerator';

export function getFileExtension(filename: string): string {
  return filename.toLowerCase().split('.').pop() || '';
}

export function pathToFileURL(filePath: string): string {
  // Convert Windows path to file:// URL
  const normalizedPath = filePath.replace(/\\/g, '/');
  // Escape special characters
  const encodedPath = encodeURIComponent(normalizedPath).replace(/%2F/g, '/');
  return `file:///${encodedPath}`;
}

export function determineMediaType(filePath: string): 'video' | 'audio' | 'image' {
  const ext = getFileExtension(filePath);
  
  const videoExts = ['mp4', 'mov', 'webm', 'avi', 'mkv'];
  const audioExts = ['mp3', 'wav', 'm4a', 'aac', 'ogg'];
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
  
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (imageExts.includes(ext)) return 'image';
  
  // Default to video
  return 'video';
}

export async function processMediaFile(filePath: string): Promise<MediaAsset> {
  const metadata = await window.electronAPI.getFileMetadata(filePath);
  
  if (!metadata) {
    throw new Error('Could not read file metadata');
  }
  
  const type = determineMediaType(filePath);
  const id = generateId();
  
  // Generate thumbnail using native Electron API
  let thumbnail = '';
  
  try {
    const nativeThumbnail = await window.electronAPI.generateThumbnail(filePath, type);
    if (nativeThumbnail) {
      thumbnail = nativeThumbnail;
    } else {
      // Fallback to renderer-based thumbnail generation
      thumbnail = await generateThumbnail(filePath, type);
    }
  } catch (error) {
    console.error('Error with native thumbnail, using fallback:', error);
    thumbnail = await generateThumbnail(filePath, type);
  }
  
  // Get duration and dimensions
  let duration = 0;
  let width = 0;
  let height = 0;

  // Get duration for video/audio files using native Electron API
  if (type === 'video' || type === 'audio') {
    try {
      duration = await window.electronAPI.getMediaDuration(filePath);
    } catch (error) {
      console.error('Could not get media duration:', error);
    }
  }

  // Get dimensions for images
  if (type === 'image') {
    try {
      const dimensions = await getImageDimensions(filePath);
      width = dimensions.width;
      height = dimensions.height;
    } catch (error) {
      console.error('Could not get image dimensions:', error);
    }
  }
  
  return {
    id,
    type,
    name: metadata.name,
    path: metadata.path,
    duration,
    width,
    height,
    fileSize: metadata.size,
    thumbnail,
    createdAt: new Date(metadata.modified),
    source: 'imported'
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get dimensions of an image file
 */
async function getImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Convert file path to file URL
    img.src = pathToFileURL(filePath);
  });
}

