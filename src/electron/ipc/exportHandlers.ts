import { ipcMain, app } from 'electron';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Track, TimelineClip } from '../../types/timeline';
import type { MediaAsset } from '../../types/media';

// Determine FFmpeg and FFprobe paths based on environment
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

function getFfprobePath(): string {
  if (app.isPackaged) {
    // In production, binaries are in resources folder
    const resourcesPath = path.join(process.resourcesPath || app.getAppPath(), 'resources');
    return path.join(resourcesPath, 'ffprobe.exe');
  } else {
    // In development, use the installer path with correct require pattern
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffprobePath = require('@ffprobe-installer/ffprobe').path;
    return ffprobePath;
  }
}

ffmpeg.setFfmpegPath(getFfmpegPath());
ffmpeg.setFfprobePath(getFfprobePath());

// Quality to CRF mapping (lower CRF = higher quality, larger file)
function getCRFForQuality(quality: 'low' | 'medium' | 'high'): string {
  const crfMap: Record<'low' | 'medium' | 'high', string> = {
    'high': '18',   // Visually lossless, largest file
    'medium': '20', // Good balance (default)
    'low': '23'     // Smaller file, good quality
  };
  return crfMap[quality] || '20';
}

interface ExportJob {
  tracks: Track[];
  mediaAssets: MediaAsset[];
  outputPath: string;
  resolution: { width: number; height: number };
  quality: 'low' | 'medium' | 'high';
  canvasColor: string;
  progressCallback: (progress: number) => void;
}

interface ClipProcessing {
  clip: TimelineClip;
  media: MediaAsset;
  tempFile: string;
  trackOrder: number;
}

