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
      } else {
        setVideoSrc('');
      }
    }, [src]);

    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      if (onTimeUpdate) {
        onTimeUpdate(video.currentTime);
      }
    };

    const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      if (onDurationUpdate) {
        onDurationUpdate(video.duration);
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
        className="w-full h-full object-contain bg-black"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

