import React, { forwardRef, useEffect } from 'react';
import { pathToFileURL } from '../../utils/fileHandling';

interface VideoPlayerProps {
  src: string | null; // File path
  onTimeUpdate?: (currentTime: number) => void;
  onDurationUpdate?: (duration: number) => void;
  onEnded?: () => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, onTimeUpdate, onDurationUpdate, onEnded }, ref) => {
    const [videoSrc, setVideoSrc] = React.useState<string>('');

    useEffect(() => {
      if (src) {
        // Convert Windows path to file:// URL
        const fileURL = pathToFileURL(src);
        console.log('🎬 Loading video:', fileURL);
        setVideoSrc(fileURL);
        
        // Reset duration when source changes
        if (onDurationUpdate) {
          onDurationUpdate(0);
        }
      } else {
        setVideoSrc('');
        if (onDurationUpdate) {
          onDurationUpdate(0);
        }
      }
    }, [src, onDurationUpdate]);

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      if (onTimeUpdate) {
        onTimeUpdate(video.currentTime);
      }
    };

    const validateAndUpdateDuration = (video: HTMLVideoElement) => {
      const duration = video.duration;
      
      // Validate duration: must be a finite number, greater than 0, and reasonable (less than 24 hours)
      if (
        duration &&
        isFinite(duration) &&
        !isNaN(duration) &&
        duration > 0 &&
        duration < 86400 // 24 hours max
      ) {
        console.log('✅ Valid video duration:', duration);
        if (onDurationUpdate) {
          onDurationUpdate(duration);
        }
      } else {
        console.warn('⚠️ Invalid video duration:', duration, 'for video:', video.src);
        // Try again after a short delay - sometimes metadata needs more time
        setTimeout(() => {
          if (video.duration && isFinite(video.duration) && video.duration > 0 && video.duration < 86400) {
            console.log('✅ Retry: Valid video duration:', video.duration);
            if (onDurationUpdate) {
              onDurationUpdate(video.duration);
            }
          }
        }, 100);
      }
    };

    const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      validateAndUpdateDuration(video);
    };

    const handleLoadedData = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      // Sometimes duration is available only after loadeddata
      const video = e.currentTarget;
      if (video.duration) {
        validateAndUpdateDuration(video);
      }
    };

    const handleDurationChange = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      // Duration might change as more data loads
      const video = e.currentTarget;
      if (video.duration) {
        validateAndUpdateDuration(video);
      }
    };

    const handleEnded = () => {
      if (onEnded) {
        onEnded();
      }
    };

    if (!videoSrc) {
      return (
        <div className="w-full h-full bg-black flex items-center justify-center">
          <p className="text-gray-500">No video selected</p>
        </div>
      );
    }

    return (
      <video
        ref={ref}
        src={videoSrc}
        preload="metadata"
        className="w-full h-full object-contain bg-black"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={handleLoadedData}
        onDurationChange={handleDurationChange}
        onEnded={handleEnded}
      />
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

