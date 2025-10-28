import React from 'react';
import { useTimelineStore } from '../../store/timelineStore';

interface TimelineRulerProps {
  containerWidth: number;
}

export default function TimelineRuler({ containerWidth }: TimelineRulerProps) {
  const { zoom, setPlayhead } = useTimelineStore();

  // Calculate time markers based on zoom level
  const getTimeMarkers = () => {
    const markers: { time: number; label: string; x: number }[] = [];

    // Determine marker interval based on zoom level
    // Aim for markers every 80-150 pixels for good visual spacing
    let interval: number;
    if (zoom >= 100) {
      interval = 1; // 1 second when very zoomed in (100px/s means 1s = 100px)
    } else if (zoom >= 50) {
      interval = 2; // 2 seconds (50px/s means 2s = 100px)
    } else if (zoom >= 20) {
      interval = 5; // 5 seconds (20px/s means 5s = 100px)
    } else if (zoom >= 10) {
      interval = 10; // 10 seconds (10px/s means 10s = 100px)
    } else if (zoom >= 5) {
      interval = 30; // 30 seconds (5px/s means 30s = 150px)
    } else if (zoom >= 2) {
      interval = 60; // 1 minute (2px/s means 60s = 120px)
    } else {
      interval = 300; // 5 minutes when very zoomed out
    }

    const totalTime = Math.ceil(containerWidth / zoom);

    for (let time = 0; time <= totalTime; time += interval) {
      const x = time * zoom;
      const hours = Math.floor(time / 3600);
      const minutes = Math.floor((time % 3600) / 60);
      const seconds = time % 60;

      let label: string;
      if (hours > 0) {
        label = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else if (minutes > 0) {
        label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      } else {
        label = `${seconds}s`;
      }

      markers.push({ time, label, x });
    }

    return markers;
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / zoom;
    setPlayhead(time);
  };

  const markers = getTimeMarkers();

  return (
    <div
      className="relative h-8 bg-gray-800 border-b border-gray-700 cursor-pointer select-none"
      onClick={handleClick}
      style={{ width: `${containerWidth}px` }}
    >
      {markers.map(({ time, label, x }) => (
        <div
          key={time}
          className="absolute top-0 h-full"
          style={{ left: `${x}px` }}
        >
          {/* Vertical marker line */}
          <div className="absolute top-0 w-px h-full bg-gray-600" />

          {/* Time label */}
          <div className="absolute top-1 left-1 text-[10px] text-gray-400 whitespace-nowrap">
            {label}
          </div>
        </div>
      ))}

      {/* Sub-markers (smaller ticks between major markers) */}
      {zoom >= 50 && markers.map(({ time, x }, index) => {
        if (index === markers.length - 1) return null;
        const nextMarker = markers[index + 1];
        const interval = nextMarker.time - time;
        const subTicks: number[] = [];

        // Add sub-ticks
        for (let i = 1; i < interval; i++) {
          subTicks.push(time + i);
        }

        return subTicks.map(subTime => (
          <div
            key={`sub-${subTime}`}
            className="absolute top-0 w-px h-2 bg-gray-700"
            style={{ left: `${subTime * zoom}px` }}
          />
        ));
      })}
    </div>
  );
}
