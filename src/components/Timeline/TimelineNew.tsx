import { useEffect, useRef, useState, useCallback } from 'react';
import { Film, Plus, Minus, Trash2, Sparkles } from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import { useMediaStore } from '../../store/mediaStore';
import { useSettingsStore } from '../../store/settingsStore';
import ExportDialog, { type ExportSettings } from '../Dialogs/ExportDialog';
import AIVideoDialog from '../Dialogs/AIVideoDialog';
import ClipContextMenu from './ClipContextMenu';
import type { TimelineClip } from '../../types/timeline';
import { processMediaFile } from '../../utils/fileHandling';

const TRACK_HEIGHT = 40;
const TRACK_LABEL_WIDTH = 100;
const RULER_HEIGHT = 30;
const SNAP_THRESHOLD = 15; // pixels for snapping

export default function TimelineNew() {
  const tracks = useTimelineStore(state => state.tracks);
  const zoom = useTimelineStore(state => state.zoom);
  const playheadPosition = useTimelineStore(state => state.playheadPosition);
  const selectedClipIds = useTimelineStore(state => state.selectedClipIds);
  const setZoom = useTimelineStore(state => state.setZoom);
  const addTrack = useTimelineStore(state => state.addTrack);
  const removeTrack = useTimelineStore(state => state.removeTrack);
  const setPlayhead = useTimelineStore(state => state.setPlayhead);
  const selectClips = useTimelineStore(state => state.selectClips);
  const addClip = useTimelineStore(state => state.addClip);
  const deleteClip = useTimelineStore(state => state.deleteClip);
  const setUserSeeking = useTimelineStore(state => state.setUserSeeking);
  const moveClip = useTimelineStore(state => state.moveClip);
  const splitClip = useTimelineStore(state => state.splitClip);
  
  const { getMediaById, mediaLibrary } = useMediaStore();
  
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const exportDialogRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(2000);

  // Close export dialog when clicking outside
  useEffect(() => {
    if (!showExportDialog) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (exportDialogRef.current && !exportDialogRef.current.contains(event.target as Node)) {
        setShowExportDialog(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportDialog]);

  // Listen for export progress updates
  useEffect(() => {
    const handleProgress = (progress: number) => {
      setExportProgress(progress);
    };

    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.on) {
      electronAPI.on('export:progress', handleProgress);
    }

    return () => {
      if (electronAPI && electronAPI.off) {
        electronAPI.off('export:progress', handleProgress);
      }
    };
  }, []);
  const [dragState, setDragState] = useState<{
    type: 'move' | 'trim-left' | 'trim-right' | null;
    clipId: string | null;
    sourceTrackId: string | null;
    startX: number;
    startY: number;
    startTime: number;
    startDuration: number;
    startTrimStart: number;
  }>({
    type: null,
    clipId: null,
    sourceTrackId: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    startDuration: 0,
    startTrimStart: 0,
  });
  
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    clipId: string;
  } | null>(null);

  // Dialog states
  const [showAIVideoDialog, setShowAIVideoDialog] = useState(false);

  // Track viewport width
  useEffect(() => {
    const updateViewportWidth = () => {
      if (containerRef.current) {
        setViewportWidth(containerRef.current.clientWidth - TRACK_LABEL_WIDTH);
      }
    };
    
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  // Calculate timeline width based on content
  const timelineDuration = Math.max(
    60,
    ...tracks.flatMap(t => t.clips.map(c => c.startTime + c.duration))
  );
  // Ensure timeline extends to at least the viewport width (100% visible) plus extra space
  const minTimelineWidth = viewportWidth;
  const contentWidth = timelineDuration * zoom * 1.5;
  const timelineWidth = Math.max(minTimelineWidth, contentWidth);

  // Initialize with one track
  useEffect(() => {
    if (tracks.length === 0) {
      addTrack();
    }
  }, [tracks.length, addTrack]);

  // Handle zoom
  const handleZoomIn = () => setZoom(Math.min(200, zoom * 1.5));
  const handleZoomOut = () => setZoom(Math.max(1, zoom / 1.5));

  // Handle Ctrl+MouseWheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const currentZoom = useTimelineStore.getState().zoom;
        if (e.deltaY < 0) {
          // Scrolling up - zoom in
          useTimelineStore.getState().setZoom(Math.min(200, currentZoom * 1.5));
        } else {
          // Scrolling down - zoom out
          useTimelineStore.getState().setZoom(Math.max(1, currentZoom / 1.5));
        }
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  // Handle playhead click
  const handleRulerClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const time = x / zoom;
    setPlayhead(Math.max(0, Math.min(timelineDuration, time)));
  };

  // Format time for ruler
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate ruler markers with minor and major ticks
  const getRulerMarkers = () => {
    const markers: { time: number; label: string; isMajor: boolean }[] = [];
    const uniqueTimes = new Set<number>();
    
    // Determine intervals based on zoom level - show more numbers when zoomed in
    let majorInterval = 30;
    let minorInterval = 10;
    
    if (zoom >= 100) {
      // Fully zoomed in - show every second with label
      majorInterval = 1;
      minorInterval = 1; // Every second is a major tick when fully zoomed
    } else if (zoom >= 50) {
      // Heavily zoomed in - show every 2 seconds with label, minor every second
      majorInterval = 2;
      minorInterval = 1;
    } else if (zoom >= 20) {
      // Well zoomed in - show every 5 seconds with label, minor every second
      majorInterval = 5;
      minorInterval = 1;
    } else if (zoom >= 10) {
      // Moderately zoomed in - show every 10 seconds with label, minor every 5
      majorInterval = 10;
      minorInterval = 5;
    } else if (zoom >= 5) {
      // Medium zoom - show every 30 seconds with label, minor every 10
      majorInterval = 30;
      minorInterval = 10;
    } else if (zoom >= 2) {
      // Zoomed out - show every 60 seconds with label, minor every 15
      majorInterval = 60;
      minorInterval = 15;
    } else {
      // Very zoomed out - show every 300 seconds with label, minor every 60
      majorInterval = 300;
      minorInterval = 60;
    }

    // Extend markers to cover the full ruler width (timelineWidth)
    const maxDuration = timelineWidth / zoom;
    
    // First, add major ticks (these take priority)
    for (let t = 0; t <= maxDuration; t += majorInterval) {
      if (!uniqueTimes.has(t)) {
        markers.push({ time: t, label: formatTime(t), isMajor: true });
        uniqueTimes.add(t);
      }
    }
    
    // Then add minor ticks, skipping those that are already major ticks
    // Only add minor ticks if major and minor intervals are different
    if (minorInterval !== majorInterval) {
      for (let t = 0; t <= maxDuration; t += minorInterval) {
        if (!uniqueTimes.has(t)) {
          markers.push({ time: t, label: '', isMajor: false });
        }
      }
    }
    
    return markers;
  };

  // Handle drop from media library
  const handleDrop = (e: React.DragEvent, trackIndex: number) => {
    e.preventDefault();
    const mediaId = e.dataTransfer.getData('mediaId');
    if (!mediaId) return;

    const media = getMediaById(mediaId);
    if (!media) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const startTime = Math.max(0, x / zoom);

    const track = tracks[trackIndex];
    if (!track) return;

    // Calculate initial size preserving aspect ratio
    // Get canvas dimensions from store
    const { canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT } = useTimelineStore.getState();
    const CANVAS_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT; // 16:9 = 1.778
    const targetSizePercent = 0.5; // Target 50% of canvas dimensions

    let clipWidth = 0.5;
    let clipHeight = 0.5;

    if (media.width && media.height) {
      const mediaAspect = media.width / media.height;

      // Target actual pixel size (e.g., 50% of canvas width in pixels)
      const targetPixelWidth = targetSizePercent * CANVAS_WIDTH;
      const targetPixelHeight = targetPixelWidth / mediaAspect;

      // Convert back to normalized coordinates
      clipWidth = targetPixelWidth / CANVAS_WIDTH;
      clipHeight = targetPixelHeight / CANVAS_HEIGHT;

      // If height exceeds 90% of canvas, scale down proportionally
      if (clipHeight > 0.9) {
        clipHeight = 0.9;
        const actualPixelHeight = clipHeight * CANVAS_HEIGHT;
        const actualPixelWidth = actualPixelHeight * mediaAspect;
        clipWidth = actualPixelWidth / CANVAS_WIDTH;
      }

      // If width exceeds 90% of canvas, scale down proportionally
      if (clipWidth > 0.9) {
        clipWidth = 0.9;
        const actualPixelWidth = clipWidth * CANVAS_WIDTH;
        const actualPixelHeight = actualPixelWidth / mediaAspect;
        clipHeight = actualPixelHeight / CANVAS_HEIGHT;
      }
    }

    // Center the clip
    const clipX = (1 - clipWidth) / 2;
    const clipY = (1 - clipHeight) / 2;

    const newClip: TimelineClip = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      assetId: mediaId,
      trackId: track.id,
      startTime,
      duration: media.type === 'image' ? 10 : media.duration,
      trimStart: 0,
      trimEnd: media.type === 'image' ? 10 : media.duration,
      speed: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      // Add default position with preserved aspect ratio
      position: {
        x: clipX,
        y: clipY,
        width: clipWidth,
        height: clipHeight,
        rotation: 0,
        zIndex: 0
      }
    };

    addClip(track.id, newClip);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle clip click
  const handleClipClick = (e: React.MouseEvent, clipId: string) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      if (selectedClipIds.includes(clipId)) {
        selectClips(selectedClipIds.filter(id => id !== clipId));
      } else {
        selectClips([...selectedClipIds, clipId]);
      }
    } else {
      selectClips([clipId]);
    }
  };

  // Handle context menu on clip
  const handleClipContextMenu = (e: React.MouseEvent, clipId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      clipId,
    });
    // Also select the clip if not already selected
    if (!selectedClipIds.includes(clipId)) {
      selectClips([clipId]);
    }
  };

  // Check if playhead is within a clip for enabling split option
  const isPlayheadInClip = (clip: TimelineClip): boolean => {
    return playheadPosition > clip.startTime && playheadPosition < clip.startTime + clip.duration;
  };

  // Handle split at playhead
  const handleSplitAtPlayhead = () => {
    if (!contextMenu) return;
    const clipId = contextMenu.clipId;
    splitClip(clipId, playheadPosition);
    setContextMenu(null);
  };

  // Handle delete clip
  const handleDeleteClip = () => {
    if (!contextMenu) return;
    const clipId = contextMenu.clipId;
    deleteClip(clipId);
    setContextMenu(null);
  };

  // Handle delete key press
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipIds.length > 0) {
          selectedClipIds.forEach(clipId => {
            deleteClip(clipId);
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedClipIds, deleteClip]);

  // Helper function to check if a clip would overlap with others in its track
  const wouldOverlap = useCallback((clipId: string, newStartTime: number, duration: number): boolean => {
    const currentTracks = useTimelineStore.getState().tracks;
    const track = currentTracks.find(t => t.clips.some(c => c.id === clipId));
    if (!track) return false;
    
    const newEndTime = newStartTime + duration;
    
    for (const otherClip of track.clips) {
      if (otherClip.id === clipId) continue;
      
      const otherStart = otherClip.startTime;
      const otherEnd = otherClip.startTime + otherClip.duration;
      
      if (newStartTime < otherEnd && newEndTime > otherStart) {
        return true;
      }
    }
    
    return false;
  }, []);
  
  // Helper function to check if moving clip overlaps with another clip
  const wouldOverlapWith = useCallback((clip1Id: string, clip1Start: number, clip1Duration: number, clip2Start: number, clip2Duration: number): boolean => {
    const clip1End = clip1Start + clip1Duration;
    const clip2End = clip2Start + clip2Duration;
    return clip1Start < clip2End && clip1End > clip2Start;
  }, []);
  
  // Helper function to push clips when moving
  const pushClips = useCallback((clipId: string, newStartTime: number, duration: number) => {
    const currentTracks = useTimelineStore.getState().tracks;
    const updateClip = useTimelineStore.getState().updateClip;
    
    const track = currentTracks.find(t => t.clips.some(c => c.id === clipId));
    if (!track) return;
    
    const newEndTime = newStartTime + duration;
    
    // Find all clips that would be affected (overlapped by the moving clip)
    const affectedClips = track.clips
      .filter(c => c.id !== clipId)
      .filter(c => {
        // Check if the moving clip would overlap with this clip
        return newStartTime < c.startTime + c.duration && newEndTime > c.startTime;
      });
    
    if (affectedClips.length > 0) {
      // Push all affected clips to after the moving clip
      affectedClips.forEach(otherClip => {
        const newOtherStartTime = newEndTime;
        updateClip(otherClip.id, { startTime: newOtherStartTime });
      });
    }
  }, []);
  
  // Helper function to find the nearest valid snap position with push behavior
  const findBestPosition = useCallback((clipId: string, preferredTime: number, duration: number): number => {
    const currentTracks = useTimelineStore.getState().tracks;
    const track = currentTracks.find(t => t.clips.some(c => c.id === clipId));
    if (!track) return preferredTime;
    
    // Check if this would overlap with any clips
    const overlapping = track.clips.filter(c => 
      c.id !== clipId && wouldOverlapWith(clipId, preferredTime, duration, c.startTime, c.duration)
    );
    
    // If moving forward (to the right) and there's overlap, use push behavior
    const currentClip = track.clips.find(c => c.id === clipId);
    if (currentClip && preferredTime > currentClip.startTime && overlapping.length > 0) {
      // Push the overlapping clips
      pushClips(clipId, preferredTime, duration);
      return preferredTime;
    }
    
    // Otherwise, snap to avoid overlaps
    // Snap points: start and end of other clips
    const snapPoints: number[] = [preferredTime]; // Always include current position
    
    for (const otherClip of track.clips) {
      if (otherClip.id === clipId) continue;
      snapPoints.push(otherClip.startTime); // Snap to start
      snapPoints.push(otherClip.startTime + otherClip.duration); // Snap to end
    }
    
    // Find the nearest snap point that doesn't cause overlap
    let bestTime = preferredTime;
    let minDistance = Infinity;
    
    for (const snapTime of snapPoints) {
      const distance = Math.abs((snapTime - preferredTime) * zoom);
      if (distance < minDistance && !wouldOverlap(clipId, snapTime, duration)) {
        if (distance < SNAP_THRESHOLD * zoom || snapTime === preferredTime) {
          minDistance = distance;
          bestTime = snapTime;
        }
      }
    }
    
    // If no snap found, check if we can move to avoid overlap
    if (wouldOverlap(clipId, preferredTime, duration)) {
      // Try to find the next available position
      const sortedClips = track.clips
        .filter(c => c.id !== clipId)
        .sort((a, b) => a.startTime - b.startTime);
      
      let nextAvailableTime = preferredTime;
      
      for (const otherClip of sortedClips) {
        if (nextAvailableTime < otherClip.startTime + otherClip.duration) {
          nextAvailableTime = otherClip.startTime + otherClip.duration;
          if (!wouldOverlap(clipId, nextAvailableTime, duration)) {
            return nextAvailableTime;
          }
        }
      }
    }
    
    return Math.max(0, bestTime);
  }, [zoom, wouldOverlap, wouldOverlapWith, pushClips]);

  // Handle clip drag start
  const handleClipMouseDown = (e: React.MouseEvent, clip: TimelineClip, type: 'move' | 'trim-left' | 'trim-right') => {
    e.stopPropagation();
    setDragState({
      type,
      clipId: clip.id,
      sourceTrackId: clip.trackId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: clip.startTime,
      startDuration: clip.duration,
      startTrimStart: clip.trimStart,
    });
    setHoveredTrackId(null); // Reset hover state
  };
  
  // Helper function to get which track the mouse is over
  const getTrackAtY = useCallback((clientY: number): string | null => {
    if (!containerRef.current) return null;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const y = clientY - containerRect.top;
    
    // Account for ruler height
    const trackAreaY = y - RULER_HEIGHT;
    if (trackAreaY < 0) return null;
    
    // Calculate which track based on track index
    const trackIndex = Math.floor(trackAreaY / TRACK_HEIGHT);
    const currentTracks = useTimelineStore.getState().tracks;
    if (trackIndex >= 0 && trackIndex < currentTracks.length) {
      return currentTracks[trackIndex].id;
    }
    
    return null;
  }, []);

  // Handle mouse move
  useEffect(() => {
    if (!dragState.type || !dragState.clipId) return;

    let lastUpdateTime = 0;
    const throttleMs = 16; // ~60fps

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdateTime < throttleMs) return;
      lastUpdateTime = now;

      // Get current store functions to avoid stale closures
      const currentTracks = useTimelineStore.getState().tracks;
      const updateClip = useTimelineStore.getState().updateClip;

      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / zoom;

      if (dragState.type === 'move') {
        // Detect which track we're hovering over
        const currentTrackId = getTrackAtY(e.clientY);
        setHoveredTrackId(currentTrackId);
        
        // If hovering over a different track, we'll handle the move on mouse up
        // For now, just update the position in the source track for visual feedback
        if (dragState.clipId && dragState.sourceTrackId) {
          const rawNewStartTime = Math.max(0, dragState.startTime + deltaTime);
          
          // If we're still on the same track, update normally
          if (currentTrackId === dragState.sourceTrackId) {
            const bestPosition = findBestPosition(dragState.clipId, rawNewStartTime, dragState.startDuration);
            updateClip(dragState.clipId, { startTime: bestPosition });
          } else {
            // If on a different track, temporarily update the visual position
            // The actual move will happen on mouse up
            const bestPosition = Math.max(0, rawNewStartTime);
            updateClip(dragState.clipId, { startTime: bestPosition });
          }
        }
      } else if (dragState.type === 'trim-left') {
        const newTrimStart = Math.max(0, dragState.startTrimStart + deltaTime);
        const newDuration = Math.max(0.1, dragState.startDuration - deltaTime);
        const newStartTime = dragState.startTime + deltaTime;
        
        // Get the clip and media to validate against source duration
        if (dragState.clipId) {
          const clip = currentTracks.flatMap(t => t.clips).find(c => c.id === dragState.clipId);
          if (clip) {
            const media = getMediaById(clip.assetId);
            
            // For video/audio, ensure we don't exceed source duration
            if (media && (media.type === 'video' || media.type === 'audio')) {
              const maxEndTime = media.duration;
              const wouldExceedSource = newTrimStart + newDuration > maxEndTime;
              
              if (!wouldExceedSource && newDuration > 0.1) {
                updateClip(dragState.clipId, {
                  trimStart: newTrimStart,
                  duration: newDuration,
                  startTime: Math.max(0, newStartTime),
                });
              }
            } else {
              // For images or unknown types, no limit
              if (newDuration > 0.1) {
                updateClip(dragState.clipId, {
                  trimStart: newTrimStart,
                  duration: newDuration,
                  startTime: Math.max(0, newStartTime),
                });
              }
            }
          }
        }
      } else if (dragState.type === 'trim-right') {
        const newDuration = Math.max(0.1, dragState.startDuration + deltaTime);
        
        // Get the clip and media to validate against source duration
        if (dragState.clipId) {
          const clip = currentTracks.flatMap(t => t.clips).find(c => c.id === dragState.clipId);
          if (clip) {
            const media = getMediaById(clip.assetId);
            const track = currentTracks.find(t => t.clips.some(c => c.id === dragState.clipId));
            
            // For video/audio, limit to source duration
            let finalDuration = newDuration;
            if (media && (media.type === 'video' || media.type === 'audio')) {
              const trimStart = clip.trimStart ?? 0;
              const maxSourceDuration = media.duration - trimStart;
              finalDuration = Math.min(newDuration, maxSourceDuration);
            }
            
            if (finalDuration >= 0.1) {
              updateClip(dragState.clipId, { duration: finalDuration });
              
              // Push any clips that would now be overlapped
              if (track) {
                const newEndTime = dragState.startTime + finalDuration;
                const clipsToPush = track.clips.filter(c => 
                  c.id !== dragState.clipId && 
                  c.startTime >= dragState.startTime &&
                  c.startTime < newEndTime
                );
                
                // Push overlapping clips to start after the extended clip
                clipsToPush.forEach(otherClip => {
                  updateClip(otherClip.id, { startTime: newEndTime });
                });
              }
            }
          }
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const current_state = useTimelineStore.getState();
      const updateClip = current_state.updateClip;
      const moveClipFn = current_state.moveClip;
      
      if (dragState.type === 'move' && dragState.clipId && dragState.sourceTrackId) {
        // Get the final position
        const deltaX = e.clientX - dragState.startX;
        const deltaTime = deltaX / zoom;
        const rawNewStartTime = Math.max(0, dragState.startTime + deltaTime);
        
        // Get the track we're hovering over
        const targetTrackId = getTrackAtY(e.clientY);
        
        // If we moved to a different track, use moveClip
        if (targetTrackId && targetTrackId !== dragState.sourceTrackId) {
          const targetTrack = current_state.tracks.find(t => t.id === targetTrackId);
          if (targetTrack) {
            const calculatedStartTime = rawNewStartTime;
            
            // Check for overlaps in the target track
            const wouldOverlapInTarget = targetTrack.clips.some(otherClip => {
              if (otherClip.id === dragState.clipId) return false;
              const otherEnd = otherClip.startTime + otherClip.duration;
              const newEnd = calculatedStartTime + dragState.startDuration;
              return calculatedStartTime < otherEnd && newEnd > otherClip.startTime;
            });
            
            if (!wouldOverlapInTarget) {
              // Move the clip to the new track
              moveClipFn(dragState.clipId, targetTrackId, calculatedStartTime);
            }
            // If it would overlap, don't move (clip stays in original track)
          }
        } else if (!targetTrackId || targetTrackId === dragState.sourceTrackId) {
          // Still on the same track, just update position normally
          const bestPosition = findBestPosition(dragState.clipId, rawNewStartTime, dragState.startDuration);
          updateClip(dragState.clipId, { startTime: bestPosition });
        }
      }
      
      setDragState({
        type: null,
        clipId: null,
        sourceTrackId: null,
        startX: 0,
        startY: 0,
        startTime: 0,
        startDuration: 0,
        startTrimStart: 0,
      });
      setHoveredTrackId(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.type, dragState.clipId, dragState.startX, dragState.startY, dragState.startTime, dragState.startDuration, dragState.startTrimStart, dragState.sourceTrackId, zoom, findBestPosition, getTrackAtY]);

  return (
    <div className="w-full h-full bg-gray-800 border-t border-gray-700 flex flex-col select-none">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Timeline</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleZoomOut} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded">
            <Minus className="w-4 h-4 text-gray-300" />
          </button>
          <button onClick={handleZoomIn} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded">
            <Plus className="w-4 h-4 text-gray-300" />
          </button>
          <button onClick={addTrack} className="ml-3 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
            <Plus className="w-4 h-4 inline mr-1" />
            Track
          </button>
          <button
            onClick={() => setShowAIVideoDialog(true)}
            className="p-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded"
            title="AI Image Generation"
          >
            <Sparkles className="w-4 h-4 text-white" />
          </button>
          <div className="relative" ref={exportDialogRef}>
            <div className="relative">
              <button 
                onClick={() => setShowExportDialog(!showExportDialog)}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium flex items-center gap-2"
                disabled={isExporting}
              >
                <span>Export</span>
                {isExporting && (
                  <span className="text-xs text-purple-200">
                    {Math.round(exportProgress)}%
                  </span>
                )}
              </button>
              
              {/* Progress bar below button during export */}
              {isExporting && (
                <div className="absolute -bottom-6 left-0 right-0 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              )}
            </div>
            
            {/* Export Dialog - appears on top */}
            {showExportDialog && (
              <ExportDialog
                isOpen={showExportDialog}
                onClose={() => setShowExportDialog(false)}
                onExport={async (settings: ExportSettings) => {
                  setShowExportDialog(false); // Close immediately
                  setIsExporting(true);
                  setExportProgress(0);
                  
                  try {
                    const electronAPI = (window as any).electronAPI;
                    const { canvasColor } = useSettingsStore.getState();
                    // Use 'custom' as resolution parameter for backward compatibility, always use canvas dimensions
                    await electronAPI.exportVideo(tracks, mediaLibrary, settings.outputPath, 'custom', settings.customWidth, settings.customHeight, 'medium', canvasColor || '#000000');
                    
                    // Reset after successful export
                    setTimeout(() => {
                      setIsExporting(false);
                      setExportProgress(0);
                    }, 2000);
                  } catch (error: any) {
                    console.error('Export failed:', error);
                    setIsExporting(false);
                    setExportProgress(0);
                    throw error;
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      <div ref={containerRef} className="flex-1 overflow-auto relative">
        <div className="flex">
          {/* Track Labels */}
          <div className="flex-shrink-0 bg-gray-750" style={{ width: TRACK_LABEL_WIDTH }}>
            <div style={{ height: RULER_HEIGHT }} className="border-b border-gray-700" />
            {tracks
              .slice()
              .sort((a, b) => a.order - b.order) // Sort so Track 1 (lower order) appears at top of timeline
              .map((track, index) => (
              <div
                key={track.id}
                style={{ height: TRACK_HEIGHT }}
                className="border-b border-gray-700 flex items-center justify-center text-gray-400 text-sm group relative"
              >
                <span>Track {index + 1}</span>
                <button
                  onClick={() => removeTrack(track.id)}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-600/20 rounded"
                  title="Delete track"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            ))}
          </div>

          {/* Timeline Canvas */}
          <div className="flex-1">
            {/* Ruler */}
            <div
              ref={canvasRef}
              className="sticky top-0 z-40 bg-gray-800 border-b border-gray-700 cursor-pointer"
              style={{ height: RULER_HEIGHT, width: timelineWidth }}
              onClick={handleRulerClick}
            >
              {getRulerMarkers().map(({ time, label, isMajor }) => (
                isMajor ? (
                  // Major tick - full height line with label
                  <div
                    key={`major-${time}`}
                    className="absolute top-0 h-full"
                    style={{ left: time * zoom }}
                  >
                    <div className="w-px h-full bg-gray-500" />
                    {label && (
                      <span 
                        className="absolute top-1 text-[10px] text-gray-300 whitespace-nowrap font-medium px-1 py-0.5 bg-gray-800 rounded-sm"
                        style={{ left: '50%', transform: 'translateX(-50%)' }}
                      >
                        {label}
                      </span>
                    )}
                  </div>
                ) : (
                  // Minor tick - dot at bottom
                  <div
                    key={`minor-${time}`}
                    className="absolute bottom-0"
                    style={{ left: time * zoom }}
                  >
                    <div className="w-0.5 h-2 bg-gray-600" />
                  </div>
                )
              ))}
            </div>

            {/* Tracks */}
            <div className="relative" style={{ width: timelineWidth }}>
              {tracks
                .slice()
                .sort((a, b) => a.order - b.order) // Sort so Track 1 (lower order) appears at top of timeline
                .map((track, trackIndex) => (
                <div
                  key={track.id}
                  className={`relative border-b border-gray-700 transition-colors ${
                    hoveredTrackId === track.id && dragState.type === 'move' && dragState.sourceTrackId !== track.id
                      ? 'bg-purple-900/30 ring-2 ring-purple-500 ring-inset'
                      : 'bg-gray-850'
                  }`}
                  style={{ height: TRACK_HEIGHT }}
                  onDrop={(e) => handleDrop(e, trackIndex)}
                  onDragOver={handleDragOver}
                >
                  {/* Grid lines */}
                  {getRulerMarkers().map(({ time, isMajor }) => (
                    isMajor ? (
                      <div
                        key={`grid-major-${time}`}
                        className="absolute top-0 h-full w-px bg-gray-700/40"
                        style={{ left: time * zoom }}
                      />
                    ) : (
                      <div
                        key={`grid-minor-${time}`}
                        className="absolute top-0 h-full w-px bg-gray-700/20"
                        style={{ left: time * zoom }}
                      />
                    )
                  ))}

                  {/* Clips */}
                  {track.clips.map(clip => {
                    const media = getMediaById(clip.assetId);
                    if (!media) return null;

                    const clipWidth = clip.duration * zoom;
                    const clipX = clip.startTime * zoom;
                    const isSelected = selectedClipIds.includes(clip.id);

                    return (
                      <div
                        key={clip.id}
                        className={`absolute top-1 h-[calc(100%-8px)] rounded cursor-move group ${
                          isSelected ? 'ring-2 ring-purple-500' : ''
                        } ${
                          media.type === 'video' ? 'bg-blue-600' :
                          media.type === 'audio' ? 'bg-green-600' :
                          'bg-yellow-600'
                        }`}
                        style={{
                          left: clipX,
                          width: clipWidth,
                        }}
                        onClick={(e) => handleClipClick(e, clip.id)}
                        onMouseDown={(e) => handleClipMouseDown(e, clip, 'move')}
                        onContextMenu={(e) => handleClipContextMenu(e, clip.id)}
                      >
                        {/* Thumbnail */}
                        {media.thumbnail && (
                          <img
                            src={media.thumbnail}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover opacity-30 rounded pointer-events-none"
                          />
                        )}

                        {/* Trim Handle Left */}
                        <div
                          className="absolute left-0 top-0 w-2 h-full bg-purple-500/0 hover:bg-purple-500 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleClipMouseDown(e, clip, 'trim-left');
                          }}
                        />

                        {/* Trim Handle Right */}
                        <div
                          className="absolute right-0 top-0 w-2 h-full bg-purple-500/0 hover:bg-purple-500 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleClipMouseDown(e, clip, 'trim-right');
                          }}
                        />

                        {/* Clip Info */}
                        <div className="relative p-0.5 px-1 pointer-events-none">
                          <div className="text-white text-[10px] font-medium truncate" title={media.name}>
                            {media.name}
                          </div>
                          <div className="text-white/70 text-[9px]">
                            {clip.duration.toFixed(1)}s
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Playhead */}
              <div
                className="absolute top-0 w-0.5 bg-purple-500 z-50"
                style={{
                  left: playheadPosition * zoom,
                  height: tracks.length * TRACK_HEIGHT,
                }}
              >
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-purple-500 rounded-full cursor-grab active:cursor-grabbing select-none"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent text selection
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startPos = playheadPosition;

                    // Set user is seeking to pause playback updates
                    setUserSeeking(true);

                    let lastUpdateTime = 0;
                    const updateThrottle = 16; // ~60fps
                    
                    const handleMove = (moveEvent: MouseEvent) => {
                      moveEvent.preventDefault(); // Prevent text selection while dragging
                      moveEvent.stopPropagation();
                      
                      const now = performance.now();
                      if (now - lastUpdateTime < updateThrottle) return;
                      lastUpdateTime = now;
                      
                      const deltaX = moveEvent.clientX - startX;
                      const deltaTime = deltaX / zoom;
                      const newPos = Math.max(0, Math.min(timelineDuration, startPos + deltaTime));
                      setPlayhead(newPos);
                    };

                    const handleUp = (upEvent: MouseEvent) => {
                      upEvent.preventDefault(); // Prevent any click events
                      upEvent.stopPropagation();
                      // User finished seeking - allow playback to resume
                      setUserSeeking(false);
                      document.removeEventListener('mousemove', handleMove);
                      document.removeEventListener('mouseup', handleUp);
                    };

                    document.addEventListener('mousemove', handleMove);
                    document.addEventListener('mouseup', handleUp);
                  }}
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }} // Prevent selection
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (() => {
        const clip = tracks
          .flatMap(track => track.clips)
          .find(c => c.id === contextMenu.clipId);
        
        if (!clip) return null;
        
        const canSplit = isPlayheadInClip(clip);
        
        return (
          <ClipContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onSplit={handleSplitAtPlayhead}
            onDelete={handleDeleteClip}
            canSplit={canSplit}
          />
        );
      })()}

      {/* Settings Dialog */}
      {/* AI Video Dialog */}
      {showAIVideoDialog && (
        <AIVideoDialog
          onClose={() => setShowAIVideoDialog(false)}
          onVideoGenerated={async (filePath) => {
            try {
              // Process and add to media library
              const mediaAsset = await processMediaFile(filePath);
              useMediaStore.getState().addMedia(mediaAsset);
            } catch (err) {
              console.error('Failed to add AI content to media library:', err);
            }
            setShowAIVideoDialog(false);
          }}
        />
      )}

    </div>
  );
}
