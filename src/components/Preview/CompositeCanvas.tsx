import { useRef, useEffect, useState } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { useMediaStore } from '../../store/mediaStore';
import { pathToFileURL } from '../../utils/fileHandling';
import { Grid } from 'lucide-react';

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
  const { tracks, selectedClipIds } = useTimelineStore();
  const { getMediaById } = useMediaStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoLayersRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const seekingVideosRef = useRef<Set<string>>(new Set()); // Track which videos are seeking
  const videoFrameCallbacksRef = useRef<Map<string, number>>(new Map()); // Track video frame callbacks
  const pendingRenderRef = useRef<boolean>(false); // Track if we need to re-render after seek

  // UI state
  const [showGrid, setShowGrid] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(1); // 0.5 to 4.0
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [canvasColor, setCanvasColor] = useState('#000000'); // Canvas background color

  // Interaction state
  const isMouseDownRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialClipPositionRef = useRef<{ x: number; y: number; width?: number; height?: number } | null>(null);
  const selectedClipIdRef = useRef<string | null>(null);
  const dragModeRef = useRef<'move' | 'resize' | 'rotate' | null>(null);
  const resizeHandleIndexRef = useRef<number | null>(null); // 0=TL, 1=TR, 2=BL, 3=BR
  const lastUpdateTimeRef = useRef<number>(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Canvas dimensions
  const CANVAS_WIDTH = 1920;
  const CANVAS_HEIGHT = 1080;

  // Use refs to avoid dependencies causing re-renders
  const tracksRef = useRef(tracks);
  const getMediaByIdRef = useRef(getMediaById);
  const selectedClipIdsRef = useRef(selectedClipIds);
  
  useEffect(() => {
    tracksRef.current = tracks;
    getMediaByIdRef.current = getMediaById;
    selectedClipIdsRef.current = selectedClipIds;
  }, [tracks, getMediaById, selectedClipIds]);
  
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

    const ctx = canvas.getContext('2d', { 
      alpha: false,
      willReadFrequently: false,
      desynchronized: true // Better performance for video rendering
    });
    if (!ctx) return;

    // Enable high-quality image smoothing for better scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Use composition mode for better blending
    ctx.globalCompositeOperation = 'source-over';

    const render = () => {
      // Clear canvas with chosen background color
      ctx.fillStyle = canvasColor;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw canvas border (2px solid purple)
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, CANVAS_WIDTH - 2, CANVAS_HEIGHT - 2);

      // Draw grid overlay (10×10px grid, subtle gray) - only if enabled
      if (showGrid) {
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        
        // Vertical grid lines
        for (let x = 10; x < CANVAS_WIDTH; x += 10) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, CANVAS_HEIGHT);
          ctx.stroke();
        }
        
        // Horizontal grid lines
        for (let y = 10; y < CANVAS_HEIGHT; y += 10) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(CANVAS_WIDTH, y);
          ctx.stroke();
        }
      }

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
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            const centerX = actualX + actualWidth / 2;
            const centerY = actualY + actualHeight / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.drawImage(video, -actualWidth / 2, -actualHeight / 2, actualWidth, actualHeight);
            ctx.restore();
          } else {
            // Draw video with high-quality scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            // Draw from video source directly to target dimensions
            // This ensures the best quality scaling
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

      // Draw selection outlines for clips with position
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
            
            // Draw selection outline
            ctx.strokeStyle = '#8B5CF6';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(-actualWidth / 2, -actualHeight / 2, actualWidth, actualHeight);
            
            // Draw resize handles (4 corners) - BIGGER for easier grabbing
            const handleSize = 14;
            ctx.fillStyle = '#8B5CF6';
            ctx.fillRect(-actualWidth / 2 - handleSize / 2, -actualHeight / 2 - handleSize / 2, handleSize, handleSize); // Top-left
            ctx.fillRect(actualWidth / 2 - handleSize / 2, -actualHeight / 2 - handleSize / 2, handleSize, handleSize); // Top-right
            ctx.fillRect(-actualWidth / 2 - handleSize / 2, actualHeight / 2 - handleSize / 2, handleSize, handleSize); // Bottom-left
            ctx.fillRect(actualWidth / 2 - handleSize / 2, actualHeight / 2 - handleSize / 2, handleSize, handleSize); // Bottom-right
            
            // Draw rotation handle (top-center) - BIGGER for easier grabbing
            ctx.beginPath();
            ctx.arc(0, -actualHeight / 2 - 15, 10, 0, 2 * Math.PI);
            ctx.fill();
          } else {
            // Draw selection outline
            ctx.strokeStyle = '#8B5CF6';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(actualX, actualY, actualWidth, actualHeight);
            
            // Draw resize handles (4 corners) - BIGGER for easier grabbing
            const handleSize = 14;
            ctx.fillStyle = '#8B5CF6';
            ctx.fillRect(actualX - handleSize / 2, actualY - handleSize / 2, handleSize, handleSize); // Top-left
            ctx.fillRect(actualX + actualWidth - handleSize / 2, actualY - handleSize / 2, handleSize, handleSize); // Top-right
            ctx.fillRect(actualX - handleSize / 2, actualY + actualHeight - handleSize / 2, handleSize, handleSize); // Bottom-left
            ctx.fillRect(actualX + actualWidth - handleSize / 2, actualY + actualHeight - handleSize / 2, handleSize, handleSize); // Bottom-right
            
            // Draw rotation handle (top-center) - BIGGER for easier grabbing
            ctx.beginPath();
            ctx.arc(actualX + actualWidth / 2, actualY - 15, 10, 0, 2 * Math.PI);
            ctx.fill();
          }
          
          ctx.restore();
        }
      });

      // Draw dimension label in corner
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${CANVAS_WIDTH}×${CANVAS_HEIGHT}`, 10, 10);

      // Always request next frame for smooth rendering - 60fps for smooth scrubbing
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playheadPosition, isPlaying, showGrid, canvasColor]); // Include showGrid and canvasColor to re-render when they change

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

  // Setup wheel event listener to handle Ctrl+scroll zoom
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleWheelNative = (e: WheelEvent) => {
      // Only zoom with Ctrl (or Cmd on Mac)
      if (!(e.ctrlKey || e.metaKey)) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // Get zoom direction (wheel up = zoom in, wheel down = zoom out)
      const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
      const newZoom = Math.max(0.25, Math.min(4, canvasZoom + zoomDelta));
      
      // Get mouse position relative to canvas
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const canvasRect = canvas.getBoundingClientRect();
      const centerX = canvasRect.left + canvasRect.width / 2;
      const centerY = canvasRect.top + canvasRect.height / 2;
      
      // Calculate zoom point relative to center
      const zoomPointX = e.clientX - centerX;
      const zoomPointY = e.clientY - centerY;
      
      // Adjust pan to zoom towards cursor position
      const zoomChange = newZoom / canvasZoom;
      const newPanX = canvasPan.x - zoomPointX * (zoomChange - 1);
      const newPanY = canvasPan.y - zoomPointY * (zoomChange - 1);
      
      setCanvasZoom(newZoom);
      setCanvasPan({ x: newPanX, y: newPanY });
    };

    wrapper.addEventListener('wheel', handleWheelNative, { passive: false });
    
    return () => {
      wrapper.removeEventListener('wheel', handleWheelNative);
    };
  }, [canvasZoom, canvasPan]);

  // Helper to check if point is in handle
  const isPointInHandle = (x: number, y: number, handleX: number, handleY: number, handleSize: number = 14) => {
    return x >= handleX - handleSize / 2 && x <= handleX + handleSize / 2 &&
           y >= handleY - handleSize / 2 && y <= handleY + handleSize / 2;
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check for Ctrl/right-click pan
    if (e.ctrlKey || e.button === 2) {
      setIsPanning(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Get canvas rect for coordinate transformation
    const canvasRect = canvas.getBoundingClientRect();
    
    // Account for object-contain scaling
    const scaleX = canvasRect.width / CANVAS_WIDTH;
    const scaleY = canvasRect.height / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY); // object-contain uses min to preserve aspect ratio
    
    // Calculate displayed canvas size
    const displayedWidth = CANVAS_WIDTH * scale;
    const displayedHeight = CANVAS_HEIGHT * scale;
    
    // Calculate offset to center the canvas (letterboxing)
    const offsetX = (canvasRect.width - displayedWidth) / 2;
    const offsetY = (canvasRect.height - displayedHeight) / 2;
    
    // Get mouse position relative to canvas
    const screenX = e.clientX - canvasRect.left - offsetX;
    const screenY = e.clientY - canvasRect.top - offsetY;
    
    // Convert to canvas pixel coordinates
    const x = screenX / scale;
    const y = screenY / scale;

    isMouseDownRef.current = true;
    dragStartRef.current = { x, y };

    // Hit testing - find which clip was clicked
    const clipsAtPlayhead = getClipsAtPlayhead();
    const isShiftClick = e.shiftKey;
    const { selectClips } = useTimelineStore.getState();
    
    console.log(`🖱️ Canvas clicked at: ${x.toFixed(1)}, ${y.toFixed(1)} (of ${CANVAS_WIDTH}x${CANVAS_HEIGHT})`);
    console.log(`📹 Clips at playhead: ${clipsAtPlayhead.length}`);
    
    // First pass: Check all clips WITH position for hit testing
    for (let i = clipsAtPlayhead.length - 1; i >= 0; i--) {
      const { clip } = clipsAtPlayhead[i];
      console.log('🎬 Checking clip:', clip.id, 'has position:', !!clip.position);
      
      // Skip clips without position in first pass
      if (!clip.position) continue;

      const { x: clipX, y: clipY, width, height, rotation = 0 } = clip.position;
      const actualX = clipX * CANVAS_WIDTH;
      const actualY = clipY * CANVAS_HEIGHT;
      const actualWidth = width * CANVAS_WIDTH;
      const actualHeight = height * CANVAS_HEIGHT;

      // Rotate mouse coordinates back to clip's local space for hit testing
      const centerX = actualX + actualWidth / 2;
      const centerY = actualY + actualHeight / 2;
      let localX, localY;
      
      if (rotation !== 0) {
        // Rotate mouse coords around clip center by inverse rotation
        const dx = x - centerX;
        const dy = y - centerY;
        const angle = -rotation * Math.PI / 180; // Inverse rotation
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        localX = dx * cos - dy * sin + centerX;
        localY = dx * sin + dy * cos + centerY;
      } else {
        localX = x;
        localY = y;
      }

      // Check if clicked on resize handles (corners) - in local space
      const handleSize = 14;
      const handles = [
        { x: actualX, y: actualY }, // Top-left
        { x: actualX + actualWidth, y: actualY }, // Top-right
        { x: actualX, y: actualY + actualHeight }, // Bottom-left
        { x: actualX + actualWidth, y: actualY + actualHeight }, // Bottom-right
      ];

      for (let j = 0; j < handles.length; j++) {
        const handlePos = handles[j];
        const distToHandle = Math.sqrt(Math.pow(localX - handlePos.x, 2) + Math.pow(localY - handlePos.y, 2));
        console.log(`🔲 Handle ${j} at (${handlePos.x}, ${handlePos.y}), distance: ${distToHandle.toFixed(1)}`);
        if (isPointInHandle(localX, localY, handlePos.x, handlePos.y, handleSize)) {
          console.log('🎯 Clicked on resize handle:', j);
          selectedClipIdRef.current = clip.id;
          dragModeRef.current = 'resize';
          resizeHandleIndexRef.current = j; // Store which handle (0=TL, 1=TR, 2=BL, 3=BR)
          initialClipPositionRef.current = { 
            x: clip.position.x, 
            y: clip.position.y, 
            width: clip.position.width, 
            height: clip.position.height 
          };
          console.log('📏 Initial size:', initialClipPositionRef.current);
          if (!isShiftClick) {
            selectClips([clip.id]);
          }
          return;
        }
      }

      // Check if clicked on rotation handle (top-center) - in local space
      const rotationHandleY = actualY - 15;
      const rotationHandleX = actualX + actualWidth / 2;
      const distToRotationHandle = Math.sqrt(Math.pow(localX - rotationHandleX, 2) + Math.pow(localY - rotationHandleY, 2));
      console.log('🔄 Rotation handle at:', rotationHandleX, rotationHandleY, 'Click at:', localX, localY, 'Distance:', distToRotationHandle);
      if (distToRotationHandle <= 12) {
        console.log('🔄 Clicked on rotation handle');
        selectedClipIdRef.current = clip.id;
        dragModeRef.current = 'rotate';
        initialClipPositionRef.current = { 
          x: clip.position.x, 
          y: clip.position.y, 
          width: clip.position.width, 
          height: clip.position.height 
        };
        if (!isShiftClick) {
          selectClips([clip.id]);
        }
        return;
      }

      // Check if clicked inside clip (for move) - using local coords
      if (localX >= actualX && localX <= actualX + actualWidth && localY >= actualY && localY <= actualY + actualHeight) {
        console.log('✅ Hit clip:', clip.id, 'at position:', clip.position);
        selectedClipIdRef.current = clip.id;
        dragModeRef.current = 'move';
        
        // Save initial clip position for drag calculation
        initialClipPositionRef.current = { x: clip.position.x, y: clip.position.y };
        
        // Handle multi-select
        if (isShiftClick) {
          const currentSelection = selectedClipIdsRef.current;
          if (currentSelection.includes(clip.id)) {
            // Deselect
            selectClips(currentSelection.filter(id => id !== clip.id));
            console.log('🔵 Deselected clip');
          } else {
            // Add to selection
            selectClips([...currentSelection, clip.id]);
            console.log('🟢 Added to selection');
          }
        } else {
          selectClips([clip.id]);
          console.log('✨ Selected clip:', clip.id);
        }
        return;
      }
    }
    
    // Second pass: If we didn't hit anything, check if there are clips without position (full-canvas clips)
    // and convert the first one (topmost) to positioned mode
    for (let i = clipsAtPlayhead.length - 1; i >= 0; i--) {
      const { clip } = clipsAtPlayhead[i];
      if (!clip.position) {
        console.log('   ⚠️ Found clip without position, converting to overlay:', clip.id);
        const { updateClip } = useTimelineStore.getState();
        
        // Calculate position based on click location
        const centerX = x / CANVAS_WIDTH;
        const centerY = y / CANVAS_HEIGHT;
        
        // Calculate position, ensuring the clip stays within canvas bounds
        const defaultWidth = 0.5;
        const defaultHeight = 0.5;
        const clampedX = Math.max(0, Math.min(1 - defaultWidth, centerX - 0.25));
        const clampedY = Math.max(0, Math.min(1 - defaultHeight, centerY - 0.25));
        
        updateClip(clip.id, {
          position: {
            x: clampedX,
            y: clampedY,
            width: defaultWidth,
            height: defaultHeight,
            rotation: 0,
            zIndex: 0
          }
        });
        
        // Select this clip
        selectClips([clip.id]);
        console.log('✅ Converted to overlay and selected:', clip.id);
        return;
      }
    }
    
    // Clicked on empty canvas
    if (!isShiftClick) {
      selectedClipIdRef.current = null;
      selectClips([]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !dragStartRef.current) return;

    // Handle panning
    if (isPanning) {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      setCanvasPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!isMouseDownRef.current || !selectedClipIdRef.current || !initialClipPositionRef.current) return;

    // Get current mouse position in canvas coordinates (accounting for zoom/pan)
    const canvasRect = canvas.getBoundingClientRect();
    
    // Account for object-contain scaling
    const scaleX = canvasRect.width / CANVAS_WIDTH;
    const scaleY = canvasRect.height / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY); // object-contain uses min to preserve aspect ratio
    
    // Calculate displayed canvas size
    const displayedWidth = CANVAS_WIDTH * scale;
    const displayedHeight = CANVAS_HEIGHT * scale;
    
    // Calculate offset to center the canvas (letterboxing)
    const offsetX = (canvasRect.width - displayedWidth) / 2;
    const offsetY = (canvasRect.height - displayedHeight) / 2;
    
    // Get mouse position relative to canvas
    const screenX = e.clientX - canvasRect.left - offsetX;
    const screenY = e.clientY - canvasRect.top - offsetY;
    
    // Convert to canvas pixel coordinates
    const x = screenX / scale;
    const y = screenY / scale;

    const deltaX = x - dragStartRef.current.x;
    const deltaY = y - dragStartRef.current.y;

    // Find the current clip to preserve other position properties
    const { tracks, updateClip } = useTimelineStore.getState();
    let currentClip: any = null;
    
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.id === selectedClipIdRef.current) {
          currentClip = clip;
          break;
        }
      }
      if (currentClip) break;
    }

    if (!currentClip || !currentClip.position) return;

    // Throttle updates to prevent infinite loop (60fps = ~16ms)
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 16) return;
    lastUpdateTimeRef.current = now;

    console.log('🎨 Drag mode:', dragModeRef.current, 'delta:', deltaX, deltaY);

    if (dragModeRef.current === 'move') {
      // Calculate new position based on initial position + delta
      const newX = initialClipPositionRef.current.x + (deltaX / CANVAS_WIDTH);
      const newY = initialClipPositionRef.current.y + (deltaY / CANVAS_HEIGHT);
      
      // Constrain to canvas boundaries, accounting for clip size
      const width = currentClip.position.width || 0.5;
      const height = currentClip.position.height || 0.5;
      const constrainedX = Math.max(0, Math.min(1 - width, newX));
      const constrainedY = Math.max(0, Math.min(1 - height, newY));
      
      updateClip(selectedClipIdRef.current, {
        position: {
          ...currentClip.position,
          x: constrainedX,
          y: constrainedY
        }
      });
    } else if (dragModeRef.current === 'resize') {
      // Resize from center - maintain aspect ratio and keep center in same place
      const aspectRatio = (initialClipPositionRef.current.height || 0.5) / (initialClipPositionRef.current.width || 0.5);
      
      const initialWidth = initialClipPositionRef.current.width || 0.5;
      const initialHeight = initialClipPositionRef.current.height || 0.5;
      const initialX = initialClipPositionRef.current.x || 0;
      const initialY = initialClipPositionRef.current.y || 0;
      
      // Calculate the center of the clip (in normalized coordinates)
      const centerX = initialX + initialWidth / 2;
      const centerY = initialY + initialHeight / 2;
      
      // Calculate where the handle WAS (before drag started) and where it IS now
      const handleIndex = resizeHandleIndexRef.current ?? 3; // Default to bottom-right
      
      // Calculate handle position relative to center at start
      let initialHandleOffsetX, initialHandleOffsetY;
      switch(handleIndex) {
        case 0: // Top-left
          initialHandleOffsetX = -initialWidth / 2;
          initialHandleOffsetY = -initialHeight / 2;
          break;
        case 1: // Top-right
          initialHandleOffsetX = initialWidth / 2;
          initialHandleOffsetY = -initialHeight / 2;
          break;
        case 2: // Bottom-left
          initialHandleOffsetX = -initialWidth / 2;
          initialHandleOffsetY = initialHeight / 2;
          break;
        case 3: // Bottom-right
          initialHandleOffsetX = initialWidth / 2;
          initialHandleOffsetY = initialHeight / 2;
          break;
      }
      
      // Calculate where the handle is NOW (delta added to initial offset)
      const currentHandleOffsetX = initialHandleOffsetX + (deltaX / CANVAS_WIDTH);
      const currentHandleOffsetY = initialHandleOffsetY + (deltaY / CANVAS_HEIGHT);
      
      // Calculate distances from center to handle (before and after)
      const initialDistance = Math.sqrt(initialHandleOffsetX ** 2 + initialHandleOffsetY ** 2);
      const currentDistance = Math.sqrt(currentHandleOffsetX ** 2 + currentHandleOffsetY ** 2);
      
      // Scale size based on distance ratio (maintaining aspect ratio)
      const scale = currentDistance / initialDistance;
      const newWidth = Math.max(0.05, Math.min(1, initialWidth * scale));
      const newHeight = Math.max(0.05, Math.min(1, initialHeight * scale));
      
      // Adjust position to keep CENTER in same place
      let newX = centerX - newWidth / 2;
      let newY = centerY - newHeight / 2;
      
      // Constrain to canvas bounds
      newX = Math.max(0, Math.min(1 - newWidth, newX));
      newY = Math.max(0, Math.min(1 - newHeight, newY));
      
      console.log('📐 Resizing from center: width=', newWidth, 'height=', newHeight, 'pos=', newX, newY);
      
      updateClip(selectedClipIdRef.current, {
        position: {
          ...currentClip.position,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight
        }
      });
    } else if (dragModeRef.current === 'rotate') {
      // Calculate rotation angle from clip center
      const centerX = (initialClipPositionRef.current.x! * CANVAS_WIDTH) + (initialClipPositionRef.current.width! * CANVAS_WIDTH / 2);
      const centerY = (initialClipPositionRef.current.y! * CANVAS_HEIGHT) + (initialClipPositionRef.current.height! * CANVAS_HEIGHT / 2);
      
      // Get the angle from the center to the mouse position
      const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
      
      // Normalize to 0-360 and add 90 to match typical rotation (0 = upright)
      const normalizedAngle = ((angle + 90) % 360 + 360) % 360;
      
      console.log('🔄 Rotating to angle:', normalizedAngle);
      
      updateClip(selectedClipIdRef.current, {
        position: {
          ...currentClip.position,
          rotation: normalizedAngle
        }
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    isMouseDownRef.current = false;
    dragStartRef.current = null;
    initialClipPositionRef.current = null;
    dragModeRef.current = null;
    lastUpdateTimeRef.current = 0;
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
    isMouseDownRef.current = false;
    dragStartRef.current = null;
    initialClipPositionRef.current = null;
    dragModeRef.current = null;
    lastUpdateTimeRef.current = 0;
  };


  return (
    <div className="relative w-full h-full">
      {/* Controls bar */}
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1">
          <button
            onClick={() => {
              // Zoom out from center
              setCanvasZoom(prev => Math.max(0.25, prev - 0.25));
            }}
            className="p-1 text-white hover:bg-gray-700 rounded"
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-white text-sm min-w-[3rem] text-center">{(canvasZoom * 100).toFixed(0)}%</span>
          <button
            onClick={() => {
              // Zoom in to center
              setCanvasZoom(prev => Math.min(4, prev + 0.25));
            }}
            className="p-1 text-white hover:bg-gray-700 rounded"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => { setCanvasZoom(1); setCanvasPan({ x: 0, y: 0 }); }}
            className="p-1 text-white hover:bg-gray-700 rounded ml-1"
            title="Reset Zoom/Pan"
          >
            ⟳
          </button>
        </div>

        {/* Grid toggle */}
        <button
          onClick={() => setShowGrid(!showGrid)}
          className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white"
          title={showGrid ? 'Hide Grid' : 'Show Grid'}
        >
          <Grid size={20} />
        </button>

        {/* Canvas color picker */}
        <input
          type="color"
          value={canvasColor}
          onChange={(e) => setCanvasColor(e.target.value)}
          className="w-10 h-10 bg-gray-800 rounded cursor-pointer"
          title="Change canvas background color"
        />
      </div>

      {/* Zoom hint */}
      <div className="absolute bottom-2 left-2 z-10 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-75">
        Ctrl/Cmd + Scroll to zoom • Middle-click + drag to pan
      </div>

      <div 
        ref={wrapperRef}
        className="w-full h-full overflow-hidden"
        style={{
          transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
          transformOrigin: 'center center'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full object-contain"
          style={{ backgroundColor: canvasColor }}
        />
      </div>
    </div>
  );
}
