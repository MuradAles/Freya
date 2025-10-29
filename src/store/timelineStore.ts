import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track, TimelineClip } from '../types/timeline';

interface TimelineStore {
  // State
  tracks: Track[];
  playheadPosition: number;
  selectedClipIds: string[];
  zoom: number;
  duration: number;
  isUserSeeking: boolean; // Track if user is manually scrubbing
  
  // Actions
  addTrack: () => void;
  removeTrack: (trackId: string) => void;
  addClip: (trackId: string, clip: TimelineClip) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  deleteClip: (clipId: string) => void;
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void;
  setPlayhead: (time: number) => void;
  setUserSeeking: (isSeeking: boolean) => void;
  selectClips: (clipIds: string[]) => void;
  setZoom: (zoom: number) => void;
  splitClip: (clipId: string, splitTime: number) => void;
}

// Helper to generate IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useTimelineStore = create<TimelineStore>()(
  persist(
    (set, get): TimelineStore => ({
      // Initial state
      tracks: [],
      playheadPosition: 0,
      selectedClipIds: [],
      zoom: 20, // pixels per second (default: 20px/s allows viewing ~3 min in 3600px)
      duration: 0,
      isUserSeeking: false,
      
      addTrack: () => set((state) => {
        const newTrack: Track = {
          id: generateId(),
          order: state.tracks.length,
          clips: [],
          locked: false,
          visible: true,
          name: `Track ${state.tracks.length + 1}`
        };
        return { tracks: [...state.tracks, newTrack] };
      }),
      
      removeTrack: (trackId) => set((state) => ({
        tracks: state.tracks.filter(track => track.id !== trackId)
      })),
      
      addClip: (trackId, clip) => set((state) => ({
        tracks: state.tracks.map(track =>
          track.id === trackId
            ? { ...track, clips: [...track.clips, clip] }
            : track
        )
      })),
      
      updateClip: (clipId, updates) => set((state) => ({
        tracks: state.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip =>
            clip.id === clipId ? { ...clip, ...updates } : clip
          )
        }))
      })),
      
      deleteClip: (clipId) => set((state) => ({
        tracks: state.tracks.map(track => ({
          ...track,
          clips: track.clips.filter(clip => clip.id !== clipId)
        })),
        selectedClipIds: state.selectedClipIds.filter(id => id !== clipId)
      })),
      
      moveClip: (clipId, newTrackId, newStartTime) => {
        const { tracks } = get();
        let clipToMove: TimelineClip | undefined;
        let sourceTrackId: string | undefined;
        
        // Find the clip
        for (const track of tracks) {
          const found = track.clips.find(c => c.id === clipId);
          if (found) {
            clipToMove = found;
            sourceTrackId = track.id;
            break;
          }
        }
        
        if (!clipToMove) return;
        
        set((state) => ({
          tracks: state.tracks.map(track => {
            // Remove from source track
            if (track.id === sourceTrackId) {
              return {
                ...track,
                clips: track.clips.filter(c => c.id !== clipId)
              };
            }
            // Add to target track
            if (track.id === newTrackId) {
              return {
                ...track,
                clips: [...track.clips, { ...clipToMove, trackId: newTrackId, startTime: newStartTime }]
              };
            }
            return track;
          })
        }));
      },
      
      setPlayhead: (time) => set({ playheadPosition: Math.max(0, time) }),
      
      setUserSeeking: (isSeeking) => set({ isUserSeeking: isSeeking }),
      
      selectClips: (clipIds) => set({ selectedClipIds: clipIds }),
      
      setZoom: (zoom) => set({ zoom: Math.max(1, Math.min(200, zoom)) }), // 1px/s (1 hour in 3600px) to 200px/s (max zoom)
      
      splitClip: (clipId, splitTime) => {
        const { tracks } = get();
        
        for (const track of tracks) {
          const clip = track.clips.find(c => c.id === clipId);
          if (clip && splitTime > clip.startTime && splitTime < clip.startTime + clip.duration) {
            // Calculate time positions relative to the clip
            const timeInClip = splitTime - clip.startTime; // Time from start of clip in timeline
            
            // First clip: from start to split point
            const firstDuration = timeInClip;
            const firstTrimEnd = clip.trimStart + firstDuration;
            
            // Second clip: from split point to end
            const secondStart = splitTime;
            const secondDuration = clip.duration - firstDuration;
            const secondTrimStart = clip.trimStart + firstDuration; // New trim start for second clip
            const secondTrimEnd = clip.trimEnd; // Keep original trim end
            
            // Create the two clips with all properties preserved
            const firstClip: TimelineClip = {
              ...clip,
              duration: firstDuration,
              trimEnd: firstTrimEnd,
            };
            
            const secondClip: TimelineClip = {
              ...clip,
              id: generateId(),
              startTime: secondStart,
              duration: secondDuration,
              trimStart: secondTrimStart,
              trimEnd: secondTrimEnd,
            };
            
            // Update selection to include both new clips
            const currentSelection = get().selectedClipIds;
            const newSelection = currentSelection.includes(clipId)
              ? currentSelection.filter(id => id !== clipId).concat([firstClip.id, secondClip.id])
              : currentSelection;
            
            set((state) => ({
              tracks: state.tracks.map(t =>
                t.id === track.id
                  ? {
                      ...t,
                      clips: t.clips.flatMap(c =>
                        c.id === clipId
                          ? [firstClip, secondClip]
                          : [c]
                      )
                    }
                  : t
              ),
              selectedClipIds: newSelection,
            }));
            break;
          }
        }
      },
    }),
    {
      name: 'clipforge-timeline-storage',
    }
  )
);

