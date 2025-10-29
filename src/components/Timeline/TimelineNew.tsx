import { useEffect, useRef, useState } from 'react';
import { Film, Plus, Minus } from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import { useMediaStore } from '../../store/mediaStore';
import ExportDialog, { type ExportSettings } from '../Dialogs/ExportDialog';
import ProgressDialog from '../Dialogs/ProgressDialog';
import type { TimelineClip } from '../../types/timeline';

const TRACK_HEIGHT = 80;
const TRACK_LABEL_WIDTH = 100;
const RULER_HEIGHT = 40;

export default function TimelineNew() {
  const { tracks, zoom, setZoom, addTrack, playheadPosition, setPlayhead, selectedClipIds, selectClips, addClip, updateClip, deleteClip, setUserSeeking } = useTimelineStore();
  const { getMediaById, mediaLibrary } = useMediaStore();
  
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Listen for export progress updates
  useEffect(() => {
    const handleProgress = (progress: number) => {
      console.log('📊 Progress update from main process:', progress);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(2000);
  const [dragState, setDragState] = useState<{
    type: 'move' | 'trim-left' | 'trim-right' | null;
    clipId: string | null;
    startX: number;
    startTime: number;
    startDuration: number;
    startTrimStart: number;
  }>({
    type: null,
    clipId: null,
    startX: 0,
    startTime: 0,
    startDuration: 0,
    startTrimStart: 0,
  });

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

  // Generate ruler markers
  const getRulerMarkers = () => {
    const markers: { time: number; label: string }[] = [];
    let interval = 30;
    if (zoom >= 100) interval = 1;
    else if (zoom >= 50) interval = 2;
    else if (zoom >= 20) interval = 5;
    else if (zoom >= 10) interval = 10;
    else if (zoom >= 5) interval = 30;
    else if (zoom >= 2) interval = 60;

    // Extend markers to cover the full ruler width (timelineWidth)
    const maxDuration = timelineWidth / zoom;
    for (let t = 0; t <= maxDuration; t += interval) {
      markers.push({ time: t, label: formatTime(t) });
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

    const newClip: TimelineClip = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      assetId: mediaId,
      trackId: track.id,
      startTime,
      duration: media.duration,
      trimStart: 0,
      trimEnd: media.duration,
      speed: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      // Add default position to make clips interactive on canvas
      position: {
        x: 0.25,   // 25% from left
        y: 0.25,   // 25% from top
        width: 0.5,   // 50% of canvas width
        height: 0.5,  // 50% of canvas height
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

  // Handle clip drag start
  const handleClipMouseDown = (e: React.MouseEvent, clip: TimelineClip, type: 'move' | 'trim-left' | 'trim-right') => {
    e.stopPropagation();
    setDragState({
      type,
      clipId: clip.id,
      startX: e.clientX,
      startTime: clip.startTime,
      startDuration: clip.duration,
      startTrimStart: clip.trimStart,
    });
  };

  // Handle mouse move
  useEffect(() => {
    if (!dragState.type || !dragState.clipId) return;

    let lastUpdateTime = 0;
    const throttleMs = 16; // ~60fps

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdateTime < throttleMs) return;
      lastUpdateTime = now;

      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / zoom;

      if (dragState.type === 'move') {
        const newStartTime = Math.max(0, dragState.startTime + deltaTime);
        if (dragState.clipId) {
          updateClip(dragState.clipId, { startTime: newStartTime });
        }
      } else if (dragState.type === 'trim-left') {
        const newTrimStart = Math.max(0, dragState.startTrimStart + deltaTime);
        const newDuration = Math.max(0.1, dragState.startDuration - deltaTime);
        const newStartTime = dragState.startTime + deltaTime;
        
        // Get the clip and media to validate against source duration
        if (dragState.clipId) {
          const clip = tracks.flatMap(t => t.clips).find(c => c.id === dragState.clipId);
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
          const clip = tracks.flatMap(t => t.clips).find(c => c.id === dragState.clipId);
          if (clip) {
            const media = getMediaById(clip.assetId);
            
            // For video/audio, limit to source duration
            if (media && (media.type === 'video' || media.type === 'audio')) {
              const trimStart = clip.trimStart ?? 0;
              const maxDuration = media.duration - trimStart;
              
              // Cap the new duration to max allowed
              const limitedDuration = Math.min(newDuration, maxDuration);
              if (limitedDuration >= 0.1) {
                updateClip(dragState.clipId, { duration: limitedDuration });
              }
            } else {
              // For images or unknown types, no limit
              updateClip(dragState.clipId, { duration: newDuration });
            }
          }
        }
      }
    };

    const handleMouseUp = () => {
      setDragState({
        type: null,
        clipId: null,
        startX: 0,
        startTime: 0,
        startDuration: 0,
        startTrimStart: 0,
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.type, dragState.clipId, dragState.startX, dragState.startTime, dragState.startDuration, dragState.startTrimStart, zoom, updateClip]);

  return (
    <div className="w-full h-full bg-gray-800 border-t border-gray-700 flex flex-col">
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
            onClick={() => setShowExportDialog(true)}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium"
          >
            Export
          </button>
        </div>
      </div>

      {/* Timeline Content */}
      <div ref={containerRef} className="flex-1 overflow-auto relative">
        <div className="flex">
          {/* Track Labels */}
          <div className="flex-shrink-0 bg-gray-750" style={{ width: TRACK_LABEL_WIDTH }}>
            <div style={{ height: RULER_HEIGHT }} className="border-b border-gray-700" />
            {tracks.map((track, index) => (
              <div
                key={track.id}
                style={{ height: TRACK_HEIGHT }}
                className="border-b border-gray-700 flex items-center justify-center text-gray-400 text-sm"
              >
                Track {index + 1}
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
              {getRulerMarkers().map(({ time, label }) => (
                <div
                  key={time}
                  className="absolute top-0 h-full"
                  style={{ left: time * zoom }}
                >
                  <div className="w-px h-full bg-gray-600" />
                  <span className="absolute top-1 left-1 text-[10px] text-gray-400 whitespace-nowrap">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Tracks */}
            <div className="relative" style={{ width: timelineWidth }}>
              {tracks.map((track, trackIndex) => (
                <div
                  key={track.id}
                  className="relative bg-gray-850 border-b border-gray-700"
                  style={{ height: TRACK_HEIGHT }}
                  onDrop={(e) => handleDrop(e, trackIndex)}
                  onDragOver={handleDragOver}
                >
                  {/* Grid lines */}
                  {getRulerMarkers().map(({ time }) => (
                    <div
                      key={time}
                      className="absolute top-0 h-full w-px bg-gray-700/30"
                      style={{ left: time * zoom }}
                    />
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
                        className={`absolute top-2 h-[calc(100%-16px)] rounded cursor-move group ${
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
                        <div className="relative p-2 flex flex-col justify-between h-full pointer-events-none">
                          <span className="text-white text-xs font-medium truncate">
                            {media.name}
                          </span>
                          <span className="text-white/60 text-[10px]">
                            {clip.duration.toFixed(1)}s
                          </span>
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

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={async (settings: ExportSettings) => {
          setShowExportDialog(false);
          setShowProgressDialog(true);
          setExportProgress(0);

          try {
            const electronAPI = (window as any).electronAPI;
            await electronAPI.exportVideo(tracks, mediaLibrary, settings.outputPath, settings.resolution);
            
            setShowProgressDialog(false);
            setExportProgress(0);
            alert('Export complete!');
          } catch (error) {
            console.error('Export failed:', error);
            setShowProgressDialog(false);
            setExportProgress(0);
            alert('Export failed. Please try again.');
          }
        }}
      />

      {/* Progress Dialog */}
      <ProgressDialog
        isOpen={showProgressDialog}
        progress={exportProgress}
        message="Exporting video..."
      />
    </div>
  );
}
