export interface TimelineClip {
  id: string;
  assetId: string;               // References MediaAsset
  trackId: string;
  startTime: number;             // Position in timeline (seconds)
  duration: number;              // Clip duration after effects
  
  // Trimming
  trimStart: number;             // Start offset in source
  trimEnd: number;               // End point in source
  
  // Effects
  speed: number;                 // 0.25 - 16.0
  volume: number;                // 0.0 - 2.0
  fadeIn: number;                // Seconds
  fadeOut: number;               // Seconds
  
  // Positioning (for overlays/images)
  position?: {
    x: number;                   // Pixels from left (0-1 as percentage)
    y: number;                   // Pixels from top (0-1 as percentage)
    width: number;               // Width (0-1 as percentage of canvas)
    height: number;              // Height (0-1 as percentage of canvas)
    rotation: number;            // Rotation in degrees
    zIndex: number;              // Layer order
  };
}

export interface Track {
  id: string;
  order: number;                 // Display order (higher = on top)
  clips: TimelineClip[];
  locked: boolean;               // Prevent editing
  visible: boolean;              // Show/hide in preview
  name: string;                  // Optional custom name
}

export interface Timeline {
  tracks: Track[];
  duration: number;              // Total timeline duration
  playheadPosition: number;      // Current time (seconds)
  zoom: number;                  // Pixels per second
  selectedClipIds: string[];     // Multi-selection
}

