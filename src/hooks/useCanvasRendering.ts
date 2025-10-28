import { useRef, useEffect } from 'react';
import { useTimelineStore } from '../store/timelineStore';
import { useMediaStore } from '../store/mediaStore';
import { pathToFileURL } from '../utils/fileHandling';
import { drawVideoHighQuality } from '../utils/canvasDrawing';

interface UseCanvasRenderingProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  playheadPosition: number;
  isPlaying: boolean;
  showGrid: boolean;
  canvasColor: string;
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
  RENDER_SCALE: number;
}

/**
 * Hook that manages canvas rendering, video/audio sync, and the render loop
 */
export const useCanvasRendering = ({
  canvasRef,
  playheadPosition,
  isPlaying,
  showGrid,
  canvasColor,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RENDER_SCALE,
}: UseCanvasRenderingProps) => {
  const { tracks, selectedClipIds } = useTimelineStore();
  const { getMediaById } = useMediaStore();

  // Video/audio element refs
  const videoLayersRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const seekingVideosRef = useRef<Set<string>>(new Set());
  const pendingRenderRef = useRef<boolean>(false);

  // Performance optimization: Cache temporary canvases for step-down scaling
  const tempCanvasCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  // Track previous render state to skip unnecessary re-renders
  const lastRenderStateRef = useRef<{
    playheadPosition: number;
    clipStates: string;
    isPlaying: boolean;
  } | null>(null);

  // FPS tracking
  const fpsRef = useRef<number>(0);
  const fpsDisplayRef = useRef<HTMLDivElement>(null);
  const fpsFrameTimesRef = useRef<number[]>([]);
  const lastFpsUpdateRef = useRef<number>(Date.now());

  // Animation frame ref
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Use refs to avoid dependencies causing re-renders
  const tracksRef = useRef(tracks);
  const getMediaByIdRef = useRef(getMediaById);
  const selectedClipIdsRef = useRef(selectedClipIds);

  useEffect(() => {
    tracksRef.current = tracks;
    getMediaByIdRef.current = getMediaById;
    selectedClipIdsRef.current = selectedClipIds;
  }, [tracks, getMediaById, selectedClipIds]);

  // Get all clips at playhead
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

  // Update video and audio elements based on tracks
  useEffect(() => {
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
            video.muted = true;
            video.preload = 'auto';
            video.loop = false;

            video.addEventListener('seeking', () => {
              seekingVideosRef.current.add(clip.id);
            });
            video.addEventListener('seeked', () => {
              seekingVideosRef.current.delete(clip.id);
              pendingRenderRef.current = true;
            });

            // Force a render when video metadata is loaded (for first render)
            video.addEventListener('loadedmetadata', () => {
              pendingRenderRef.current = true;
            });

            videoLayersRef.current.set(clip.id, video);
          }

        const video = videoLayersRef.current.get(clip.id)!;
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
  }, [tracks, getMediaById]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: false,
      desynchronized: true,
    });
    if (!ctx) return;

    // Scale the context to render at higher resolution
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);

    // Enable high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalCompositeOperation = 'source-over';

    const render = () => {
      // FPS calculation
      const now = performance.now();
      fpsFrameTimesRef.current.push(now);

      if (fpsFrameTimesRef.current.length > 60) {
        fpsFrameTimesRef.current.shift();
      }

      // Update FPS display every 500ms
      if (now - lastFpsUpdateRef.current > 500) {
        if (fpsFrameTimesRef.current.length > 1) {
          const frameCount = fpsFrameTimesRef.current.length - 1;
          const timeDiff = fpsFrameTimesRef.current[fpsFrameTimesRef.current.length - 1] - fpsFrameTimesRef.current[0];
          const currentFps = Math.round((frameCount / timeDiff) * 1000);
          fpsRef.current = currentFps;

          if (fpsDisplayRef.current) {
            fpsDisplayRef.current.textContent = `${currentFps} FPS`;
          }
        }
        lastFpsUpdateRef.current = now;
      }

      const clipsAtPlayhead = getClipsAtPlayhead();

      // Skip re-render if nothing changed (when not playing and not dragging)
      // BUT: Always render the first frame, or when pending render is set
      const isFirstRender = !lastRenderStateRef.current;
      
      if (!isPlaying && !isFirstRender && !pendingRenderRef.current) {
        const currentClipStates = JSON.stringify(
          clipsAtPlayhead.map(({ clip }) => ({
            id: clip.id,
            position: clip.position,
            rotation: clip.position?.rotation || 0,
          }))
        );

        const currentState = {
          playheadPosition,
          clipStates: currentClipStates,
          isPlaying,
        };

        const shouldRender =
          lastRenderStateRef.current.playheadPosition !== currentState.playheadPosition ||
          lastRenderStateRef.current.clipStates !== currentState.clipStates ||
          lastRenderStateRef.current.isPlaying !== currentState.isPlaying ||
          seekingVideosRef.current.size > 0;

        if (!shouldRender) {
          animationFrameRef.current = requestAnimationFrame(render);
          return;
        }

        lastRenderStateRef.current = currentState;
      } else if (isFirstRender) {
        // Initialize state on first render
        lastRenderStateRef.current = {
          playheadPosition,
          clipStates: '',
          isPlaying,
        };
      }

      // Clear canvas with background color
      ctx.fillStyle = canvasColor;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw canvas border
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, CANVAS_WIDTH - 2, CANVAS_HEIGHT - 2);

      // Draw grid overlay
      if (showGrid) {
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;

        for (let x = 10; x < CANVAS_WIDTH; x += 10) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, CANVAS_HEIGHT);
          ctx.stroke();
        }

        for (let y = 10; y < CANVAS_HEIGHT; y += 10) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(CANVAS_WIDTH, y);
          ctx.stroke();
        }
      }

      // Pause clips not at current playhead
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

      // Sync and play clips at current playhead
      clipsAtPlayhead.forEach(({ clip, media }) => {
        const timeInClip = playheadPosition - clip.startTime;
        const actualTime = clip.trimStart + timeInClip;

        // Sync video time
        if (media.type === 'video' || media.type === 'image') {
          const video = videoLayersRef.current.get(clip.id);
          if (video) {
            if (!video.muted) {
              video.muted = true;
            }

            const seekThreshold = isPlaying ? 0.15 : 0.1;
            const timeDiff = Math.abs(video.currentTime - actualTime);

            if (timeDiff > seekThreshold) {
              video.currentTime = actualTime;
            }

            video.playbackRate = clip.speed;

            if (isPlaying) {
              if (video.paused) {
                video.play().catch(() => {});
              }
            } else {
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
            } else {
              if (!audio.paused) {
                audio.pause();
              }
            }
          }
        }
      });

      // Mark that we rendered after seek
      if (pendingRenderRef.current) {
        pendingRenderRef.current = false;
      }

      // Draw each video layer
      clipsAtPlayhead.forEach(({ clip, media }) => {
        const video = videoLayersRef.current.get(clip.id);

        if (!video || video.readyState < 1 || !video.videoWidth || !video.videoHeight) {
          return;
        }

        if (clip.position) {
          const { x, y, width, height, rotation } = clip.position;
          const actualX = x * CANVAS_WIDTH;
          const actualY = y * CANVAS_HEIGHT;
          const actualWidth = width * CANVAS_WIDTH;
          const actualHeight = height * CANVAS_HEIGHT;

          if (rotation && rotation !== 0) {
            ctx.save();
            const centerX = actualX + actualWidth / 2;
            const centerY = actualY + actualHeight / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((rotation * Math.PI) / 180);
            drawVideoHighQuality(ctx, video, -actualWidth / 2, -actualHeight / 2, actualWidth, actualHeight, clip.id, tempCanvasCacheRef.current);
            ctx.restore();
          } else {
            drawVideoHighQuality(ctx, video, actualX, actualY, actualWidth, actualHeight, clip.id, tempCanvasCacheRef.current);
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

          drawVideoHighQuality(ctx, video, drawX, drawY, drawWidth, drawHeight, clip.id, tempCanvasCacheRef.current);
        }
      });

      // Draw selection outlines
      clipsAtPlayhead.forEach(({ clip }) => {
        if (clip.position && selectedClipIdsRef.current.includes(clip.id)) {
          const { x, y, width, height, rotation = 0 } = clip.position;
          const actualX = x * CANVAS_WIDTH;
          const actualY = y * CANVAS_HEIGHT;
          const actualWidth = width * CANVAS_WIDTH;
          const actualHeight = height * CANVAS_HEIGHT;

          ctx.save();

          if (rotation !== 0) {
            const centerX = actualX + actualWidth / 2;
            const centerY = actualY + actualHeight / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((rotation * Math.PI) / 180);

            ctx.strokeStyle = '#8B5CF6';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(-actualWidth / 2, -actualHeight / 2, actualWidth, actualHeight);

            const handleSize = 14;
            ctx.fillStyle = '#8B5CF6';
            ctx.fillRect(-actualWidth / 2 - handleSize / 2, -actualHeight / 2 - handleSize / 2, handleSize, handleSize);
            ctx.fillRect(actualWidth / 2 - handleSize / 2, -actualHeight / 2 - handleSize / 2, handleSize, handleSize);
            ctx.fillRect(-actualWidth / 2 - handleSize / 2, actualHeight / 2 - handleSize / 2, handleSize, handleSize);
            ctx.fillRect(actualWidth / 2 - handleSize / 2, actualHeight / 2 - handleSize / 2, handleSize, handleSize);

            ctx.beginPath();
            ctx.arc(0, -actualHeight / 2 - 15, 10, 0, 2 * Math.PI);
            ctx.fill();
          } else {
            ctx.strokeStyle = '#8B5CF6';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(actualX, actualY, actualWidth, actualHeight);

            const handleSize = 14;
            ctx.fillStyle = '#8B5CF6';
            ctx.fillRect(actualX - handleSize / 2, actualY - handleSize / 2, handleSize, handleSize);
            ctx.fillRect(actualX + actualWidth - handleSize / 2, actualY - handleSize / 2, handleSize, handleSize);
            ctx.fillRect(actualX - handleSize / 2, actualY + actualHeight - handleSize / 2, handleSize, handleSize);
            ctx.fillRect(actualX + actualWidth - handleSize / 2, actualY + actualHeight - handleSize / 2, handleSize, handleSize);

            ctx.beginPath();
            ctx.arc(actualX + actualWidth / 2, actualY - 15, 10, 0, 2 * Math.PI);
            ctx.fill();
          }

          ctx.restore();
        }
      });

      // Draw dimension label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${CANVAS_WIDTH}×${CANVAS_HEIGHT}`, 10, 10);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playheadPosition, isPlaying, showGrid, canvasColor, canvasRef, CANVAS_WIDTH, CANVAS_HEIGHT, RENDER_SCALE]);

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
      tempCanvasCacheRef.current.clear();
    };
  }, []);

  return { fpsDisplayRef };
};
