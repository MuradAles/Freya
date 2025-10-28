import React, { useState, useEffect, useRef } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { useMediaStore } from '../../store/mediaStore';
import type { TimelineClip as TimelineClipType } from '../../types/timeline';

interface TimelineClipProps {
  clip: TimelineClipType;
  trackId: string;
}

const SNAP_THRESHOLD = 10; // pixels

export default function TimelineClip({ clip, trackId }: TimelineClipProps) {
  const { zoom, selectedClipIds, selectClips, updateClip, tracks } = useTimelineStore();
  const { getMediaById } = useMediaStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const clipRef = useRef<HTMLDivElement>(null);

  const media = getMediaById(clip.assetId);
  const isSelected = selectedClipIds.includes(clip.id);

  const width = clip.duration * zoom;
  const x = clip.startTime * zoom;

  // Get clip color based on media type
  const getClipColor = () => {
    if (!media) return 'bg-gray-600';
    switch (media.type) {
      case 'video':
        return 'bg-blue-600';
      case 'audio':
        return 'bg-green-600';
      case 'image':
        return 'bg-yellow-600';
      default:
        return 'bg-gray-600';
    }
  };

  // Find snap points (other clip edges, grid lines)
  const findSnapPoint = (targetTime: number): number => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return targetTime;

    // Snap to other clips
    for (const otherClip of track.clips) {
      if (otherClip.id === clip.id) continue;

      const otherStart = otherClip.startTime;
      const otherEnd = otherClip.startTime + otherClip.duration;

      // Snap to start or end of other clips
      if (Math.abs((targetTime - otherStart) * zoom) < SNAP_THRESHOLD) {
        return otherStart;
      }
      if (Math.abs((targetTime - otherEnd) * zoom) < SNAP_THRESHOLD) {
        return otherEnd;
      }
    }

    // Snap to grid (1 second intervals)
    const gridInterval = 1;
    const nearestGrid = Math.round(targetTime / gridInterval) * gridInterval;
    if (Math.abs((targetTime - nearestGrid) * zoom) < SNAP_THRESHOLD) {
      return nearestGrid;
    }

    return targetTime;
  };

  // Check if position would overlap with other clips
  const wouldOverlap = (newStartTime: number, newDuration: number): boolean => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return false;

    const newEndTime = newStartTime + newDuration;

    for (const otherClip of track.clips) {
      if (otherClip.id === clip.id) continue;

      const otherStart = otherClip.startTime;
      const otherEnd = otherClip.startTime + otherClip.duration;

      // Check for overlap
      if (newStartTime < otherEnd && newEndTime > otherStart) {
        return true;
      }
    }

    return false;
  };

  const handleClipClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      if (isSelected) {
        selectClips(selectedClipIds.filter(id => id !== clip.id));
      } else {
        selectClips([...selectedClipIds, clip.id]);
      }
    } else {
      // Single selection
      selectClips([clip.id]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('trim-handle')) return;
    e.stopPropagation();
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartTime(clip.startTime);
  };

  const handleLeftTrimMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizingLeft(true);
    setDragStartX(e.clientX);
    setDragStartTime(clip.startTime);
  };

  const handleRightTrimMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizingRight(true);
    setDragStartX(e.clientX);
  };

  useEffect(() => {
    if (!isDragging && !isResizingLeft && !isResizingRight) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX;
      const deltaTime = deltaX / zoom;

      if (isDragging) {
        // Move clip
        let newStartTime = Math.max(0, dragStartTime + deltaTime);
        newStartTime = findSnapPoint(newStartTime);

        // Check for overlap
        if (!wouldOverlap(newStartTime, clip.duration)) {
          updateClip(clip.id, { startTime: newStartTime });
        }
      } else if (isResizingLeft) {
        // Trim left (adjust trimStart and startTime)
        const newStartTime = Math.max(0, dragStartTime + deltaTime);
        const trimChange = newStartTime - clip.startTime;
        const newTrimStart = Math.max(0, clip.trimStart + trimChange);
        const newDuration = clip.duration - trimChange;

        if (newDuration > 0.1 && newTrimStart < media?.duration!) {
          updateClip(clip.id, {
            startTime: newStartTime,
            trimStart: newTrimStart,
            duration: newDuration
          });
        }
      } else if (isResizingRight) {
        // Trim right (adjust trimEnd and duration)
        const newDuration = Math.max(0.1, clip.duration + deltaTime);
        const maxDuration = (media?.duration || 0) - clip.trimStart;

        if (newDuration <= maxDuration) {
          updateClip(clip.id, {
            duration: newDuration,
            trimEnd: clip.trimStart + newDuration
          });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizingLeft, isResizingRight, dragStartX, dragStartTime, zoom, clip, updateClip, media]);

  if (!media) return null;

  return (
    <div
      ref={clipRef}
      className={`absolute top-1 h-14 rounded ${getClipColor()} ${
        isSelected ? 'ring-2 ring-purple-500' : 'ring-1 ring-black/20'
      } overflow-hidden cursor-move select-none transition-shadow hover:shadow-lg`}
      style={{
        left: `${x}px`,
        width: `${width}px`,
      }}
      onClick={handleClipClick}
      onMouseDown={handleMouseDown}
    >
      {/* Thumbnail/Background */}
      {media.thumbnail && media.type !== 'audio' && (
        <img
          src={media.thumbnail}
          alt={media.name}
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          style={{ objectFit: 'cover' }}
        />
      )}

      {/* Audio waveform placeholder */}
      {media.type === 'audio' && (
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <svg width="100%" height="40" className="px-1">
            {Array.from({ length: Math.floor(width / 4) }).map((_, i) => (
              <rect
                key={i}
                x={i * 4}
                y={20 - Math.random() * 15}
                width="2"
                height={Math.random() * 20 + 5}
                fill="currentColor"
              />
            ))}
          </svg>
        </div>
      )}

      {/* Clip Info */}
      <div className="relative h-full p-2 flex flex-col justify-between">
        <div className="text-white text-xs font-medium truncate">
          {media.name}
        </div>
        <div className="text-white/60 text-[10px]">
          {clip.duration.toFixed(1)}s
        </div>
      </div>

      {/* Trim Handles */}
      <div
        className="trim-handle absolute left-0 top-0 w-2 h-full bg-purple-500/50 hover:bg-purple-500 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity"
        onMouseDown={handleLeftTrimMouseDown}
      />
      <div
        className="trim-handle absolute right-0 top-0 w-2 h-full bg-purple-500/50 hover:bg-purple-500 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity"
        onMouseDown={handleRightTrimMouseDown}
      />

      {/* Visual fade indicators */}
      {clip.fadeIn > 0 && (
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-black/50 to-transparent pointer-events-none"
          style={{ width: `${clip.fadeIn * zoom}px` }}
        />
      )}
      {clip.fadeOut > 0 && (
        <div
          className="absolute right-0 top-0 h-full bg-gradient-to-l from-black/50 to-transparent pointer-events-none"
          style={{ width: `${clip.fadeOut * zoom}px` }}
        />
      )}
    </div>
  );
}
