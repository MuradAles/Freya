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
  
  // Actions
  addTrack: () => void;
  removeTrack: (trackId: string) => void;
  addClip: (trackId: string, clip: TimelineClip) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  deleteClip: (clipId: string) => void;
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void;
  setPlayhead: (time: number) => void;
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
    (set, get) => ({
      // Initial state
      tracks: [],
      playheadPosition: 0,
      selectedClipIds: [],
      zoom: 50, // pixels per second
      duration: 0,
      
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
                clips: [...track.clips, { ...clipToMove, startTime: newStartTime }]
              };
            }
            return track;
          })
        }));
      },
      
      setPlayhead: (time) => set({ playheadPosition: Math.max(0, time) }),
      
      selectClips: (clipIds) => set({ selectedClipIds: clipIds }),
      
      setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(500, zoom)) }),
      
      splitClip: (clipId, splitTime) => {
        const { tracks } = get();
        
        for (const track of tracks) {
          const clip = track.clips.find(c => c.id === clipId);
          if (clip && splitTime > clip.startTime && splitTime < clip.startTime + clip.duration) {
            // Create two clips
            const firstDuration = splitTime - clip.startTime;
            const secondStart = splitTime;
            const secondDuration = clip.duration - firstDuration;
            
            set((state) => ({
              tracks: state.tracks.map(t =>
                t.id === track.id
                  ? {
                      ...t,
                      clips: t.clips.flatMap(c =>
                        c.id === clipId
                          ? [
                              { ...c, duration: firstDuration },
                              { ...c, id: generateId(), startTime: secondStart, duration: secondDuration }
                            ]
                          : [c]
                      )
                    }
                  : t
              )
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

