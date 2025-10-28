import React, { useState } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { useMediaStore } from '../../store/mediaStore';
import TimelineClip from './TimelineClip';
import type { Track as TrackType } from '../../types/timeline';
import type { TimelineClip as TimelineClipType } from '../../types/timeline';
import { Trash2, Lock, Eye, EyeOff } from 'lucide-react';

interface TrackProps {
  track: TrackType;
  containerWidth: number;
}

export default function Track({ track, containerWidth }: TrackProps) {
  const { addClip, removeTrack, updateClip, zoom } = useTimelineStore();
  const { getMediaById } = useMediaStore();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const mediaId = e.dataTransfer.getData('mediaId');
    if (!mediaId) return;

    const media = getMediaById(mediaId);
    if (!media) return;

    // Calculate drop position
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const startTime = Math.max(0, x / zoom);

    // Snap to grid
    const gridInterval = 1;
    const snappedTime = Math.round(startTime / gridInterval) * gridInterval;

    // Check if position would overlap with existing clips
    const wouldOverlap = track.clips.some(clip => {
      const clipEnd = clip.startTime + clip.duration;
      const newEnd = snappedTime + media.duration;
      return snappedTime < clipEnd && newEnd > clip.startTime;
    });

    if (wouldOverlap) {
      // Find next available position
      let nextAvailableTime = snappedTime;
      const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);

      for (const clip of sortedClips) {
        if (nextAvailableTime < clip.startTime + clip.duration) {
          nextAvailableTime = clip.startTime + clip.duration;
        }
      }

      // Place clip at next available position
      createClip(media.id, nextAvailableTime, media.duration);
    } else {
      // Place at dropped position
      createClip(media.id, snappedTime, media.duration);
    }
  };

  const createClip = (assetId: string, startTime: number, duration: number) => {
    const newClip: TimelineClipType = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      assetId,
      trackId: track.id,
      startTime,
      duration,
      trimStart: 0,
      trimEnd: duration,
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

  const handleTrackClick = (e: React.MouseEvent) => {
    // If clicking on empty space, deselect all clips
    if (e.target === e.currentTarget) {
      useTimelineStore.getState().selectClips([]);
    }
  };

  return (
    <div className="flex border-b border-gray-700 group">
      {/* Track Label */}
      <div className="w-24 flex-shrink-0 bg-gray-750 border-r border-gray-700 p-2 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-300 font-medium truncate">
            {track.name}
          </span>
          <button
            onClick={() => removeTrack(track.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-600/20 rounded"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
          </button>
        </div>

        <div className="flex gap-1">
          <button className="p-1 hover:bg-gray-600 rounded">
            {track.visible ? (
              <Eye className="w-3 h-3 text-gray-400" />
            ) : (
              <EyeOff className="w-3 h-3 text-gray-400" />
            )}
          </button>
          <button className="p-1 hover:bg-gray-600 rounded">
            <Lock className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Track Content */}
      <div
        className={`relative flex-1 h-16 bg-gray-800 ${
          isDragOver ? 'bg-purple-900/20 ring-2 ring-purple-500 ring-inset' : ''
        }`}
        style={{ width: `${containerWidth}px` }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleTrackClick}
      >
        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: Math.ceil(containerWidth / zoom) }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 h-full w-px bg-gray-700/50"
              style={{ left: `${i * zoom}px` }}
            />
          ))}
        </div>

        {/* Clips */}
        {track.clips.map(clip => (
          <TimelineClip key={clip.id} clip={clip} trackId={track.id} />
        ))}
      </div>
    </div>
  );
}
