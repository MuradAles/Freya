import { useRef, useEffect, useState } from 'react';
import { useTimelineStore } from '../store/timelineStore';
import { isPointInHandle } from '../utils/canvasDrawing';

interface UseCanvasInteractionsProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
  playheadPosition: number;
  getClipsAtPlayhead: () => Array<{ clip: any; media: any; trackOrder: number }>;
}

/**
 * Hook that manages canvas interactions: mouse events, zoom/pan, drag operations
 */
export const useCanvasInteractions = ({
  canvasRef,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  playheadPosition,
  getClipsAtPlayhead,
}: UseCanvasInteractionsProps) => {
  const { selectedClipIds } = useTimelineStore();

  // Zoom and pan state
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // Interaction state
  const isMouseDownRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialClipPositionRef = useRef<{ x: number; y: number; width?: number; height?: number } | null>(null);
  const selectedClipIdRef = useRef<string | null>(null);
  const dragModeRef = useRef<'move' | 'resize' | 'rotate' | null>(null);
  const resizeHandleIndexRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const pendingUpdateRef = useRef<{ clipId: string; updates: any } | null>(null);
  const updateTimerRef = useRef<number | null>(null);

  // Use refs to avoid dependencies
  const selectedClipIdsRef = useRef(selectedClipIds);
  useEffect(() => {
    selectedClipIdsRef.current = selectedClipIds;
  }, [selectedClipIds]);

  // Setup wheel event listener for zoom
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleWheelNative = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      e.preventDefault();
      e.stopPropagation();

      const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
      const newZoom = Math.max(0.25, Math.min(4, canvasZoom + zoomDelta));

      const canvas = canvasRef.current;
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const centerX = canvasRect.left + canvasRect.width / 2;
      const centerY = canvasRect.top + canvasRect.height / 2;

      const zoomPointX = e.clientX - centerX;
      const zoomPointY = e.clientY - centerY;

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

  // Batch update function
  const batchedUpdate = (clipId: string, updates: any) => {
    pendingUpdateRef.current = { clipId, updates };

    if (updateTimerRef.current !== null) return;

    updateTimerRef.current = requestAnimationFrame(() => {
      if (pendingUpdateRef.current) {
        const { updateClip } = useTimelineStore.getState();
        updateClip(pendingUpdateRef.current.clipId, pendingUpdateRef.current.updates);
        pendingUpdateRef.current = null;
      }
      updateTimerRef.current = null;
    });
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

    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / CANVAS_WIDTH;
    const scaleY = canvasRect.height / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    const displayedWidth = CANVAS_WIDTH * scale;
    const displayedHeight = CANVAS_HEIGHT * scale;

    const offsetX = (canvasRect.width - displayedWidth) / 2;
    const offsetY = (canvasRect.height - displayedHeight) / 2;

    const screenX = e.clientX - canvasRect.left - offsetX;
    const screenY = e.clientY - canvasRect.top - offsetY;

    const x = screenX / scale;
    const y = screenY / scale;

    isMouseDownRef.current = true;
    dragStartRef.current = { x, y };

    const clipsAtPlayhead = getClipsAtPlayhead();
    const isShiftClick = e.shiftKey;
    const { selectClips } = useTimelineStore.getState();

    // Hit testing - find which clip was clicked
    for (let i = clipsAtPlayhead.length - 1; i >= 0; i--) {
      const { clip } = clipsAtPlayhead[i];

      if (!clip.position) continue;

      const { x: clipX, y: clipY, width, height, rotation = 0 } = clip.position;
      const actualX = clipX * CANVAS_WIDTH;
      const actualY = clipY * CANVAS_HEIGHT;
      const actualWidth = width * CANVAS_WIDTH;
      const actualHeight = height * CANVAS_HEIGHT;

      // Rotate mouse coordinates back to clip's local space
      const centerX = actualX + actualWidth / 2;
      const centerY = actualY + actualHeight / 2;
      let localX, localY;

      if (rotation !== 0) {
        const dx = x - centerX;
        const dy = y - centerY;
        const angle = -rotation * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        localX = dx * cos - dy * sin + centerX;
        localY = dx * sin + dy * cos + centerY;
      } else {
        localX = x;
        localY = y;
      }

      // Check resize handles
      const handleSize = 14;
      const handles = [
        { x: actualX, y: actualY },
        { x: actualX + actualWidth, y: actualY },
        { x: actualX, y: actualY + actualHeight },
        { x: actualX + actualWidth, y: actualY + actualHeight },
      ];

      for (let j = 0; j < handles.length; j++) {
        const handlePos = handles[j];
        if (isPointInHandle(localX, localY, handlePos.x, handlePos.y, handleSize)) {
          selectedClipIdRef.current = clip.id;
          dragModeRef.current = 'resize';
          resizeHandleIndexRef.current = j;
          initialClipPositionRef.current = {
            x: clip.position.x,
            y: clip.position.y,
            width: clip.position.width,
            height: clip.position.height,
          };
          if (!isShiftClick) {
            selectClips([clip.id]);
          }
          return;
        }
      }

      // Check rotation handle
      const rotationHandleY = actualY - 15;
      const rotationHandleX = actualX + actualWidth / 2;
      const distToRotationHandle = Math.sqrt(
        Math.pow(localX - rotationHandleX, 2) + Math.pow(localY - rotationHandleY, 2)
      );
      if (distToRotationHandle <= 12) {
        selectedClipIdRef.current = clip.id;
        dragModeRef.current = 'rotate';
        initialClipPositionRef.current = {
          x: clip.position.x,
          y: clip.position.y,
          width: clip.position.width,
          height: clip.position.height,
        };
        if (!isShiftClick) {
          selectClips([clip.id]);
        }
        return;
      }

      // Check if clicked inside clip
      if (localX >= actualX && localX <= actualX + actualWidth && localY >= actualY && localY <= actualY + actualHeight) {
        selectedClipIdRef.current = clip.id;
        dragModeRef.current = 'move';
        initialClipPositionRef.current = { x: clip.position.x, y: clip.position.y };

        if (isShiftClick) {
          const currentSelection = selectedClipIdsRef.current;
          if (currentSelection.includes(clip.id)) {
            selectClips(currentSelection.filter(id => id !== clip.id));
          } else {
            selectClips([...currentSelection, clip.id]);
          }
        } else {
          selectClips([clip.id]);
        }
        return;
      }
    }

    // Convert full-canvas clips to positioned mode on click
    for (let i = clipsAtPlayhead.length - 1; i >= 0; i--) {
      const { clip } = clipsAtPlayhead[i];
      if (!clip.position) {
        const { updateClip } = useTimelineStore.getState();

        const centerX = x / CANVAS_WIDTH;
        const centerY = y / CANVAS_HEIGHT;

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
            zIndex: 0,
          },
        });

        selectClips([clip.id]);
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

    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / CANVAS_WIDTH;
    const scaleY = canvasRect.height / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    const displayedWidth = CANVAS_WIDTH * scale;
    const displayedHeight = CANVAS_HEIGHT * scale;

    const offsetX = (canvasRect.width - displayedWidth) / 2;
    const offsetY = (canvasRect.height - displayedHeight) / 2;

    const screenX = e.clientX - canvasRect.left - offsetX;
    const screenY = e.clientY - canvasRect.top - offsetY;

    const x = screenX / scale;
    const y = screenY / scale;

    const deltaX = x - dragStartRef.current.x;
    const deltaY = y - dragStartRef.current.y;

    const { tracks } = useTimelineStore.getState();
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

    isDraggingRef.current = true;

    if (dragModeRef.current === 'move') {
      const newX = initialClipPositionRef.current.x + (deltaX / CANVAS_WIDTH);
      const newY = initialClipPositionRef.current.y + (deltaY / CANVAS_HEIGHT);

      const width = currentClip.position.width || 0.5;
      const height = currentClip.position.height || 0.5;
      const constrainedX = Math.max(0, Math.min(1 - width, newX));
      const constrainedY = Math.max(0, Math.min(1 - height, newY));

      batchedUpdate(selectedClipIdRef.current, {
        position: {
          ...currentClip.position,
          x: constrainedX,
          y: constrainedY,
        },
      });
    } else if (dragModeRef.current === 'resize') {
      const initialWidth = initialClipPositionRef.current.width || 0.5;
      const initialHeight = initialClipPositionRef.current.height || 0.5;

      // Get the actual media to calculate true aspect ratio
      const currentClipMedia = getMediaByIdRef.current(currentClip.assetId);
      const CANVAS_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT; // 1.778 for 16:9

      // Calculate aspect ratio in normalized coordinates (accounts for canvas aspect)
      // aspectRatioNormalized = how height/width should relate in 0-1 coordinates
      let aspectRatioNormalized;
      if (currentClipMedia && currentClipMedia.width && currentClipMedia.height) {
        const mediaAspect = currentClipMedia.width / currentClipMedia.height;
        // Convert media aspect to normalized coordinate aspect
        aspectRatioNormalized = CANVAS_ASPECT / mediaAspect;
      } else {
        // Fallback to current ratio if no media info
        aspectRatioNormalized = initialHeight / initialWidth;
      }

      const centerX = initialClipPositionRef.current.x! + initialWidth / 2;
      const centerY = initialClipPositionRef.current.y! + initialHeight / 2;

      const handleIndex = resizeHandleIndexRef.current ?? 3;

      let initialHandleOffsetX, initialHandleOffsetY;
      switch (handleIndex) {
        case 0:
          initialHandleOffsetX = -initialWidth / 2;
          initialHandleOffsetY = -initialHeight / 2;
          break;
        case 1:
          initialHandleOffsetX = initialWidth / 2;
          initialHandleOffsetY = -initialHeight / 2;
          break;
        case 2:
          initialHandleOffsetX = -initialWidth / 2;
          initialHandleOffsetY = initialHeight / 2;
          break;
        case 3:
          initialHandleOffsetX = initialWidth / 2;
          initialHandleOffsetY = initialHeight / 2;
          break;
      }

      const currentHandleOffsetX = initialHandleOffsetX + (deltaX / CANVAS_WIDTH);
      const currentHandleOffsetY = initialHandleOffsetY + (deltaY / CANVAS_HEIGHT);

      const initialDistance = Math.sqrt(initialHandleOffsetX ** 2 + initialHandleOffsetY ** 2);
      const currentDistance = Math.sqrt(currentHandleOffsetX ** 2 + currentHandleOffsetY ** 2);

      const scale = currentDistance / initialDistance;

      // Calculate new width, then calculate height to maintain aspect ratio
      let newWidth = Math.max(0.05, Math.min(1, initialWidth * scale));
      let newHeight = newWidth * aspectRatioNormalized;

      // If height exceeds bounds, scale down from height instead
      if (newHeight > 1) {
        newHeight = 1;
        newWidth = newHeight / aspectRatioNormalized;
      }

      // Ensure minimum size
      if (newHeight < 0.05) {
        newHeight = 0.05;
        newWidth = newHeight / aspectRatioNormalized;
      }

      let newX = centerX - newWidth / 2;
      let newY = centerY - newHeight / 2;

      newX = Math.max(0, Math.min(1 - newWidth, newX));
      newY = Math.max(0, Math.min(1 - newHeight, newY));

      batchedUpdate(selectedClipIdRef.current, {
        position: {
          ...currentClip.position,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        },
      });
    } else if (dragModeRef.current === 'rotate') {
      const centerX = (initialClipPositionRef.current.x! * CANVAS_WIDTH) + (initialClipPositionRef.current.width! * CANVAS_WIDTH / 2);
      const centerY = (initialClipPositionRef.current.y! * CANVAS_HEIGHT) + (initialClipPositionRef.current.height! * CANVAS_HEIGHT / 2);

      const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
      const normalizedAngle = ((angle + 90) % 360 + 360) % 360;

      batchedUpdate(selectedClipIdRef.current, {
        position: {
          ...currentClip.position,
          rotation: normalizedAngle,
        },
      });
    }
  };

  const handleMouseUp = () => {
    if (pendingUpdateRef.current) {
      const { updateClip } = useTimelineStore.getState();
      updateClip(pendingUpdateRef.current.clipId, pendingUpdateRef.current.updates);
      pendingUpdateRef.current = null;
    }
    if (updateTimerRef.current) {
      cancelAnimationFrame(updateTimerRef.current);
      updateTimerRef.current = null;
    }

    setIsPanning(false);
    isMouseDownRef.current = false;
    dragStartRef.current = null;
    initialClipPositionRef.current = null;
    dragModeRef.current = null;
    isDraggingRef.current = false;
  };

  const handleMouseLeave = () => {
    if (pendingUpdateRef.current) {
      const { updateClip } = useTimelineStore.getState();
      updateClip(pendingUpdateRef.current.clipId, pendingUpdateRef.current.updates);
      pendingUpdateRef.current = null;
    }
    if (updateTimerRef.current) {
      cancelAnimationFrame(updateTimerRef.current);
      updateTimerRef.current = null;
    }

    setIsPanning(false);
    isMouseDownRef.current = false;
    dragStartRef.current = null;
    initialClipPositionRef.current = null;
    dragModeRef.current = null;
    isDraggingRef.current = false;
  };

  return {
    wrapperRef,
    canvasZoom,
    canvasPan,
    setCanvasZoom,
    setCanvasPan,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
};
