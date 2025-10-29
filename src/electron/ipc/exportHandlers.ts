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

interface ExportJob {
  tracks: Track[];
  mediaAssets: MediaAsset[];
  outputPath: string;
  resolution: { width: number; height: number };
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
  ipcMain.handle('export:start', async (event, tracks: Track[], mediaAssets: MediaAsset[], outputPath: string, resolution: string) => {
    console.log('🚀 Starting export...', { outputPath, resolution });
    console.log(`📊 Exporting ${tracks.length} tracks with ${mediaAssets.length} media assets`);

    // Map resolution string to dimensions
    const resolutionMap: Record<string, { width: number; height: number }> = {
      '720p': { width: 1280, height: 720 },
      '1080p': { width: 1920, height: 1080 },
      '4k': { width: 3840, height: 2160 },
      'source': { width: 1920, height: 1080 } // Default
    };

    const res = resolutionMap[resolution] || resolutionMap['1080p'];

    try {
      await exportTimeline({
        tracks,
        mediaAssets,
        outputPath,
        resolution: res,
        progressCallback: (progress) => {
          // console.log(`📈 Export progress: ${progress}%`);
          // Send progress to renderer
          event.sender.send('export:progress', progress);
        }
      });

      console.log('✅ Export complete!');
      return { success: true };
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  });
}

async function exportTimeline(job: ExportJob): Promise<void> {
  const { tracks, mediaAssets, outputPath, resolution } = job;
  
  // Get all video/audio clips from all tracks
  const allClips: Array<{ clip: TimelineClip; media: MediaAsset; trackOrder: number }> = [];
  
  tracks.forEach(track => {
    track.clips.forEach(clip => {
      const media = mediaAssets.find(a => a.id === clip.assetId);
      if (media && (media.type === 'video' || media.type === 'audio')) {
        allClips.push({ clip, media, trackOrder: track.order });
      }
    });
  });

  if (allClips.length === 0) {
    throw new Error('No clips found on timeline');
  }

  console.log(`\n==========================`);
  console.log(`📹 EXPORT SUMMARY`);
  console.log(`==========================`);
  console.log(`Total tracks: ${tracks.length}`);
  console.log(`Total clips to export: ${allClips.length}`);
  
  // Show what we're exporting
  tracks.forEach((track, idx) => {
    console.log(`\nTrack ${idx + 1} (Order: ${track.order}):`);
    track.clips.forEach((clip, clipIdx) => {
      const media = mediaAssets.find(a => a.id === clip.assetId);
      if (media) {
        console.log(`  Clip ${clipIdx + 1}: ${media.name}`);
        console.log(`    Start: ${clip.startTime}s, Duration: ${clip.duration}s`);
        console.log(`    Type: ${media.type}`);
        if (clip.position) {
          console.log(`    Position: x=${clip.position.x}, y=${clip.position.y}, w=${clip.position.width}, h=${clip.position.height}`);
        }
      }
    });
  });
  console.log(`\n==========================\n`);
  
  // Process each clip: trim, apply effects, save to temp file
  const tempDir = path.join(os.tmpdir(), 'freya-export-' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });
  console.log(`📁 Created temp directory: ${tempDir}`);

  // Send initial progress
  job.progressCallback(5);

  const processedClips: ClipProcessing[] = [];

  // Process each clip
  const clipProcessProgressWeight = 30; // 5% -> 35%
  for (let i = 0; i < allClips.length; i++) {
    const { clip, media, trackOrder } = allClips[i];
    console.log(`\n🎬 Processing clip ${i + 1}/${allClips.length}:`);
    console.log(`   File: ${media.name}`);
    console.log(`   From: ${clip.startTime}s`);
    console.log(`   Duration: ${clip.duration}s`);
    console.log(`   Speed: ${clip.speed}x`);
    console.log(`   Volume: ${clip.volume}`);
    
    const processedClip = await processClip(clip, media, resolution, tempDir, trackOrder);
    processedClips.push(processedClip);
    
    // Update progress (5% -> 35%)
    const progress = 5 + (i + 1) * clipProcessProgressWeight / allClips.length;
    job.progressCallback(progress);
    console.log(`   ✅ Clip ${i + 1} processed → temp file: ${processedClip.tempFile}`);
  }

  // Build FFmpeg complex filter for multi-track composition
  console.log('\n🔗 Analyzing timeline structure...');
  job.progressCallback(35);
  
  // Sort clips by timeline position
  const sortedClips = processedClips.sort((a, b) => a.clip.startTime - b.clip.startTime);
  
  // Calculate total timeline duration
  const maxEndTime = Math.max(...processedClips.map(c => c.clip.startTime + c.clip.duration));
  console.log(`\n⏱️  Timeline duration: ${maxEndTime.toFixed(2)}s`);
  
  // Separate video and audio clips
  const videoClips = processedClips.filter(c => c.media.type === 'video');
  const audioClips = processedClips.filter(c => c.media.type === 'audio');
  
  console.log(`\n📊 COMPOSITION ANALYSIS:`);
  console.log(`   Video clips: ${videoClips.length}`);
  console.log(`   Audio clips: ${audioClips.length}`);
  
