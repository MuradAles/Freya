import React, { useRef, useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { PlaybackControls } from './PlaybackControls';
import CompositeCanvas from './CompositeCanvas';
import { useUIStore } from '../../store/uiStore';
import { useMediaStore } from '../../store/mediaStore';
import { useTimelineStore } from '../../store/timelineStore';

export default function PreviewCanvas() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const isPlayingRef = useRef(false);
  const playheadPositionRef = useRef(0);

  const { selectedMediaId } = useUIStore();
  const { getMediaById } = useMediaStore();
  const { tracks, setPlayhead, playheadPosition, isUserSeeking, setUserSeeking } = useTimelineStore();
  
  // Sync refs
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    playheadPositionRef.current = playheadPosition;
  }, [isPlaying, playheadPosition]);

  // Calculate timeline duration
  const getTimelineDuration = () => {
    let maxTime = 0;
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        const endTime = clip.startTime + clip.duration;
        if (endTime > maxTime) {
          maxTime = endTime;
        }
      });
    });
    return maxTime || 60;
  };

  const selectedMedia = selectedMediaId ? getMediaById(selectedMediaId) : null;
  const hasClipsOnTimeline = tracks.some(track => track.clips.length > 0);

  // Show timeline playback if there are clips, otherwise show single media preview
  const isVideoOrAudio = selectedMedia?.type === 'video' || selectedMedia?.type === 'audio';
  const showTimelinePlayback = hasClipsOnTimeline;
  const showMediaPreview = !showTimelinePlayback && isVideoOrAudio;

  // Handle play/pause for timeline mode
  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  // Handle 5-second navigation
  const handleBack5s = () => {
    if (showTimelinePlayback) {
      const newPos = Math.max(0, playheadPosition - 5);
      setPlayhead(newPos);
      playheadPositionRef.current = newPos; // Force update ref
    } else if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleForward5s = () => {
    if (showTimelinePlayback) {
      const maxDuration = getTimelineDuration();
      const newPos = Math.min(maxDuration, playheadPosition + 5);
      setPlayhead(newPos);
      playheadPositionRef.current = newPos; // Force update ref
    } else if (videoRef.current) {
      videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleToStart = () => {
    if (showTimelinePlayback) {
      setPlayhead(0);
      playheadPositionRef.current = 0;
    } else if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const handleToEnd = () => {
    if (showTimelinePlayback) {
      const maxDuration = getTimelineDuration();
      setPlayhead(maxDuration);
      playheadPositionRef.current = maxDuration;
    } else if (videoRef.current) {
      videoRef.current.currentTime = duration;
      setCurrentTime(duration);
    }
  };

  // Handle video ended (for single media preview mode)
  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  // Reset when media changes (single media preview mode)
  useEffect(() => {
    if (!showTimelinePlayback) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [selectedMediaId, showTimelinePlayback]);

  // Update duration and current time for timeline mode
  useEffect(() => {
    if (showTimelinePlayback) {
      setDuration(getTimelineDuration());
      setCurrentTime(playheadPosition);
    }
  }, [showTimelinePlayback, tracks, playheadPosition]);

  // Playback loop - advance playhead when playing timeline
  useEffect(() => {
    if (!isPlaying || !showTimelinePlayback) return;

    const timelineDuration = getTimelineDuration();
    let lastTime = performance.now();
    let animationFrameId: number;

    const animate = () => {
      // If user is seeking, pause the loop but keep it running
      if (isUserSeeking) {
        // Reset timing so we don't get a huge delta when resuming
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      // Check if we should still be playing
      if (!isPlayingRef.current) {
        return;
      }

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Always read from the ref to get the latest playhead position
      // This ensures we respect manual seeks
      let currentPlayhead = playheadPositionRef.current;
      
      // Advance playhead
      currentPlayhead += deltaTime;

      if (currentPlayhead >= timelineDuration) {
        setPlayhead(timelineDuration);
        setIsPlaying(false);
        return;
      }

      setPlayhead(currentPlayhead);
      playheadPositionRef.current = currentPlayhead;

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying, showTimelinePlayback]);

  return (
    <div className="w-full h-full bg-black flex flex-col relative">
      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {showTimelinePlayback ? (
          /* Timeline playback mode - canvas with all videos positioned */
          <CompositeCanvas
            playheadPosition={playheadPosition}
            isPlaying={isPlaying}
          />
        ) : showMediaPreview && selectedMedia ? (
          /* Single media preview mode */
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
                {showTimelinePlayback
                  ? 'Composite preview - all tracks visible'
                  : selectedMediaId
                  ? 'Drag media to timeline to start editing'
                  : 'Import media to get started'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Playback Controls - Show for timeline or single media */}
      {(showTimelinePlayback || showMediaPreview) && (
        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <PlaybackControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={(time) => {
              if (showTimelinePlayback) {
                setPlayhead(time);
                playheadPositionRef.current = time;
              } else if (videoRef.current) {
                videoRef.current.currentTime = time;
                setCurrentTime(time);
              }
            }}
            onFrameBack={handleBack5s}
            onFrameForward={handleForward5s}
          />
        </div>
      )}
    </div>
  );
}

