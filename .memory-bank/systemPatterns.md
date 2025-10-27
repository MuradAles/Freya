# Freya - System Patterns

## Architecture Overview

Freya uses a **classic Electron architecture** with clear separation between main and renderer processes.

```
┌─────────────────────────────────────────────────────┐
│           Electron Main Process                      │
│  • Window Management                                │
│  • File System Access                               │
│  • FFmpeg Process Management                        │
│  • IPC Communication                                │
│  • IPC: fileHandlers, recording, export            │
└─────────────────────────────────────────────────────┘
                         ↕ IPC (Inter-Process Communication)
┌─────────────────────────────────────────────────────┐
│         Electron Renderer Process                   │
│  • React Application                                │
│  • UI Components                                     │
│  • State Management (Zustand)                       │
│  • Video Player (HTML5)                             │
└─────────────────────────────────────────────────────┘
                         ↕ localStorage
┌─────────────────────────────────────────────────────┐
│              Local Storage                           │
│  • Persisted Zustand stores                         │
│  • Theme preferences                                │
│  • Media library references                         │
│  • Timeline data                                    │
└─────────────────────────────────────────────────────┘
```

## Component Architecture

### Component Hierarchy

```
App.tsx
├── Sidebar (300px)
│   ├── RecordingPanel (future)
│   ├── ImportButton
│   └── MediaGrid
│       └── MediaItem[] (2-column grid)
│
├── Center (flex)
│   ├── PreviewCanvas (flex-1)
│   │   └── VideoPlayer
│   └── PlaybackControls
│
├── PropertiesPanel (300px)
│   └── [No Selection] → ClipProperties when selected
│
└── Timeline (250px height)
    ├── TimelineControls (zoom, export button)
    ├── TimelineRuler (time markers)
    └── Track[] (future: multiple tracks)
        └── Clip[] (colored blocks)
```

### Data Flow Patterns

**Import Flow:**
```
User → FileDialog → Main Process → IPC → Renderer
  → fileHandling.ts → thumbnailGenerator.ts
  → mediaStore.addMedia() → MediaGrid re-renders
```

**Timeline Flow:**
```
User → Drag MediaItem → Drop on Timeline
  → timelineStore.addClip() → Timeline re-renders
  → Playhead updates → Preview syncs
```

**Preview Flow:**
```
User → Click MediaItem
  → Set selected media ID
  → VideoPlayer loads source
  → PlaybackControls enabled
```

**Export Flow:**
```
User → Click Export → ExportDialog
  → Select path/resolution
  → IPC to main process
  → FFmpeg processes timeline
  → Progress updates via IPC
  → Complete → Save file
```

## State Management Patterns

### Zustand Stores

**1. MediaStore** (`src/store/mediaStore.ts`)
```typescript
interface MediaStore {
  mediaLibrary: MediaAsset[];
  addMedia: (asset: MediaAsset) => void;
  removeMedia: (id: string) => void;
  getMediaById: (id: string) => MediaAsset | undefined;
  clearLibrary: () => void;
}
```

**Pattern:** CRUD operations on media assets
- **Add:** O(n) append to array
- **Get:** O(n) find by ID
- **Persist:** localStorage via Zustand persist middleware
- **Thumbnails:** Stored as data URLs in MediaAsset.thumbnail

**2. TimelineStore** (`src/store/timelineStore.ts`)
```typescript
interface TimelineStore {
  tracks: Track[];
  playheadPosition: number;
  selectedClipIds: string[];
  zoom: number;
  duration: number;
  
  // Operations
  addTrack: () => void;
  addClip: (trackId, clip) => void;
  updateClip: (clipId, updates) => void;
  splitClip: (clipId, splitTime) => void;
}
```

**Pattern:** Hierarchical data (Tracks → Clips)
- **Tracks:** Array of Track objects
- **Clips:** Nested within each Track
- **Position:** Absolute time on timeline
- **Zoom:** Pixels per second calculation

**3. UIStore** (`src/store/uiStore.ts`)
```typescript
interface UIStore {
  isRecording: boolean;
  isExporting: boolean;
  exportProgress: number;
  selectedPanel: 'media' | 'recording';
}
```

**Pattern:** UI ephemeral state (not persisted)
- **Recording state:** Tracks active recording
- **Export progress:** 0-100 percentage
- **Selected panel:** Tabs in sidebar

## IPC Communication Patterns

### Request-Response Pattern

**File Import:**
```typescript
// Renderer → Main
const paths = await window.electronAPI.dialogOpenFile();

// Main → File System
// Return: string[]
```

**FFmpeg Export:**
```typescript
// Renderer → Main
const result = await window.electronAPI.exportVideo(timeline, path);

// Main → FFmpeg process
// Progress: IPC updates back to renderer
// Return: { success: boolean, outputPath: string }
```

### Event-Listener Pattern

**Recording Status:**
```typescript
// Main → Renderer
window.electronAPI.onRecordingStatus((status) => {
  // Update UI store
});

// Main broadcasts events
ipcMain.emit('recording-status', { isRecording: true });
```

## File & Folder Structure Patterns

### Component Organization

**Folder-by-feature** (not by type)
```
src/components/
├── Sidebar/           # Sidebar feature
│   ├── Sidebar.tsx
│   ├── MediaGrid.tsx
│   └── MediaItem.tsx
├── Preview/           # Preview feature
│   ├── PreviewCanvas.tsx
│   ├── VideoPlayer.tsx
│   └── PlaybackControls.tsx
└── Timeline/          # Timeline feature
    ├── Timeline.tsx
    └── [future: Track, Clip, Playhead]
```