  // Detect overlaps
  const hasOverlaps = detectOverlaps(videoClips);
  
  if (hasOverlaps) {
    console.log(`   ✅ OVERLAPPING CLIPS DETECTED - Using multi-track overlay composition`);
    return buildMultiTrackComposition(videoClips, audioClips, maxEndTime, resolution, outputPath, job, tempDir);
  } else {
    console.log(`   ✓ No overlapping clips - Using simple concatenation with audio mix`);
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
        const m1 = clips[i].media;
        const m2 = clips[j].media;
        console.log(`   • "${m1.name}" overlaps with "${m2.name}" (${(overlapEnd - overlapStart).toFixed(2)}s overlap)`);
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
  console.log(`\n📝 FINAL VIDEO SEQUENCE:`);
  console.log(`Sequential clips:`);
  sortedClips.forEach((c, idx) => {
    const media = mediaAssets.find(a => a.id === c.clip.assetId);
    console.log(`  ${idx + 1}. ${media?.name} - ${c.clip.startTime}s (${c.clip.duration}s)`);
  });

  const fileListPath = path.join(tempDir, 'concat_list.txt');
  const fileList = sortedClips.map(c => `file '${c.tempFile.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(fileListPath, fileList);
  
  console.log(`\n🎥 Starting FFmpeg encoding to: ${outputPath}`);
  job.progressCallback(40);

  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(fileListPath)
      .inputOptions(['-f', 'concat', '-safe', '0']);

    // Add audio clips for mixing
    audioClips.forEach(audioClip => {
      console.log(`   🎵 Adding audio track: ${audioClip.media.name}`);
      command.input(audioClip.tempFile);
    });

    command
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate('192k')
      .outputOptions(['-preset', 'medium', '-crf', '20']) // Changed from 'slow' to 'medium' for faster exports
      .saveToFile(outputPath);

    command.on('start', (cmdLine) => {
      console.log('🔥 FFmpeg command:', cmdLine);
    });

    command.on('end', () => {
      console.log('✅ Export complete!');
      console.log(`📁 Output saved to: ${outputPath}`);
      fs.rmSync(tempDir, { recursive: true, force: true });
      job.progressCallback(100);
      resolve();
    });

    command.on('error', (err) => {
      console.error('❌ FFmpeg error:', err.message);
      fs.rmSync(tempDir, { recursive: true, force: true });
      reject(err);
    });

    let progressStartTime = Date.now();
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
      // console.log(`⏳ FFmpeg progress: ${progressPercent?.toFixed(1) || 'unknown'}%`);
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
  console.log(`\n🎬 BUILDING MULTI-TRACK COMPOSITION:`);
  
  // Sort video clips by track order first (higher track = on top), then by z-index, then by start time
  videoClips.sort((a, b) => {
    // Higher track order should be drawn last (on top)
    if (a.trackOrder !== b.trackOrder) return a.trackOrder - b.trackOrder;
    
    // Then sort by z-index
    const zA = a.clip.position?.zIndex ?? 0;
    const zB = b.clip.position?.zIndex ?? 0;
    if (zA !== zB) return zA - zB; // Lower z-index draws first (in background)
    
    return a.clip.startTime - b.clip.startTime;
  });
  
  console.log(`\nVideo timeline:`);
  videoClips.forEach((c, idx) => {
    const endTime = c.clip.startTime + c.clip.duration;
    console.log(`  ${idx + 1}. ${c.media.name}: ${c.clip.startTime.toFixed(2)}s → ${endTime.toFixed(2)}s`);
  });
  
  if (audioClips.length > 0) {
    console.log(`\nAudio tracks:`);
    audioClips.forEach((c, idx) => {
      const endTime = c.clip.startTime + c.clip.duration;
      console.log(`  ${idx + 1}. ${c.media.name}: ${c.clip.startTime.toFixed(2)}s → ${endTime.toFixed(2)}s`);
    });
  }

    job.progressCallback(40);

  return new Promise((resolve, reject) => {
    // First, check which clips have audio before building the filter
    Promise.all([
      ...videoClips.map(clip => hasAudioStream(clip.tempFile)),
      ...audioClips.map(clip => hasAudioStream(clip.tempFile))
    ]).then(async (audioFlags: boolean[]) => {
      console.log(`\n🔍 Audio detection complete`);
      console.log(`   Video clips with audio: ${audioFlags.slice(0, videoClips.length).filter(Boolean).length}/${videoClips.length}`);
      console.log(`   Audio-only clips with audio: ${audioFlags.slice(videoClips.length).filter(Boolean).length}/${audioClips.length}`);

      // Create base canvas (black background)
      const command = ffmpeg()
        .input(`color=black:s=${resolution.width}x${resolution.height}:r=30`)
        .inputOptions(['-f', 'lavfi', '-t', maxEndTime.toString()]);

      // Add all video clips as inputs (these might have audio)
      videoClips.forEach(clip => {
        command.input(clip.tempFile);
      });

      // Add all audio-only clips as inputs
      audioClips.forEach(clip => {
        command.input(clip.tempFile);
      });
      
      console.log(`\n📥 Input structure:
        Input 0: Black canvas
        Video inputs: ${videoClips.length} (may have audio)
        Audio-only inputs: ${audioClips.length}`);

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
          
          console.log(`   📐 Clip: ${clip.media.name}`);
          console.log(`      Normalized: x=${pos.x.toFixed(4)}, y=${pos.y.toFixed(4)}, w=${pos.width.toFixed(4)}, h=${pos.height.toFixed(4)}`);
          console.log(`      Absolute: x=${x}, y=${y}, w=${w}, h=${h} (out of ${resolution.width}x${resolution.height})`);
          console.log(`      Rotation: ${pos.rotation?.toFixed(2) || 0}°`);
          console.log(`      Track Order: ${clip.trackOrder}, Time: ${startTime.toFixed(2)}s`);
          
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
            
            console.log(`      🔄 Rotation adjustment: center (${x + w/2}, ${y + h/2}) → overlay (${overlayX}, ${overlayY})`);
            
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
          console.log(`   ⚠️  Skipping audio for ${clip.media.name} (no audio stream)`);
          return;
        }

        const videoInputIndex = i + 1;
        const startTime = clip.clip.startTime;
        const startMs = Math.floor(startTime * 1000); // Convert to milliseconds

        console.log(`   🎵 Video audio ${i + 1}: ${clip.media.name} - delay by ${startTime.toFixed(3)}s (${startMs}ms)`);

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
          console.log(`   ⚠️  Skipping audio for ${clip.media.name} (no audio stream)`);
          return;
        }

        const audioInputIndex = audioIndex + 1;
        const startTime = clip.clip.startTime;
        const startMs = Math.floor(startTime * 1000); // Convert to milliseconds

        console.log(`   🎵 Audio clip ${i + 1}: ${clip.media.name} - delay by ${startTime.toFixed(3)}s (${startMs}ms)`);

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
      console.log(`\n🔧 FFmpeg filter: ${complexFilter.substring(0, 200)}...`);

      // Determine if we have any audio outputs
      const hasAudioOutput = delayedAudioInputs.length > 0;

      command
        .complexFilter(complexFilter)
        .outputOptions([
          '-map', '[vout]',
          hasAudioOutput ? '-map' : '',
          hasAudioOutput ? '[aout]' : '',
          '-c:v', 'libx264',
          '-preset', 'medium', // Changed from 'slow' to 'medium' for faster exports (3-5x speed boost)
          '-crf', '20', // Changed from 18 to 20 for faster encoding with minimal quality loss
          ...(hasAudioOutput ? ['-c:a', 'aac', '-b:a', '192k'] : []),
          '-t', maxEndTime.toString(),
          '-ignore_unknown' // Handle missing audio streams gracefully
        ].filter(Boolean))
        .saveToFile(outputPath);

      command.on('start', (cmdLine) => {
        console.log('🔥 FFmpeg command:', cmdLine);
      });

      command.on('end', () => {
        console.log('✅ Export complete!');
        console.log(`📁 Output saved to: ${outputPath}`);
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

      let progressStartTime = Date.now();
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
        // console.log(`⏳ FFmpeg progress: ${progressPercent?.toFixed(1) || 'unknown'}%`);
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
        console.log(`⚠️  Could not probe ${path.basename(filePath)} for audio:`, err?.message || 'Unknown error');
        resolve(false);
        return;
      }
      
      // Check if there are any audio streams
      const hasAudio = metadata.streams?.some(stream => stream.codec_type === 'audio') || false;
      console.log(`   🎵 ${path.basename(filePath)} has audio: ${hasAudio}`);
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
  console.log(`\n🎬 Processing: ${media.name}`);
  console.log(`   Type: ${media.type}`);
  console.log(`   Duration: ${clip.duration}s`);
  console.log(`   Speed: ${clip.speed}x, Volume: ${clip.volume}`);

  const inputPath = media.path;
  const outputClip = path.join(tempDir, `clip_${clip.id}.mp4`);

  const startTime = clip.trimStart || 0;
  const duration = clip.duration;

  // Build FFmpeg command with filters
  const filters: string[] = [];
  const audioFilters: string[] = [];

  // Scale to target resolution
  if (media.type === 'video') {
    filters.push(`scale=${resolution.width}:${resolution.height}`);
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
    const command = ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration);

    if (filters.length > 0) {
      command.videoFilters(filters);
    } else if (media.type === 'video') {
      // Just scale if no effects
      command.videoFilters([`scale=${resolution.width}:${resolution.height}`]);
    }

    // Handle volume
    if (clip.volume && clip.volume !== 1) {
      audioFilters.push(`volume=${clip.volume}`);
    }

    // Apply audio filters if any
    if (audioFilters.length > 0) {
      command.audioFilters(audioFilters);
    }

    command
      .format('mp4')
      .saveToFile(outputClip)
      .on('end', () => {
        resolve({ clip, media, tempFile: outputClip, trackOrder });
      })
      .on('error', reject);
  });
}
