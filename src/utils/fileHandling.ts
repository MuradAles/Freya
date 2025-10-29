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
  console.log('📂 Processing media file:', filePath);
  
  const metadata = await window.electronAPI.getFileMetadata(filePath);
  
  if (!metadata) {
    throw new Error('Could not read file metadata');
  }
  
  const type = determineMediaType(filePath);
  const id = generateId();
  
  console.log('📋 File info:', {
    name: metadata.name,
    type,
    size: metadata.size
  });
  
  // Generate thumbnail using native Electron API
  console.log('🖼️  Starting thumbnail generation...');
  let thumbnail = '';
  
  try {
    const nativeThumbnail = await window.electronAPI.generateThumbnail(filePath, type);
    if (nativeThumbnail) {
      thumbnail = nativeThumbnail;
      console.log('✅ Native thumbnail generated');
    } else {
      // Fallback to renderer-based thumbnail generation
      console.log('⚠️  Native thumbnail failed, trying renderer method...');
      thumbnail = await generateThumbnail(filePath, type);
    }
  } catch (error) {
    console.error('Error with native thumbnail, using fallback:', error);
    thumbnail = await generateThumbnail(filePath, type);
  }
  
  console.log('🖼️  Thumbnail result:', thumbnail ? 'Generated (has data)' : 'Empty');
  
  // Get duration and dimensions
  let duration = 0;
  let width = 0;
  let height = 0;

  // Get duration for video/audio files using native Electron API
  if (type === 'video' || type === 'audio') {
    console.log('⏱️  Getting media duration...');
    try {
      duration = await window.electronAPI.getMediaDuration(filePath);
      console.log('⏱️  Media duration:', duration);
    } catch (error) {
      console.error('Could not get media duration:', error);
    }
  }

  // Get dimensions for images
  if (type === 'image') {
    console.log('📏 Getting image dimensions...');
    try {
      const dimensions = await getImageDimensions(filePath);
      width = dimensions.width;
      height = dimensions.height;
      console.log(`📏 Image dimensions: ${width}×${height}`);
    } catch (error) {
      console.error('Could not get image dimensions:', error);
    }
  }
  
  console.log('✅ Media file processed successfully');
  
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