**Why:** Components are grouped by user-facing features, not by technical type (presentational vs container).

### Utility Organization

**Single-purpose functions:**
```
src/utils/
├── fileHandling.ts    # File operations
├── thumbnailGenerator.ts  # Media processing
├── formatters.ts      # Time formatting, file size
└── [future: timelineCalculations.ts]
```

**Pattern:** One file per concern, export multiple functions per file.

## Styling Patterns

### Tailwind Utility Classes

**Theme-aware classes:**
```css
bg-gray-900  /* Dark background */
text-white   /* Light text */
border-gray-700  /* Dark border */
```

**Component-level styling:**
```tsx
<div className="flex gap-2 p-4 border rounded-lg">
  {/* No separate CSS file needed */}
</div>
```

### Responsive Layout

**Fixed sidebars, flexible center:**
```tsx
<div className="flex h-screen">
  <div className="w-[300px]">Sidebar</div>
  <div className="flex-1">Center</div>
  <div className="w-[300px]">Properties</div>
</div>
```

**Pattern:** `w-[300px]` for fixed, `flex-1` for flexible

## TypeScript Patterns

### Interface Definitions

**Media Types** (`src/types/media.ts`):
```typescript
export interface MediaAsset {
  id: string;
  type: 'video' | 'audio' | 'image';
  path: string;
  duration: number;
  thumbnail: string;
  // ...
}
```

**Timeline Types** (`src/types/timeline.ts`):
```typescript
export interface TimelineClip {
  id: string;
  assetId: string;  // Reference to MediaAsset
  startTime: number;
  duration: number;
  // Effects...
}
```

**Pattern:** Shared interfaces in `/types`, imported where needed.

### Type Safety

**Strict TypeScript:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
}
```

**IPC Typing** (`src/types/electron.d.ts`):
```typescript
declare global {
  interface Window {
    electronAPI: {
      dialogOpenFile: () => Promise<string[]>;
      exportVideo: (timeline, path) => Promise<Result>;
    };
  }
}
```

## Performance Patterns

### Thumbnail Optimization

**Generate on demand:**
```typescript
// Only generate when needed (import time)
async function generateThumbnail(filePath) {
  // Extract first frame
  // Convert to data URL
  // Return base64 string
}
```

**Storage:** Data URLs in Zustand (persisted in localStorage)

### Timeline Rendering

**Virtual scrolling (future):**
```typescript
// Only render visible clips
const visibleClips = clips.filter(clip => 
  clip.startTime + clip.duration > scrollLeft &&
  clip.startTime < scrollRight
);
```

**Current:** Render all clips (fine for < 50 clips)

### State Updates

**Debouncing drag operations:**
```typescript
// Throttle playhead updates during drag
import { useCallback } from 'react';
const debouncedSetPlayhead = useCallback(
  debounce((time) => setPlayhead(time), 50),
  []
);
```

## Error Handling Patterns

### Try-Catch Blocks

**File Import:**
```typescript
try {
  const asset = await processMediaFile(filePath);
  mediaStore.addMedia(asset);
} catch (error) {
  console.error('Failed to import file:', error);
  showErrorToast('File import failed');
}
```

**Export:**
```typescript
try {
  await exportVideo(timeline, outputPath);
} catch (error) {
  // Show error dialog
  showExportErrorDialog(error.message);
}
```

### IPC Error Handling

**Main Process:**
```typescript
ipcMain.handle('export:start', async (event, data) => {
  try {
    // Export logic
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

**Renderer:**
```typescript
const result = await window.electronAPI.exportVideo(...);
if (!result.success) {
  showError(result.error);
}
```

## Testing Patterns (Future)

### Component Testing

**Test imports:**
```typescript
describe('MediaItem', () => {
  it('displays thumbnail and name', () => {
    const asset = createMockMediaAsset();
    render(<MediaItem media={asset} />);
    expect(screen.getByText(asset.name)).toBeVisible();
  });
});
```

### Integration Testing

**Test import flow:**
```typescript
describe('Import Flow', () => {
  it('imports file and adds to library', async () => {
    const file = createTestFile();
    await triggerImport(file);
    expect(mediaStore.getMediaById(id)).toBeDefined();
  });
});
```

## Design Patterns Used

### Observer Pattern
- Zustand subscriptions (components observe state changes)
- IPC event listeners (renderer observes main process events)

### Factory Pattern
- `generateId()` creates unique IDs for clips/tracks
- `createMediaAsset()` creates media objects from files

### Strategy Pattern (Future)
- Different export strategies (single-track vs multi-track)
- Different recording strategies (combined vs separate)

### Command Pattern (Future)
- Undo/redo stack for timeline operations

## Key Architectural Decisions

1. **Electron over Tauri:** Better screen capture APIs
2. **Zustand over Redux:** Simpler API, good performance
3. **Tailwind over CSS Modules:** Faster development
4. **fluent-ffmpeg:** Industry-standard video processing
5. **localStorage persist:** Simple, no backend needed

## Constants & Configuration

**Timeline Settings:**
```typescript
const TIMELINE_SETTINGS = {
  DEFAULT_ZOOM: 50,        // pixels per second
  MIN_ZOOM: 10,
  MAX_ZOOM: 500,
  SNAP_INTERVAL: 1,        // 1-second snaps
  TRACK_HEIGHT: 60,        // pixels
};
```

**Export Settings:**
```typescript
const RESOLUTIONS = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};
```

**Pattern:** Centralized constants in `src/utils/constants.ts` (to be created)