export function setupExportHandlers() {
  // Handle export start
  ipcMain.handle('export:start', async (event, tracks: Track[], mediaAssets: MediaAsset[], outputPath: string, resolution: string, canvasWidth?: number, canvasHeight?: number, quality: 'low' | 'medium' | 'high' = 'medium', canvasColor?: string) => {
    // Ensure canvasColor is always a valid hex color
    const validCanvasColor = (canvasColor && /^#[0-9A-Fa-f]{6}$/.test(canvasColor)) ? canvasColor : '#000000';

    // Use provided dimensions directly (they're already calculated to maintain aspect ratio)
    const res = { width: canvasWidth || 1920, height: canvasHeight || 1080 };

    try {
      await exportTimeline({
        tracks,
        mediaAssets,
        outputPath,
        resolution: res,
        quality,
        canvasColor: validCanvasColor,
        progressCallback: (progress) => {
          // Send progress to renderer
          event.sender.send('export:progress', progress);
        }
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  });
}

async function exportTimeline(job: ExportJob): Promise<void> {
  const { tracks, mediaAssets, outputPath, resolution, quality } = job;
  
  const crfValue = getCRFForQuality(quality);
  
  // Get all video/audio clips from all tracks
  const allClips: Array<{ clip: TimelineClip; media: MediaAsset; trackOrder: number }> = [];
  
  tracks.forEach(track => {
    track.clips.forEach(clip => {
      const media = mediaAssets.find(a => a.id === clip.assetId);
      if (media && (media.type === 'video' || media.type === 'audio' || media.type === 'image')) {
        allClips.push({ clip, media, trackOrder: track.order });
      }
    });
  });

  if (allClips.length === 0) {
    throw new Error('No clips found on timeline');
  }

  // Process each clip: trim, apply effects, save to temp file
  const tempDir = path.join(os.tmpdir(), 'freya-export-' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });

  // Send initial progress
  job.progressCallback(5);

  const processedClips: ClipProcessing[] = [];

  // Process each clip
  const clipProcessProgressWeight = 30; // 5% -> 35%
  for (let i = 0; i < allClips.length; i++) {
    const { clip, media, trackOrder } = allClips[i];
    
    const processedClip = await processClip(clip, media, resolution, tempDir, trackOrder);
    processedClips.push(processedClip);
    
    // Update progress (5% -> 35%)
    const progress = 5 + (i + 1) * clipProcessProgressWeight / allClips.length;
    job.progressCallback(progress);
  }

  // Build FFmpeg complex filter for multi-track composition
  job.progressCallback(35);
  
  // Sort clips by timeline position
  const sortedClips = processedClips.sort((a, b) => a.clip.startTime - b.clip.startTime);
  
  // Calculate total timeline duration
  const maxEndTime = Math.max(...processedClips.map(c => c.clip.startTime + c.clip.duration));
  
  // Separate video/image and audio clips (images are treated as video)
  const videoClips = processedClips.filter(c => c.media.type === 'video' || c.media.type === 'image');
  const audioClips = processedClips.filter(c => c.media.type === 'audio');
  
  // Detect overlaps or if we need multi-track composition
  const hasOverlaps = detectOverlaps(videoClips);
  const needsMultiTrack = hasOverlaps || audioClips.length > 0 || videoClips.some(c => c.clip.position);

  if (needsMultiTrack) {
    return buildMultiTrackComposition(videoClips, audioClips, maxEndTime, resolution, outputPath, job, tempDir);
  } else {
    return buildSimpleComposition(sortedClips, audioClips, maxEndTime, outputPath, job, tempDir, mediaAssets);
  }
}

// Helper: Detect if any clips overlap
function detectOverlaps(clips: ClipProcessing[]): boolean {
  for (let i = 0; i < clips.length; i++) {
    for (let j = i + 1; j < clips.length; j++) {
      const clip1End = clips[i].clip.startTime + clips[i].clip.duration;
      const clip2End = clips[j].clip.startTime + clips[j].clip.duration;
      
      const overlapStart = Math.max(clips[i].clip.startTime, clips[j].clip.startTime);
      const overlapEnd = Math.min(clip1End, clip2End);
      
      if (overlapEnd > overlapStart) {
        return true;
      }
    }
  }
  return false;
}

// Build simple concatenation with audio mix
async function buildSimpleComposition(
  sortedClips: ClipProcessing[],
  audioClips: ClipProcessing[],
  maxEndTime: number,
  outputPath: string,
  job: ExportJob,
  tempDir: string,
  mediaAssets: MediaAsset[]
): Promise<void> {
  const fileListPath = path.join(tempDir, 'concat_list.txt');
  const fileList = sortedClips.map(c => `file '${c.tempFile.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(fileListPath, fileList);
  
  job.progressCallback(40);

  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(fileListPath)
      .inputOptions(['-f', 'concat', '-safe', '0']);

    // Add audio clips for mixing
    audioClips.forEach(audioClip => {
      command.input(audioClip.tempFile);
    });

    const crfValue = getCRFForQuality(job.quality);
    
    // Force re-encoding by scaling to target resolution
    // This ensures CRF quality settings are actually applied (concat demuxer can't optimize this away)
    command
      .videoFilters(`scale=${job.resolution.width}:${job.resolution.height}`)
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate('192k')
      .outputOptions('-preset', 'medium')
      .outputOptions('-crf', crfValue)
      .saveToFile(outputPath);

    command.on('start', () => {
    });

    command.on('end', () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
      job.progressCallback(100);
      resolve();
    });

    command.on('error', (err) => {
      console.error('❌ FFmpeg error:', err.message);
      fs.rmSync(tempDir, { recursive: true, force: true });
      reject(err);
    });

    const progressStartTime = Date.now();
    const estimatedDuration = maxEndTime;
    
    command.on('progress', (progress) => {
      let progressPercent = progress.percent;
      
      // FFmpeg progress is often undefined on Windows, estimate based on time
      if (!progressPercent && progress.timemark) {
        // Parse time string like "00:00:15.123"
        const timeParts = progress.timemark.split(':').map(parseFloat);
        const currentSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
        progressPercent = (currentSeconds / estimatedDuration) * 100;
      }
      
      // Fallback: estimate based on elapsed time
      if (!progressPercent) {
        const elapsedMs = Date.now() - progressStartTime;
        const estimatedTotalMs = estimatedDuration * 1000 * 2; // Rough estimate
        progressPercent = Math.min(95, (elapsedMs / estimatedTotalMs) * 100);
      }
      
      // Map FFmpeg progress: 40% -> 95% (save last 5% for finalization)
      const mappedProgress = 40 + (progressPercent || 0) * 0.55;
      job.progressCallback(mappedProgress);
    });
  });
}

// Build multi-track composition with overlays
async function buildMultiTrackComposition(
  videoClips: ClipProcessing[],
  audioClips: ClipProcessing[],
  maxEndTime: number,
  resolution: { width: number; height: number },
  outputPath: string,
  job: ExportJob,
  tempDir: string
): Promise<void> {
  // Sort video clips by track order first (lower track = on top), then by z-index, then by start time
  videoClips.sort((a, b) => {
    // Lower track order should be drawn last (on top)
    if (a.trackOrder !== b.trackOrder) return b.trackOrder - a.trackOrder;
    
    // Then sort by z-index
    const zA = a.clip.position?.zIndex ?? 0;
    const zB = b.clip.position?.zIndex ?? 0;
    if (zA !== zB) return zA - zB; // Lower z-index draws first (in background)
    
    return a.clip.startTime - b.clip.startTime;
  });

    job.progressCallback(40);

  return new Promise((resolve, reject) => {
    // First, check which clips have audio before building the filter
    Promise.all([
      ...videoClips.map(clip => hasAudioStream(clip.tempFile)),
      ...audioClips.map(clip => hasAudioStream(clip.tempFile))
    ]).then(async (audioFlags: boolean[]) => {
      // Convert hex color to RGB for FFmpeg (format: 0xRRGGBB)
      // Remove # if present and convert to RGB format
      const bgColor = job.canvasColor || '#000000';
      const hexColor = bgColor.replace('#', '');
      const r = parseInt(hexColor.substring(0, 2), 16);
      const g = parseInt(hexColor.substring(2, 4), 16);
      const b = parseInt(hexColor.substring(4, 6), 16);
      const colorValue = `0x${hexColor.toUpperCase()}`;
      
      // Create base canvas with custom background color
      const command = ffmpeg()
        .input(`color=${colorValue}:s=${resolution.width}x${resolution.height}:r=30`)
        .inputOptions(['-f', 'lavfi', '-t', maxEndTime.toString()]);

      // Add all video clips as inputs (these might have audio)
      videoClips.forEach(clip => {
        command.input(clip.tempFile);
      });

      // Add all audio-only clips as inputs
      audioClips.forEach(clip => {
        command.input(clip.tempFile);
      });

      // Build complex filter
      const filterParts: string[] = [];
      let currentOutput = '[0:v]';

      // Overlay each video at its timeline position
      videoClips.forEach((clip, idx) => {
        const inputIndex = idx + 1; // +1 because 0 is the black canvas
        const outputLabel = idx === videoClips.length - 1 ? 'vout' : `v${idx + 1}`;
        
        // Use enable filter to show clip only during its time range
        const startTime = clip.clip.startTime;
        const endTime = startTime + clip.clip.duration;
        
        // Check if clip has position (is an overlay on canvas)
        if (clip.clip.position) {
          const pos = clip.clip.position;
          
          // Calculate absolute pixel positions (clips stored as 0-1 normalized)
          const x = Math.round(pos.x * resolution.width);
          const y = Math.round(pos.y * resolution.height);
          const w = Math.round(pos.width * resolution.width);
          const h = Math.round(pos.height * resolution.height);
          
          // Build filter chain: scale → rotate (if needed) → overlay
          const transformedLabel = `transformed${idx}`;
          const scaleFilter = `scale=${w}:${h}`;
          
          // Calculate overlay position (may need adjustment for rotation)
          let overlayX = x;
          let overlayY = y;
          
          // Apply rotation if specified
          if (pos.rotation && pos.rotation !== 0) {
            // FFmpeg rotate filter: radians = degrees * PI / 180
            const radians = (pos.rotation * Math.PI) / 180;
            // Calculate output size to prevent clipping
            // When rotating by θ, need diagonal size: diagonal = sqrt(w² + h²)
            const diagonal = Math.sqrt(w * w + h * h);
            const ow = Math.ceil(diagonal);
            const oh = Math.ceil(diagonal);
            const rotationFilter = `rotate='${radians}':ow=${ow}:oh=${oh}:fillcolor=black@0`;
            
            // Adjust overlay position to keep center in same place
            // Original center: (x + w/2, y + h/2)
            // After rotation, expanded image center is at (ow/2, oh/2)
            // New overlay position: (x + w/2 - ow/2, y + h/2 - oh/2)
            overlayX = Math.round(x + w / 2 - ow / 2);
            overlayY = Math.round(y + h / 2 - oh / 2);
            
            filterParts.push(
              `[${inputIndex}:v]${scaleFilter},${rotationFilter}[${transformedLabel}]`
            );
          } else {
            filterParts.push(
              `[${inputIndex}:v]${scaleFilter}[${transformedLabel}]`
            );
          }
          
          // Overlay at position (adjusted for rotation if needed)
          const overlayFilter = `overlay=${overlayX}:${overlayY}:enable='between(t,${startTime},${endTime})'`;
          filterParts.push(
            `${currentOutput}[${transformedLabel}]${overlayFilter}[${outputLabel}]`
          );
        } else {
          // Full-screen clip (default behavior)
          filterParts.push(
            `${currentOutput}[${inputIndex}:v]overlay=enable='between(t,${startTime},${endTime})'[${outputLabel}]`
          );
        }
        
        currentOutput = `[${outputLabel}]`;
      });

      // Extract and mix all audio tracks with proper timing
      const audioDelayParts: string[] = [];
      const delayedAudioInputs: string[] = [];
      let audioDelayCounter = 0;

      // Process audio from video clips - ONLY IF THEY HAVE AUDIO
      videoClips.forEach((clip, i) => {
        if (!audioFlags[i]) {
          return;
        }

        const videoInputIndex = i + 1;
        const startTime = clip.clip.startTime;
        const startMs = Math.floor(startTime * 1000); // Convert to milliseconds

        // Delay audio to match timeline position - use |all=1 to delay all channels
        const delayedLabel = `adelayed${audioDelayCounter}`;
        audioDelayParts.push(`[${videoInputIndex}:a]adelay=${startMs}|all=1[${delayedLabel}]`);
        delayedAudioInputs.push(`[${delayedLabel}]`);
        audioDelayCounter++;
      });

      // Process audio-only clips - ONLY IF THEY HAVE AUDIO
      audioClips.forEach((clip, i) => {
        const audioIndex = videoClips.length + i;
        if (!audioFlags[audioIndex]) {
          return;
        }

        const audioInputIndex = audioIndex + 1;
        const startTime = clip.clip.startTime;
        const startMs = Math.floor(startTime * 1000); // Convert to milliseconds

        // Delay audio to match timeline position - use |all=1 to delay all channels
        const delayedLabel = `adelayed${audioDelayCounter}`;
        audioDelayParts.push(`[${audioInputIndex}:a]adelay=${startMs}|all=1[${delayedLabel}]`);
        delayedAudioInputs.push(`[${delayedLabel}]`);
        audioDelayCounter++;
      });
    
      // Add all delay filters
      if (audioDelayParts.length > 0) {
        filterParts.push(...audioDelayParts);
        
        // Mix all delayed audio streams
        filterParts.push(
          `${delayedAudioInputs.join('')}amix=inputs=${delayedAudioInputs.length}:duration=longest[aout]`
        );
      }

      const complexFilter = filterParts.join(';');

      // Determine if we have any audio outputs
      const hasAudioOutput = delayedAudioInputs.length > 0;

      const crfValue = getCRFForQuality(job.quality);
      
      command
        .complexFilter(complexFilter)
        .outputOptions([
          '-map', '[vout]',
          hasAudioOutput ? '-map' : '',
          hasAudioOutput ? '[aout]' : '',
          '-c:v', 'libx264',
          '-preset', 'medium', // Changed from 'slow' to 'medium' for faster exports (3-5x speed boost)
          '-crf', crfValue,
          ...(hasAudioOutput ? ['-c:a', 'aac', '-b:a', '192k'] : []),
          '-t', maxEndTime.toString(),
          '-ignore_unknown' // Handle missing audio streams gracefully
        ].filter(Boolean))
        .saveToFile(outputPath);

      command.on('start', () => {
      });

      command.on('end', () => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        job.progressCallback(100);
        resolve();
      });

      command.on('error', (err) => {
        console.error('❌ FFmpeg error:', err.message);
        console.error('Full error:', err);
        fs.rmSync(tempDir, { recursive: true, force: true });
        reject(err);
      });

      const progressStartTime = Date.now();
      const estimatedDuration = maxEndTime;
      
      command.on('progress', (progress) => {
        let progressPercent = progress.percent;
        
        // FFmpeg progress is often undefined on Windows, estimate based on time
        if (!progressPercent && progress.timemark) {
          // Parse time string like "00:00:15.123"
          const timeParts = progress.timemark.split(':').map(parseFloat);
          const currentSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
          progressPercent = (currentSeconds / estimatedDuration) * 100;
        }
        
        // Fallback: estimate based on elapsed time
        if (!progressPercent) {
          const elapsedMs = Date.now() - progressStartTime;
          const estimatedTotalMs = estimatedDuration * 1000 * 2; // Rough estimate
          progressPercent = Math.min(95, (elapsedMs / estimatedTotalMs) * 100);
        }
        
        // Map FFmpeg progress: 40% -> 95% (save last 5% for finalization)
        const mappedProgress = 40 + (progressPercent || 0) * 0.55;
        job.progressCallback(mappedProgress);
      });
    }).catch(err => {
      console.error('❌ Error during audio detection:', err);
      reject(err);
    });
  });
}

/**
 * Check if a media file has an audio stream
 */
async function hasAudioStream(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata) {
        resolve(false);
        return;
      }
      
      // Check if there are any audio streams
      const hasAudio = metadata.streams?.some(stream => stream.codec_type === 'audio') || false;
      resolve(hasAudio);
    });
  });
}

async function processClip(
  clip: TimelineClip,
  media: MediaAsset,
  resolution: { width: number; height: number },
  tempDir: string,
  trackOrder: number
): Promise<ClipProcessing> {
  const inputPath = media.path;
  const outputClip = path.join(tempDir, `clip_${clip.id}.mp4`);

  const startTime = clip.trimStart || 0;
  const duration = clip.duration;

  // Build FFmpeg command with filters
  const filters: string[] = [];
  const audioFilters: string[] = [];

  // For videos and images, ensure consistent format for filter graph
  // We apply a minimal filter to normalize pixel format and frame rate
  // but don't scale to full resolution - scaling happens in composition
  if (media.type === 'video') {
    filters.push('fps=30,format=yuv420p');
  } else if (media.type === 'image') {
    // For images, we need to ensure the output has valid dimensions
    // Use scale to ensure even dimensions (required for yuv420p)
    filters.push('scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p');
  }

  // Apply speed effect
  if (clip.speed && clip.speed !== 1) {
    // Video speed: adjust PTS (presentation timestamp)
    if (media.type === 'video') {
      filters.push(`setpts=${1/clip.speed}*PTS`);
    }

    // Audio speed: use atempo filter (must be between 0.5 and 2.0)
    // For speeds outside this range, chain multiple atempo filters
    let remainingSpeed = clip.speed;
    while (remainingSpeed > 2.0) {
      audioFilters.push('atempo=2.0');
      remainingSpeed /= 2.0;
    }
    while (remainingSpeed < 0.5) {
      audioFilters.push('atempo=0.5');
      remainingSpeed /= 0.5;
    }
    if (remainingSpeed !== 1.0) {
      audioFilters.push(`atempo=${remainingSpeed}`);
    }
  }

  // Apply fade effects
  if (clip.fadeIn > 0) {
    filters.push(`fade=in:0:${Math.floor(clip.fadeIn * 30)}`);
  }
  if (clip.fadeOut > 0) {
    // Calculate fade out start frame
    const fadeOutStart = Math.floor((duration - clip.fadeOut) * 30);
    filters.push(`fade=out:${fadeOutStart}:${Math.floor(clip.fadeOut * 30)}`);
  }

  return new Promise((resolve, reject) => {
    let command;

    // For images, we need to use loop input and set duration
    if (media.type === 'image') {
      // Create command with special input options for images
      command = ffmpeg()
        .input(inputPath)
        .inputOptions([
          '-loop', '1',           // Loop the image
          '-framerate', '30',     // Set framerate for the looped image
          '-t', duration.toString() // Duration at input level
        ]);
    } else {
      // For video/audio, use normal start time and duration
      command = ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration);
    }

    // Apply video filters (for videos and images to normalize format)
    if (filters.length > 0 && (media.type === 'video' || media.type === 'image')) {
      command.videoFilters(filters);
    }

    // Handle volume
    if (clip.volume && clip.volume !== 1) {
      audioFilters.push(`volume=${clip.volume}`);
    }

    // Apply audio filters if any
    if (audioFilters.length > 0) {
      command.audioFilters(audioFilters);
    }

    // Set output options
    command.format('mp4');

    // For images, we need to explicitly set video codec and disable audio
    if (media.type === 'image') {
      command
        .videoCodec('libx264')
        .outputOptions([
          '-preset', 'medium',
          '-crf', '23',
          '-an'  // Disable audio for images
        ]);
    } else if (media.type === 'video') {
      command.videoCodec('libx264');
    }

    command
      .saveToFile(outputClip)
      .on('start', () => {
      })
      .on('end', () => {
        resolve({ clip, media, tempFile: outputClip, trackOrder });
      })
      .on('error', (err) => {
        console.error(`   ❌ Processing failed:`, err.message);
        reject(err);
      });
  });
}
