import React, { useState } from 'react';
import { Play, Pause, SkipForward, SkipBack } from 'lucide-react';

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onFrameBack?: () => void;
  onFrameForward?: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onSeek,
  onFrameBack,
  onFrameForward,
}) => {
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  return (
    <div className="flex items-center justify-center px-2 py-1 bg-gray-800 rounded">
      <div className="flex items-center gap-1">
        {/* Left: Frame back */}
        <button
          onClick={onFrameBack}
          className="p-1 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={currentTime === 0}
        >
          <SkipBack className="w-4 h-4 text-white" />
        </button>

        {/* Center: Play/Pause */}
        <button
          onClick={handlePlayPause}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white" />
          )}
        </button>

        {/* Right: Frame forward */}
        <button
          onClick={onFrameForward}
          className="p-1 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={currentTime >= duration}
        >
          <SkipForward className="w-4 h-4 text-white" />
        </button>

        {/* Timecode display */}
        <div className="flex items-center ml-2">
          <span className="text-[10px] text-gray-300 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};

