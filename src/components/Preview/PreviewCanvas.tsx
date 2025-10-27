import React, { useRef, useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { PlaybackControls } from './PlaybackControls';
import { useUIStore } from '../../store/uiStore';
import { useMediaStore } from '../../store/mediaStore';

export default function PreviewCanvas() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const { selectedMediaId } = useUIStore();
  const { getMediaById } = useMediaStore();
  
  const selectedMedia = selectedMediaId ? getMediaById(selectedMediaId) : null;
  const isVideoOrAudio = selectedMedia?.type === 'video' || selectedMedia?.type === 'audio';

  // Handle play/pause
  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Handle frame navigation
  const handleFrameBack = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 1 / 30); // 1/30 second (typical frame rate)
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleFrameForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 1 / 30);
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Handle video ended
  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  // Reset when media changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [selectedMediaId]);

  return (
    <div className="w-full h-full bg-black flex flex-col relative">
      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {isVideoOrAudio && selectedMedia ? (
          <VideoPlayer
            ref={videoRef}
            src={selectedMedia.path}
            onTimeUpdate={setCurrentTime}
            onDurationUpdate={setDuration}
            onEnded={handleVideoEnded}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Play className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Preview Canvas</p>
              <p className="text-gray-600 text-sm mt-2">
                {selectedMediaId ? 'Select a video or audio file to preview' : 'Select media to preview'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Playback Controls - Only show for video/audio */}
      {isVideoOrAudio && selectedMedia && (
        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <PlaybackControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={(time) => {
              if (videoRef.current) {
                videoRef.current.currentTime = time;
                setCurrentTime(time);
              }
            }}
            onFrameBack={handleFrameBack}
            onFrameForward={handleFrameForward}
          />
        </div>
      )}
    </div>
  );
}

