import React, { useEffect, useRef, useState } from 'react';
import { useTimelineStore } from '../../store/timelineStore';

interface PlayheadProps {
  containerHeight: number;
}

export default function Playhead({ containerHeight }: PlayheadProps) {
  const { playheadPosition, zoom, setPlayhead, setUserSeeking } = useTimelineStore();
  const [isDragging, setIsDragging] = useState(false);
  const playheadRef = useRef<HTMLDivElement>(null);

  const x = playheadPosition * zoom;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setUserSeeking(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const timelineElement = playheadRef.current?.parentElement;
      if (!timelineElement) return;

      const rect = timelineElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = Math.max(0, x / zoom);
      setPlayhead(time);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setUserSeeking(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, zoom, setPlayhead, setUserSeeking]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div
      ref={playheadRef}
      className="absolute top-0 z-50 pointer-events-none"
      style={{
        left: `${x}px`,
        height: `${containerHeight}px`,
        transform: 'translateX(-1px)' // Center the 2px line
      }}
    >
      {/* Playhead handle (draggable top part) */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-6 bg-purple-500 rounded-b cursor-grab active:cursor-grabbing pointer-events-auto"
        onMouseDown={handleMouseDown}
        style={{
          clipPath: 'polygon(50% 0%, 0% 30%, 0% 100%, 100% 100%, 100% 30%)'
        }}
      >
        {/* Time indicator */}
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-mono">
          {formatTime(playheadPosition)}
        </div>
      </div>

      {/* Playhead line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-purple-500 pointer-events-none" />
    </div>
  );
}
