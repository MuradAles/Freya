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
    <div className="flex items-center justify-between px-4 py-2 bg-gray-800 rounded-lg">
      {/* Left: Frame back */}
      <button
        onClick={onFrameBack}
        className="p-2 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={currentTime === 0}
      >
        <SkipBack className="w-5 h-5 text-white" />
      </button>

      {/* Center: Play/Pause */}
      <button
        onClick={handlePlayPause}
        className="p-2 hover:bg-gray-700 rounded transition-colors"
      >
        {isPlaying ? (
          <Pause className="w-6 h-6 text-white" />
        ) : (
          <Play className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Right: Frame forward */}
      <button
        onClick={onFrameForward}
        className="p-2 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={currentTime >= duration}
      >
        <SkipForward className="w-5 h-5 text-white" />
      </button>

      {/* Timecode display */}
      <div className="flex items-center gap-2 ml-4">
        <span className="text-sm text-gray-300 font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};

