import { useRef, useEffect, useState } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { useMediaStore } from '../../store/mediaStore';
import type { TimelineClip } from '../../types/timeline';

interface CompositePreviewProps {
  playheadPosition: number;
  isPlaying: boolean;
}

interface ClipLayer {
  clip: TimelineClip;
  mediaPath: string;
  mediaType: 'video' | 'audio' | 'image';
  trackOrder: number;
  timeInClip: number;
  actualTime: number;
}

export default function CompositePreview({ playheadPosition, isPlaying }: CompositePreviewProps) {
  const { tracks } = useTimelineStore();
  const { getMediaById } = useMediaStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layers, setLayers] = useState<ClipLayer[]>([]);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map<string, HTMLVideoElement>());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map<string, HTMLAudioElement>());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map<string, HTMLImageElement>());
  const animationFrameRef = useRef<number>();

  // Find all clips at current playhead position
  useEffect(() => {
    const visibleLayers: ClipLayer[] = [];

    tracks.forEach(track => {
      if (!track.visible) return;

      track.clips.forEach(clip => {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;

        if (playheadPosition >= clipStart && playheadPosition < clipEnd) {
          const media = getMediaById(clip.assetId);
          if (!media) return;

          const timeInClip = playheadPosition - clip.startTime;
          const actualTime = clip.trimStart + timeInClip;

          visibleLayers.push({
            clip,
            mediaPath: media.path,
            mediaType: media.type,
            trackOrder: track.order,
            timeInClip,
            actualTime
          });
        }
      });
    });

    // Sort by track order (lower order = background, higher = foreground)
    visibleLayers.sort((a, b) => a.trackOrder - b.trackOrder);
    setLayers(visibleLayers);
  }, [playheadPosition, tracks, getMediaById]);

  // Manage video and audio elements for all layers
  useEffect(() => {
    const currentClipIds = new Set(layers.map(l => l.clip.id));

    // Create or update elements for current layers
    layers.forEach(layer => {
      const fileUrl = `file:///${layer.mediaPath.replace(/\\/g, '/')}`;

      if (layer.mediaType === 'video') {
        // Video element (for visual)
        if (!videoElementsRef.current.has(layer.clip.id)) {
          const video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          video.preload = 'auto';
          video.muted = true; // Mute video element, use separate audio element
          videoElementsRef.current.set(layer.clip.id, video);
        }

        const video = videoElementsRef.current.get(layer.clip.id)!;
        if (video.src !== fileUrl) {
          video.src = fileUrl;
        }
        video.currentTime = layer.actualTime;
        video.playbackRate = layer.clip.speed;

        if (isPlaying) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }

        // Separate audio element for video's audio
        if (!audioElementsRef.current.has(layer.clip.id)) {
          const audio = document.createElement('audio');
          audio.crossOrigin = 'anonymous';
          audio.preload = 'auto';
          audioElementsRef.current.set(layer.clip.id, audio);
        }

        const audio = audioElementsRef.current.get(layer.clip.id)!;
        if (audio.src !== fileUrl) {
          audio.src = fileUrl;
        }
        audio.currentTime = layer.actualTime;
        audio.playbackRate = layer.clip.speed;
        audio.volume = layer.clip.volume;

        if (isPlaying) {
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      } else if (layer.mediaType === 'audio') {
        // Pure audio track
        if (!audioElementsRef.current.has(layer.clip.id)) {
          const audio = document.createElement('audio');
          audio.crossOrigin = 'anonymous';
          audio.preload = 'auto';
          audioElementsRef.current.set(layer.clip.id, audio);
        }

        const audio = audioElementsRef.current.get(layer.clip.id)!;
        if (audio.src !== fileUrl) {
          audio.src = fileUrl;
        }
        audio.currentTime = layer.actualTime;
        audio.playbackRate = layer.clip.speed;
        audio.volume = layer.clip.volume;

        if (isPlaying) {
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      } else if (layer.mediaType === 'image') {
        // Image element
        if (!imageElementsRef.current.has(layer.clip.id)) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          imageElementsRef.current.set(layer.clip.id, img);
        }

        const img = imageElementsRef.current.get(layer.clip.id)!;
        if (img.src !== fileUrl) {
          img.src = fileUrl;
        }
      }
    });

    // Cleanup unused elements
    videoElementsRef.current.forEach((video, id) => {
      if (!currentClipIds.has(id)) {
        video.pause();
        video.src = '';
        videoElementsRef.current.delete(id);
      }
    });

    audioElementsRef.current.forEach((audio, id) => {
      if (!currentClipIds.has(id)) {
        audio.pause();
        audio.src = '';
        audioElementsRef.current.delete(id);
      }
    });

    imageElementsRef.current.forEach((_, id) => {
      if (!currentClipIds.has(id)) {
        imageElementsRef.current.delete(id);
      }
    });
  }, [layers, isPlaying]);

  // Render composite to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const render = () => {
      // Clear canvas with black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Find the topmost video layer (highest track order with video)
      let topVideoLayer: ClipLayer | null = null;
      for (let i = layers.length - 1; i >= 0; i--) {
        if (layers[i].mediaType === 'video') {
          topVideoLayer = layers[i];
          break;
        }
      }

      // Draw the top video layer (if exists)
      if (topVideoLayer) {
        const video = videoElementsRef.current.get(topVideoLayer.clip.id);
        if (video && video.readyState >= 2) {
          const clip = topVideoLayer.clip;

          if (clip.position) {
            // Overlay with position
            const { x, y, width, height } = clip.position;
            ctx.drawImage(video, x, y, width, height);
          } else {
            // Full canvas - maintain aspect ratio
            const videoAspect = video.videoWidth / video.videoHeight;
            const canvasAspect = canvas.width / canvas.height;

            let drawWidth, drawHeight, drawX, drawY;

            if (videoAspect > canvasAspect) {
              drawWidth = canvas.width;
              drawHeight = canvas.width / videoAspect;
              drawX = 0;
              drawY = (canvas.height - drawHeight) / 2;
            } else {
              drawHeight = canvas.height;
              drawWidth = canvas.height * videoAspect;
              drawX = (canvas.width - drawWidth) / 2;
              drawY = 0;
            }

            ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
          }
        }
      }

      // Draw image overlays (with position)
      layers.forEach(layer => {
        if (layer.mediaType === 'image') {
          const img = imageElementsRef.current.get(layer.clip.id);
          if (img && img.complete) {
            if (layer.clip.position) {
              const { x, y, width, height } = layer.clip.position;
              ctx.drawImage(img, x, y, width, height);
            } else if (!topVideoLayer) {
              // If no video, show image full canvas
              const imgAspect = img.width / img.height;
              const canvasAspect = canvas.width / canvas.height;

              let drawWidth, drawHeight, drawX, drawY;

              if (imgAspect > canvasAspect) {
                drawWidth = canvas.width;
                drawHeight = canvas.width / imgAspect;
                drawX = 0;
                drawY = (canvas.height - drawHeight) / 2;
              } else {
                drawHeight = canvas.height;
                drawWidth = canvas.height * imgAspect;
                drawX = (canvas.width - drawWidth) / 2;
                drawY = 0;
              }

              ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            }
          }
        }
      });

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [layers, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={1920}
      height={1080}
      className="max-w-full max-h-full object-contain"
      style={{ backgroundColor: 'black' }}
    />
  );
}
