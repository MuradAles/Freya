import { useEffect, useRef, useCallback } from 'react';
import { useTimelineStore } from '../store/timelineStore';
import { useMediaStore } from '../store/mediaStore';
import type { TimelineClip } from '../types/timeline';

interface UseTimelineSyncProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
}

export function useTimelineSync({
  videoRef,
  isPlaying,
  setIsPlaying,
  setCurrentTime,
  setDuration
}: UseTimelineSyncProps) {
  const { tracks, playheadPosition, setPlayhead } = useTimelineStore();
  const { getMediaById } = useMediaStore();
  const animationFrameRef = useRef<number>();
  const currentClipRef = useRef<TimelineClip | null>(null);

  // Find the clip at current playhead position
  const findClipAtTime = useCallback((time: number): { clip: TimelineClip; track: any } | null => {
    for (const track of tracks) {
      if (!track.visible) continue;

      for (const clip of track.clips) {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;

        if (time >= clipStart && time < clipEnd) {
          return { clip, track };
        }
      }
    }
    return null;
  }, [tracks]);

  // Get total timeline duration
  const getTimelineDuration = useCallback(() => {
    let maxTime = 0;
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        const endTime = clip.startTime + clip.duration;
        if (endTime > maxTime) {
          maxTime = endTime;
        }
      });
    });
    return maxTime || 60; // Default 60 seconds if empty
  }, [tracks]);

  // Load and play clip at current playhead position
  const loadClipAtPlayhead = useCallback(async () => {
    if (!videoRef.current) return;

    const result = findClipAtTime(playheadPosition);

    if (result) {
      const { clip } = result;
      const media = getMediaById(clip.assetId);

      if (!media) return;

      // Calculate time within the clip
      const timeInClip = playheadPosition - clip.startTime;
      const actualTime = clip.trimStart + timeInClip;

      // If we're on the same clip, just seek
      if (currentClipRef.current?.id === clip.id) {
        videoRef.current.currentTime = actualTime;
        setCurrentTime(actualTime);
      } else {
        // Load new clip
        currentClipRef.current = clip;

        // Convert path to file URL
        const fileUrl = `file:///${media.path.replace(/\\/g, '/')}`;
        videoRef.current.src = fileUrl;
        videoRef.current.currentTime = actualTime;

        // Apply effects
        videoRef.current.playbackRate = clip.speed;
        videoRef.current.volume = clip.volume;

        setCurrentTime(actualTime);
        setDuration(media.duration);

        // Wait for video to be ready
        await new Promise(resolve => {
          if (!videoRef.current) return;
          videoRef.current.onloadeddata = resolve;
        });
      }
    } else {
      // No clip at playhead - show black screen
      if (videoRef.current.src) {
        videoRef.current.src = '';
        currentClipRef.current = null;
        setCurrentTime(0);
        setDuration(0);
      }
    }
  }, [playheadPosition, videoRef, findClipAtTime, getMediaById, setCurrentTime, setDuration]);

  // Playback loop - advance playhead when playing
  useEffect(() => {
    if (!isPlaying || !videoRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const timelineDuration = getTimelineDuration();
    let lastTime = performance.now();
    let playheadRef = playheadPosition; // Use local ref for smooth playback

    const animate = () => {
      const currentTimeMs = performance.now();
      const deltaTime = (currentTimeMs - lastTime) / 1000; // Convert to seconds - always real-time
      lastTime = currentTimeMs;

      // Playback speed is always 1x (real-time), independent of zoom
      const newPlayheadPosition = playheadRef + deltaTime;
      playheadRef = newPlayheadPosition;

      // Check if we've reached the end
      if (newPlayheadPosition >= timelineDuration) {
        setPlayhead(timelineDuration);
        setIsPlaying(false);
        return;
      }

      // Check if we need to transition to next clip
      const currentResult = findClipAtTime(playheadRef - deltaTime);
      const nextResult = findClipAtTime(newPlayheadPosition);

      if (!nextResult) {
        // Gap in timeline - skip to next clip
        let nextClipStart = Infinity;
        tracks.forEach(track => {
          track.clips.forEach(clip => {
            if (clip.startTime > newPlayheadPosition && clip.startTime < nextClipStart) {
              nextClipStart = clip.startTime;
            }
          });
        });

        if (nextClipStart !== Infinity) {
          playheadRef = nextClipStart;
          setPlayhead(nextClipStart);
          loadClipAtPlayhead();
        } else {
          // No more clips - stop playback
          setIsPlaying(false);
          return;
        }
      } else if (currentResult?.clip.id !== nextResult?.clip.id) {
        // Transition to next clip
        setPlayhead(newPlayheadPosition);
        loadClipAtPlayhead();
      } else {
        // Continue playing current clip
        setPlayhead(newPlayheadPosition);

        // Update video currentTime
        if (videoRef.current && nextResult) {
          const timeInClip = newPlayheadPosition - nextResult.clip.startTime;
          const actualTime = nextResult.clip.trimStart + timeInClip;
          videoRef.current.currentTime = actualTime;
          setCurrentTime(actualTime);
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    videoRef.current.play().catch(() => {
      // Ignore play errors
    });

    lastTime = performance.now(); // Reset timing
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, playheadPosition, setPlayhead, setIsPlaying, tracks, videoRef, findClipAtTime, loadClipAtPlayhead, getTimelineDuration, setCurrentTime]);

  // Load clip when playhead changes (manual seek)
  useEffect(() => {
    if (!isPlaying) {
      loadClipAtPlayhead();
    }
  }, [playheadPosition, loadClipAtPlayhead, isPlaying]);

  return {
    loadClipAtPlayhead,
    findClipAtTime,
    getTimelineDuration
  };
}
