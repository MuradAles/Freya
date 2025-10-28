import React, { useEffect, useRef, useState } from 'react';
import { Film, Plus, Minus, ZoomIn, ZoomOut } from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import TimelineRuler from './TimelineRuler';
import Track from './Track';
import Playhead from './Playhead';

export default function Timeline() {
  const { tracks, zoom, setZoom, addTrack } = useTimelineStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(5000); // Default width

  // Initialize with one track if empty
  useEffect(() => {
    if (tracks.length === 0) {
      addTrack();
    }
  }, [tracks.length, addTrack]);

  // Calculate container width based on longest clip or minimum width
  useEffect(() => {
    let maxTime = 60; // Minimum 60 seconds visible

    tracks.forEach(track => {
      track.clips.forEach(clip => {
        const endTime = clip.startTime + clip.duration;
        if (endTime > maxTime) {
          maxTime = endTime;
        }
      });
    });

    // Add 20% padding to the right
    const calculatedWidth = (maxTime * 1.2) * zoom;
    setContainerWidth(Math.max(calculatedWidth, 3000)); // Minimum 3000px
  }, [tracks, zoom]);

  const handleZoomIn = () => {
    setZoom(Math.min(200, zoom * 1.5));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(1, zoom / 1.5));
  };

  const handleAddTrack = () => {
    addTrack();
  };

  // Wheel zoom (Ctrl + wheel)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(Math.max(1, Math.min(200, zoom * delta)));
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [zoom, setZoom]);

  return (
    <div className="w-full h-full bg-gray-800 border-t border-gray-700 flex flex-col">
      {/* Timeline Header */}
      <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Timeline</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <button
            onClick={handleZoomOut}
            className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Add Track Button */}
          <button
            onClick={handleAddTrack}
            className="ml-3 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Track</span>
          </button>

          {/* Export Button */}
          <button className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition-colors">
            Export
          </button>
        </div>
      </div>

      {/* Scrollable Timeline Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto relative"
      >
        {/* Time Ruler - Sticky */}
        <div className="sticky top-0 z-50 bg-gray-800">
          <TimelineRuler containerWidth={containerWidth} />
        </div>

        <div className="relative" style={{ width: `${containerWidth}px` }}>
          {/* Tracks Container */}
          {tracks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
              Add a track to get started
            </div>
          ) : (
            tracks
              .sort((a, b) => b.order - a.order) // Higher order on top
              .map(track => (
                <Track
                  key={track.id}
                  track={track}
                  containerWidth={containerWidth}
                />
              ))
          )}

          {/* Playhead - spans all tracks */}
          {tracks.length > 0 && (
            <Playhead containerHeight={tracks.length * 64 + 32} />
          )}
        </div>
      </div>
    </div>
  );
}

