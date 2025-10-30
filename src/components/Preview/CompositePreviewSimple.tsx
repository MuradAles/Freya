import { useRef, useEffect } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { useMediaStore } from '../../store/mediaStore';
import { pathToFileURL } from '../../utils/fileHandling';
import type { TimelineClip, Track } from '../../types/timeline';
import type { MediaAsset } from '../../types/media';

interface CompositePreviewSimpleProps {
  playheadPosition: number;
  isPlaying: boolean;
}

export default function CompositePreviewSimple({ playheadPosition, isPlaying }: CompositePreviewSimpleProps) {
  const { tracks } = useTimelineStore();
  const { getMediaById } = useMediaStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefsMap = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Find all clips at playhead position
  const getClipsAtPlayhead = () => {
    const clips: Array<{ clip: TimelineClip; media: MediaAsset; track: Track }> = [];

    tracks.forEach(track => {
      if (!track.visible) return;
      track.clips.forEach(clip => {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;

        // Only include clip if playhead is within bounds
        if (playheadPosition >= clipStart && playheadPosition < clipEnd) {
          const media = getMediaById(clip.assetId);
          if (media) {
            clips.push({ clip, media, track });
          }
        }
      });
    });

    return clips.sort((a, b) => a.track.order - b.track.order); // Lower order track first (Track 1 on top)
  };

  // Update video and audio elements
  useEffect(() => {
    const clipsAtPlayhead = getClipsAtPlayhead();

    // Find top video
    const topVideo = clipsAtPlayhead.find(c => c.media.type === 'video');

    if (topVideo && videoRef.current) {
      const { clip, media } = topVideo;
      const fileUrl = pathToFileURL(media.path);
      const timeInClip = playheadPosition - clip.startTime;
      const actualTime = clip.trimStart + timeInClip;

      if (videoRef.current.src !== fileUrl) {
        videoRef.current.src = fileUrl;
      }

      videoRef.current.currentTime = actualTime;
      videoRef.current.playbackRate = clip.speed;
      videoRef.current.volume = 0; // Video element muted, use separate audio

      if (isPlaying) {
        videoRef.current.play().catch(() => {
          // Ignore play errors
        });
      } else {
        videoRef.current.pause();
      }
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }

    // Handle all audio
    const currentClipIds = new Set(clipsAtPlayhead.map(c => c.clip.id));

    // First, pause ALL audio elements when not playing
    if (!isPlaying) {
      audioRefsMap.current.forEach(audio => {
        audio.pause();
      });
    }

    // Create/update audio elements
    clipsAtPlayhead.forEach(({ clip, media }) => {
      if (media.type === 'video' || media.type === 'audio') {
        if (!audioRefsMap.current.has(clip.id)) {
          const audio = new Audio();
          audioRefsMap.current.set(clip.id, audio);
        }

        const audio = audioRefsMap.current.get(clip.id);
        if (!audio) return;
        const fileUrl = pathToFileURL(media.path);
        const timeInClip = playheadPosition - clip.startTime;
        const actualTime = clip.trimStart + timeInClip;

        if (audio.src !== fileUrl) {
          audio.src = fileUrl;
        }

        audio.currentTime = actualTime;
        audio.playbackRate = clip.speed;
        audio.volume = clip.volume;

        if (isPlaying) {
          audio.play().catch(() => {
            // Ignore play errors
          });
        } else {
          audio.pause();
        }
      }
    });

    // Cleanup unused audio
    audioRefsMap.current.forEach((audio, id) => {
      if (!currentClipIds.has(id)) {
        audio.pause();
        audio.src = '';
        audioRefsMap.current.delete(id);
      }
    });
  }, [playheadPosition, isPlaying, tracks, getMediaById, getClipsAtPlayhead]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRefsMap.current.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      audioRefsMap.current.clear();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="max-w-full max-h-full object-contain"
      style={{ backgroundColor: 'black' }}
    />
  );
}
