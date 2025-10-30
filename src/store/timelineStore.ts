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
  canvasWidth: number; // Canvas dimensions
  canvasHeight: number;
  
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
  setCanvasWidth: (width: number) => void;
  setCanvasHeight: (height: number) => void;
  setCanvasDimensions: (width: number, height: number) => void;
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
      canvasWidth: 1920, // Default canvas dimensions
      canvasHeight: 1080,
      
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
      
      setCanvasWidth: (width) => {
        const state = get();
        const oldWidth = state.canvasWidth;
        const newWidth = Math.max(128, Math.min(7680, width));
        
        // Adjust all clip positions to maintain aspect ratio
        const scale = newWidth / oldWidth;
        set({
          canvasWidth: newWidth,
          tracks: state.tracks.map(track => ({
            ...track,
            clips: track.clips.map(clip => {
              if (clip.position) {
                // Convert to pixel coordinates with old canvas
                const oldPixelWidth = clip.position.width * oldWidth;
                const oldPixelHeight = clip.position.height * state.canvasHeight;
                if (oldPixelHeight === 0) return clip; // Avoid division by zero
                const pixelAspectRatio = oldPixelWidth / oldPixelHeight;
                
                // Scale width proportionally, maintain aspect ratio
                const newPixelWidth = oldPixelWidth * scale;
                const newPixelHeight = newPixelWidth / pixelAspectRatio;
                
                return {
                  ...clip,
                  position: {
                    ...clip.position,
                    width: newPixelWidth / newWidth,
                    height: newPixelHeight / state.canvasHeight,
                  }
                };
              }
              return clip;
            })
          }))
        });
      },
      setCanvasHeight: (height) => {
        const state = get();
        const oldHeight = state.canvasHeight;
        const newHeight = Math.max(128, Math.min(4320, height));
        
        // Adjust all clip positions to maintain aspect ratio
        const scale = newHeight / oldHeight;
        set({
          canvasHeight: newHeight,
          tracks: state.tracks.map(track => ({
            ...track,
            clips: track.clips.map(clip => {
              if (clip.position) {
                // Convert to pixel coordinates with old canvas
                const oldPixelWidth = clip.position.width * state.canvasWidth;
                const oldPixelHeight = clip.position.height * oldHeight;
                if (oldPixelHeight === 0) return clip; // Avoid division by zero
                const pixelAspectRatio = oldPixelWidth / oldPixelHeight;
                
                // Scale height proportionally, maintain aspect ratio
                const newPixelHeight = oldPixelHeight * scale;
                const newPixelWidth = newPixelHeight * pixelAspectRatio;
                
                return {
                  ...clip,
                  position: {
                    ...clip.position,
                    width: newPixelWidth / state.canvasWidth,
                    height: newPixelHeight / newHeight,
                  }
                };
              }
              return clip;
            })
          }))
        });
      },
      setCanvasDimensions: (width, height) => {
        const state = get();
        const oldWidth = state.canvasWidth;
        const oldHeight = state.canvasHeight;
        const newWidth = Math.max(128, Math.min(7680, width));
        const newHeight = Math.max(128, Math.min(4320, height));
        
        // Calculate scale factors - use geometric mean to preserve aspect ratio better
        const scaleX = newWidth / oldWidth;
        const scaleY = newHeight / oldHeight;
        const scale = Math.sqrt(scaleX * scaleY);
        
        set({
          canvasWidth: newWidth,
          canvasHeight: newHeight,
          tracks: state.tracks.map(track => ({
            ...track,
            clips: track.clips.map(clip => {
              if (clip.position) {
                // Convert to pixel coordinates with old canvas
                const oldPixelWidth = clip.position.width * oldWidth;
                const oldPixelHeight = clip.position.height * oldHeight;
                if (oldPixelHeight === 0) return clip; // Avoid division by zero
                const pixelAspectRatio = oldPixelWidth / oldPixelHeight;
                
                // Scale maintaining aspect ratio
                const newPixelWidth = oldPixelWidth * scale;
                const newPixelHeight = newPixelWidth / pixelAspectRatio;
                
                // Convert back to normalized coordinates
                return {
                  ...clip,
                  position: {
                    ...clip.position,
                    width: newPixelWidth / newWidth,
                    height: newPixelHeight / newHeight,
                  }
                };
              }
              return clip;
            })
          }))
        });
      },
    }),
    {
      name: 'clipforge-timeline-storage',
    }
  )
);

