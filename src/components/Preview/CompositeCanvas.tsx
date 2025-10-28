import { useRef, useEffect } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { useMediaStore } from '../../store/mediaStore';
import { pathToFileURL } from '../../utils/fileHandling';

interface CompositeCanvasProps {
  playheadPosition: number;
  isPlaying: boolean;
}

interface VideoLayer {
  clipId: string;
  videoElement: HTMLVideoElement;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export default function CompositeCanvas({ playheadPosition, isPlaying }: CompositeCanvasProps) {
  const { tracks } = useTimelineStore();
  const { getMediaById } = useMediaStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoLayersRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const seekingVideosRef = useRef<Set<string>>(new Set()); // Track which videos are seeking
  const videoFrameCallbacksRef = useRef<Map<string, number>>(new Map()); // Track video frame callbacks
  const pendingRenderRef = useRef<boolean>(false); // Track if we need to re-render after seek

  // Canvas dimensions
  const CANVAS_WIDTH = 1920;
  const CANVAS_HEIGHT = 1080;

  // Use refs to avoid dependencies causing re-renders
  const tracksRef = useRef(tracks);
  const getMediaByIdRef = useRef(getMediaById);
  
  useEffect(() => {
    tracksRef.current = tracks;
    getMediaByIdRef.current = getMediaById;
  }, [tracks, getMediaById]);
  
  // Get all clips at playhead - inline to avoid recreation issues
  const getClipsAtPlayhead = () => {
    const clips: Array<{ clip: any; media: any; trackOrder: number }> = [];

    tracksRef.current.forEach(track => {
      if (!track.visible) return;
      track.clips.forEach(clip => {
        if (playheadPosition >= clip.startTime && playheadPosition < clip.startTime + clip.duration) {
          const media = getMediaByIdRef.current(clip.assetId);
          if (media) {
            clips.push({ clip, media, trackOrder: track.order });
          }
        }
      });
    });

    // Sort by track order (lower = background, higher = foreground)
    return clips.sort((a, b) => a.trackOrder - b.trackOrder);
  };

  // Update video and audio elements based on tracks (not playhead!)
  useEffect(() => {
    // Get all clips from all tracks, not just at playhead
    const allClipIds = new Set<string>();
    const clipsToLoad: Array<{ clip: any; media: any }> = [];

    tracks.forEach(track => {
      if (!track.visible) return;
      track.clips.forEach(clip => {
        allClipIds.add(clip.id);
        const media = getMediaById(clip.assetId);
        if (media) {
          clipsToLoad.push({ clip, media });
        }
      });
    });

    // Create video and audio elements for all clips
    clipsToLoad.forEach(({ clip, media }) => {
      const fileUrl = pathToFileURL(media.path);

      // Setup video element
      if (media.type === 'video' || media.type === 'image') {
        if (!videoLayersRef.current.has(clip.id)) {
          const video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          video.muted = true; // Video muted, audio separate
          video.preload = 'auto';
          video.loop = false;
          
          // Track seeking state and trigger render when seek completes
          video.addEventListener('seeking', () => {
            seekingVideosRef.current.add(clip.id);
          });
          video.addEventListener('seeked', () => {
            seekingVideosRef.current.delete(clip.id);
            // Mark that we need to render after seek
            pendingRenderRef.current = true;
          });
          
          videoLayersRef.current.set(clip.id, video);
        }

        const video = videoLayersRef.current.get(clip.id)!;
        // CRITICAL: Always mute video to prevent double audio
        if (!video.muted) {
          video.muted = true;
        }
        if (video.src !== fileUrl && fileUrl) {
          video.src = fileUrl;
        }
      }

      // Setup audio element
      if (media.type === 'video' || media.type === 'audio') {
        if (!audioElementsRef.current.has(clip.id)) {
          const audio = new Audio();
          audio.preload = 'auto';
          audioElementsRef.current.set(clip.id, audio);
        }

        const audio = audioElementsRef.current.get(clip.id)!;
        if (audio.src !== fileUrl && fileUrl) {
          audio.src = fileUrl;
        }
      }
    });

    // Cleanup unused elements
    videoLayersRef.current.forEach((video, id) => {
      if (!allClipIds.has(id)) {
        video.pause();
        video.src = '';
        videoLayersRef.current.delete(id);
      }
    });

    audioElementsRef.current.forEach((audio, id) => {
      if (!allClipIds.has(id)) {
        audio.pause();
        audio.src = '';
        audioElementsRef.current.delete(id);
      }
    });
  }, [tracks, getMediaById]); // Only run when tracks change, NOT playhead!

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const clipsAtPlayhead = getClipsAtPlayhead();
      
      // Check if any videos completed seeking
      if (pendingRenderRef.current) {
        pendingRenderRef.current = false;
      }

      // First: IMMEDIATELY pause ALL clips not at current playhead
      const currentClipIds = new Set(clipsAtPlayhead.map(c => c.clip.id));
      
      videoLayersRef.current.forEach((video, clipId) => {
        if (!currentClipIds.has(clipId) && !video.paused) {
          video.pause();
        }
      });
      
      audioElementsRef.current.forEach((audio, clipId) => {
        if (!currentClipIds.has(clipId) && !audio.paused) {
          audio.pause();
        }
      });

      // Then: Sync and play ONLY clips at current playhead
      clipsAtPlayhead.forEach(({ clip, media }) => {
        const fileUrl = pathToFileURL(media.path);
        const timeInClip = playheadPosition - clip.startTime;
        const actualTime = clip.trimStart + timeInClip;

        // Sync video time
        if (media.type === 'video' || media.type === 'image') {
          const video = videoLayersRef.current.get(clip.id);
          if (video) {
            // CRITICAL: Ensure video is always muted to prevent double audio
            if (!video.muted) {
              video.muted = true;
            }
            
            // Seek threshold - larger when paused to avoid constant seeking during scrubbing
            // This allows the video to actually decode frames
            const seekThreshold = isPlaying ? 0.15 : 0.1; // 100ms when paused = less seeking, more drawing
            const timeDiff = Math.abs(video.currentTime - actualTime);
            
            if (timeDiff > seekThreshold) {
              video.currentTime = actualTime;
            }
            
            video.playbackRate = clip.speed;
            
            // Control playback state
            if (isPlaying) {
              if (video.paused) {
                video.play().catch(() => {});
              }
            } else {
              // When paused, ensure video is paused
              if (!video.paused) {
                video.pause();
              }
            }
          }
        }

        // Sync audio time
        if (media.type === 'video' || media.type === 'audio') {
          const audio = audioElementsRef.current.get(clip.id);
          if (audio) {
            if (isPlaying) {
              const seekThreshold = 0.15;
              if (Math.abs(audio.currentTime - actualTime) > seekThreshold) {
                audio.currentTime = actualTime;
              }
              
              audio.playbackRate = clip.speed;
              audio.volume = clip.volume;
              
              if (audio.paused) {
                audio.play().catch(() => {});
              }
            } else if (!isPlaying) {
              // When paused, pause audio (don't play it while scrubbing)
              if (!audio.paused) {
                audio.pause();
              }
            }
          }
        }
      });

      // Draw each video layer
      clipsAtPlayhead.forEach(({ clip, media, trackOrder }) => {
        const video = videoLayersRef.current.get(clip.id);
        
        // Only draw if video exists and has metadata
        // ReadyState 1 = HAVE_METADATA (enough to know dimensions and draw)
        // During seeking, video might not have readyState 2 yet, but we can still draw the last frame
        if (!video || video.readyState < 1 || !video.videoWidth || !video.videoHeight) {
          return;
        }

        // Check if clip has position (overlay)
        if (clip.position) {
          const { x, y, width, height, rotation } = clip.position;
          
          // Convert from 0-1 percentages to actual pixels
          const actualX = x * CANVAS_WIDTH;
          const actualY = y * CANVAS_HEIGHT;
          const actualWidth = width * CANVAS_WIDTH;
          const actualHeight = height * CANVAS_HEIGHT;
          
          // Handle rotation if specified
          if (rotation && rotation !== 0) {
            ctx.save();
            const centerX = actualX + actualWidth / 2;
            const centerY = actualY + actualHeight / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.drawImage(video, -actualWidth / 2, -actualHeight / 2, actualWidth, actualHeight);
            ctx.restore();
          } else {
            ctx.drawImage(video, actualX, actualY, actualWidth, actualHeight);
          }
        } else {
          // Full canvas - maintain aspect ratio
          const videoAspect = video.videoWidth / video.videoHeight;
          const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT;

          let drawWidth, drawHeight, drawX, drawY;

          if (videoAspect > canvasAspect) {
            drawWidth = CANVAS_WIDTH;
            drawHeight = CANVAS_WIDTH / videoAspect;
            drawX = 0;
            drawY = (CANVAS_HEIGHT - drawHeight) / 2;
          } else {
            drawHeight = CANVAS_HEIGHT;
            drawWidth = CANVAS_HEIGHT * videoAspect;
            drawX = (CANVAS_WIDTH - drawWidth) / 2;
            drawY = 0;
          }

          ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
        }
      });

      // Always request next frame for smooth rendering - 60fps for smooth scrubbing
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playheadPosition, isPlaying]); // Remove tracks and getMediaById - they trigger infinite loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      videoLayersRef.current.forEach(video => {
        video.pause();
        video.src = '';
      });
      audioElementsRef.current.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      videoLayersRef.current.clear();
      audioElementsRef.current.clear();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="max-w-full max-h-full object-contain"
      style={{ backgroundColor: 'black' }}
    />
  );
}
