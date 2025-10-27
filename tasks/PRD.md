# ClipForge - Product Requirements Document

**Project:** Desktop Video Editor  
**Timeline:** 72 Hours (Oct 27-29, 2025)  
**MVP Deadline:** Tuesday, Oct 28 at 10:59 PM CT  
**Final Deadline:** Wednesday, Oct 29 at 10:59 PM CT  

---

## Executive Summary

ClipForge is a desktop video editor built with Electron and React that enables creators to record, import, edit, and export professional videos. The application provides a flexible multi-track timeline, real-time preview, and comprehensive editing features including speed control, volume adjustment, and fade effects.

**Core Value Proposition:** A CapCut/Clipchamp-style video editor that runs natively on desktop, offering screen recording, webcam capture, and professional timeline editing in a single application.

---

## Product Vision

Build a production-grade desktop video editor in 72 hours that allows users to:
- Record their screen, webcam, and microphone
- Import video, audio, and image files
- Arrange media on a flexible multi-track timeline
- Apply effects (speed, volume, fade)
- Position overlays and picture-in-picture
- Export professional MP4 videos

The application must be **simple enough to learn in 5 minutes** but **powerful enough for professional use**.

---

## User Stories

### Story 1: Content Creator Recording a Tutorial
**As a** content creator  
**I want to** record my screen and webcam simultaneously  
**So that** I can create engaging tutorial videos with my face visible

**Acceptance Criteria:**
- Can select screen/window to record
- Can enable webcam overlay
- Can position webcam feed while recording
- Recording saves automatically to media library
- Can choose combined or separate files

---

### Story 2: Video Editor Assembling a Montage
**As a** video editor  
**I want to** import multiple clips and arrange them on a timeline  
**So that** I can create a cohesive video sequence

**Acceptance Criteria:**
- Can drag and drop video/audio/image files
- Files appear in media library with thumbnails
- Can drag clips to any timeline track
- Can reorder clips by dragging
- Can trim, split, and delete clips
- Preview updates in real-time

---

### Story 3: YouTuber Exporting Final Video
**As a** YouTuber  
**I want to** export my edited timeline as an MP4  
**So that** I can upload it to YouTube

**Acceptance Criteria:**
- Can select export resolution (720p/1080p/source)
- Export processes all tracks and effects
- Progress bar shows encoding status
- Can cancel export mid-process
- Final file saves to chosen location

---

## Feature Breakdown

### MVP Features (Tuesday 10:59 PM CT)

**Critical Path - Must Have:**

✅ **Desktop Application**
- Electron + React setup
- Window launches successfully
- Packaged as native app (.dmg/.exe)

✅ **Media Import**
- Drag & drop support (MP4, MOV, WebM)
- File picker button
- 2-column grid display with thumbnails
- Shows filename and duration

✅ **Timeline**
- Single video track
- Drag clips from sidebar to timeline
- Visual blocks representing clips
- Playhead (white line) indicator
- Time ruler (0s, 1:00, 2:00, etc.)

✅ **Preview Player**
- HTML5 video element
- Play/pause controls
- Displays current frame at playhead
- Synced with timeline

✅ **Basic Trim**
- Drag clip edges to trim
- Set in/out points
- Visual feedback on timeline

✅ **Export**
- Export to MP4 (1080p)
- Basic FFmpeg integration
- Progress indicator
- Save to file system

---

### Full Features (Wednesday 10:59 PM CT)

**Enhanced Experience:**

✅ **Advanced Import**
- Support MP4, MOV, WebM, MP3, WAV, PNG, JPG
- Audio waveform preview in sidebar
- Video duration overlay
- Hover scrub preview

✅ **Recording System**
- Screen recording (full screen/window/area selection)
- Webcam recording
- Microphone audio
- Checkbox selection (any combination)
- Camera position selector (corners/center/free drag)
- Option: Combined file OR separate files
- Auto-add to media library

✅ **Multi-Track Timeline**
- Unlimited tracks
- [+ Add Track] button
- Drag clips to any track
- Drag clips between tracks
- Track reordering (drag up/down)
- Any media type on any track
- Visual layer stacking

✅ **Timeline Interactions**
- Drag clips left/right (adjust timing)
- Drag clip edges (trim)
- Multi-select clips (Shift+Click, Ctrl+Click, drag box)
- Right-click context menu:
  - Split (at playhead)
  - Delete
  - Duplicate (creates new track)
  - Copy/Paste
- Split affects all selected clips
- Visual selection highlight (purple)

✅ **Timeline Zoom**
- Zoom slider
- +/- buttons
- Ctrl + Mouse wheel
- Snap to playhead
- Snap to clip edges

✅ **Timeline Visuals**
- Audio waveforms in tracks
- Video thumbnails (first frame)
- Hover to scrub preview
- Duration labels
- Speed visualization (clip width changes)

✅ **Canvas Positioning**
- Click clip → drag in preview canvas
- Resize handles (corner drag)
- Position overlays/PiP anywhere
- Visual guides (center lines, snap)
- Z-index control (layer order)

✅ **Properties Panel (Right Sidebar)**
When clip selected, show:
- Speed control (0.25x - 16x)
- Volume control (0% - 200%)
- Fade in (0-5s)
- Fade out (0-5s)
- Filters section (placeholder)
- Effects section (placeholder)

✅ **Effects Implementation**
- **Speed:** Clip shrinks/expands on timeline
- **Volume:** Visual indicator, affects playback
- **Fade:** Opacity transition in preview
- **Trim:** Clip shortened visually
- **Split:** One clip becomes two

✅ **Enhanced Export**
- Multiple resolution options:
  - 720p (1280x720)
  - 1080p (1920x1080)
  - Source resolution
  - 4K (3840x2160) - if source supports
- Multi-track composition
- Apply all effects (speed, volume, fade)
- Overlay positioning preserved
- Progress bar with percentage
- Cancel button
- Estimated time remaining

---

### Out of Scope

❌ **Will NOT Build:**
- Text overlays
- Transitions between clips
- Filters/color grading
- Templates
- Brand kit
- Content library
- Cloud upload
- Undo/redo (if no time)
- Auto-save (if no time)
- Theme customization

---

## UI Layout

### Main Application Window

```
┌────────────────────────────────────────────────────────────────────────┐
│  ☰  ClipForge                                    [_] [□] [X]           │
├──────────────┬──────────────────────────────────────┬──────────────────┤
│              │                                      │                  │
│  MEDIA       │        PREVIEW CANVAS                │   PROPERTIES     │
│  LIBRARY     │                                      │                  │
│              │  ┌────────────────────────────────┐  │  [No Selection]  │
│ ┌──────────┐ │  │                                │  │                  │
│ │🔴 RECORD │ │  │    Current Frame Display       │  │  When clip       │
│ │          │ │  │                                │  │  selected:       │
│ │☑ Screen  │ │  │    (Drag overlays here)        │  │                  │
│ │☑ Camera  │ │  │                                │  │  Speed: [1x ▾]   │
│ │☑ Mic     │ │  └────────────────────────────────┘  │  Volume: ●────   │
│ │          │ │                                      │  Fade In: [0s]   │
│ │[Start]   │ │  [◄◄] [▶] [||] [►►]  00:00 / 05:30  │  Fade Out: [0s]  │
│ └──────────┘ │                                      │                  │
│              │                                      │  Position:       │
│────────────── │                                      │  X: [___]        │
│              │                                      │  Y: [___]        │
│[Import ▾]    │                                      │                  │
│              │                                      │  [Filters]       │
│ ┌────┬────┐  │                                      │  [Effects]       │
│ │🎥  │🖼️  │  │                                      │                  │
│ │2:45│img │  │                                      │                  │
│ └────┴────┘  │                                      │                  │
│ ┌────┬────┐  │                                      │                  │
│ │🎵  │🎥  │  │                                      │                  │
│ │0:23│1:15│  │                                      │                  │
│ └────┴────┘  │                                      │                  │
│              │                                      │                  │
│ [scroll...]  │                                      │                  │
│              │                                      │                  │
└──────────────┴──────────────────────────────────────┴──────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│                          TIMELINE                                      │
│                                                                        │
│  Zoom: [-] ━━━━●━━━━━━ [+]                              [Export ▾]    │
│                                                                        │
│  0s        1:00        2:00        3:00        4:00        5:00       │
│  ├─────────┼──────────┼──────────┼──────────┼──────────┼──────────    │
│                              │← playhead (1:43)                        │
│                                                                        │
│  Track 1:  ▓▓▓▓▓▓▓▓▓▓[video]▓▓▓▓▓▓▓▓                                │
│            [thumbnail preview]                                         │
│                                                                        │
│  Track 2:        ▓▓▓▓[image]▓▓▓▓                                     │
│                                                                        │
│  Track 3:  ≈≈≈≈≈≈≈≈≈≈≈≈[audio]≈≈≈≈≈≈≈≈≈≈                              │
│            [waveform visualization]                                    │
│                                                                        │
│  [+ Add Track]                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Recording Dialog (When User Clicks Start)

```
┌─────────────────────────────────────────┐
│  Select Recording Sources               │
│                                         │
│  Screen Recording:                      │
│  ○ Full Screen                          │
│  ○ Window: [Select Window ▾]            │
│  ○ Custom Area                          │
│                                         │
│  Camera Position (if enabled):          │
│  ┌─────────────────┐                   │
│  │ TL    TC    TR  │                   │
│  │                 │                   │
│  │ ML    C     MR  │  ← Click position │
│  │                 │                   │
│  │ BL    BC    BR  │                   │
│  └─────────────────┘                   │
│                                         │
│  [Cancel]  [Start Recording]            │
└─────────────────────────────────────────┘
```

---

### Recording Output Dialog (After Stop)

```
┌─────────────────────────────────────────┐
│  Recording Complete! (00:02:45)         │
│                                         │
│  How do you want to save?               │
│                                         │
│  ○ Combined Video                       │
│     Camera overlay on screen            │
│     Ready to use immediately            │
│                                         │
│  ○ Separate Files                       │
│     • Screen recording → Track 1        │
│     • Camera recording → Track 2        │
│     • Audio → Track 3                   │
│     More flexible for editing           │
│                                         │
│  [Cancel]  [Save to Library]            │
└─────────────────────────────────────────┘
```

---

### Export Dialog

```
┌─────────────────────────────────────────┐
│  Export Video                           │
│                                         │
│  Resolution:                            │
│  ○ 720p  (1280x720)                     │
│  ● 1080p (1920x1080)  ← Selected        │
│  ○ 4K    (3840x2160)                    │
│  ○ Source Resolution                    │
│                                         │
│  Format: MP4                            │
│  Quality: High                          │
│                                         │
│  Output: [Browse...]                    │
│  ~/Videos/my-video.mp4                  │
│                                         │
│  [Cancel]  [Export]                     │
└─────────────────────────────────────────┘
```

---

### Export Progress

```
┌─────────────────────────────────────────┐
│  Exporting Video...                     │
│                                         │
│  Progress: 47%                          │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░        │
│                                         │
│  Time Remaining: ~2 minutes             │
│  Processing: Track 2 (overlay)          │
│                                         │
│  [Cancel Export]                        │
└─────────────────────────────────────────┘
```

---

## Technical Architecture

### Technology Stack

**Desktop Framework:**
- **Electron** (v28+)
  - Mature ecosystem
  - Better documentation for media
  - Easier screen capture APIs
  - Large bundle size acceptable for desktop

**Frontend:**
- **React** (v18+) with TypeScript
- **Tailwind CSS** for styling
- **Zustand** or Redux Toolkit for state management

**Media Processing:**
- **fluent-ffmpeg** - Node.js FFmpeg wrapper
- **FFmpeg binary** - Bundled with app

**Timeline:**
- **Custom HTML5 Canvas** or DOM-based
- Consider: Fabric.js or Konva.js for advanced interactions

**Video Player:**
- **HTML5 `<video>` element** with MediaSource API
- **Wavesurfer.js** for audio waveforms

---

### System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Electron Main Process               │
│                                                      │
│  • Window Management                                │
│  • File System Access                               │
│  • FFmpeg Process Management                        │
│  • Screen Capture APIs                              │
│  • IPC Communication                                │
└─────────────────────────────────────────────────────┘
                         ↕ IPC
┌─────────────────────────────────────────────────────┐
│              Electron Renderer Process               │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   UI Layer   │  │  State Mgmt  │  │  Video    │ │
│  │              │  │              │  │  Player   │ │
│  │  • React     │  │  • Zustand   │  │           │ │
│  │  • Tailwind  │  │  • Timeline  │  │  • HTML5  │ │
│  │  • Canvas    │  │  • Media     │  │  • Preview│ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │         Media Handling Layer                 │  │
│  │                                              │  │
│  │  • Import/Export                             │  │
│  │  • Recording (MediaRecorder API)            │  │
│  │  • Thumbnail Generation                      │  │
│  │  • Waveform Rendering                        │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────┐
│                  File System                         │
│                                                      │
│  • User Media Library (references only)             │
│  • Temporary Files (recordings, previews)           │
│  • Export Output Directory                          │
└─────────────────────────────────────────────────────┘
```

---

### Data Models

#### MediaAsset
```typescript
interface MediaAsset {
  id: string;                    // Unique identifier
  type: 'video' | 'audio' | 'image';
  name: string;                  // Display name
  path: string;                  // Absolute file path (reference)
  duration: number;              // Seconds (0 for images)
  width: number;                 // Dimensions
  height: number;
  fileSize: number;              // Bytes
  thumbnail: string;             // Data URL or blob URL
  waveform?: number[];           // Audio visualization data
  createdAt: Date;
  source: 'imported' | 'recorded';
}
```

#### TimelineClip
```typescript
interface TimelineClip {
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
    x: number;                   // Pixels from left
    y: number;                   // Pixels from top
    width: number;
    height: number;
    zIndex: number;              // Layer order
  };
}
```

#### Track
```typescript
interface Track {
  id: string;
  order: number;                 // Display order (higher = on top)
  clips: TimelineClip[];
  locked: boolean;               // Prevent editing
  visible: boolean;              // Show/hide in preview
  name: string;                  // Optional custom name
}
```

#### Timeline
```typescript
interface Timeline {
  tracks: Track[];
  duration: number;              // Total timeline duration
  playheadPosition: number;      // Current time (seconds)
  zoom: number;                  // Pixels per second
  selectedClipIds: string[];     // Multi-selection
}
```

#### Project
```typescript
interface Project {
  id: string;
  name: string;
  timeline: Timeline;
  mediaLibrary: MediaAsset[];
  exportSettings: {
    resolution: '720p' | '1080p' | '4k' | 'source';
    format: 'mp4';
    quality: 'low' | 'medium' | 'high';
  };
  createdAt: Date;
  modifiedAt: Date;
}
```

---

### File Structure

```
clipforge/
├── electron/
│   ├── main.ts                 # Electron main process
│   ├── preload.ts             # Bridge APIs
│   └── ffmpeg/
│       ├── export.ts          # Export pipeline
│       ├── recording.ts       # Recording management
│       └── thumbnails.ts      # Thumbnail generation
│
├── src/
│   ├── components/
│   │   ├── Sidebar/
│   │   │   ├── MediaLibrary.tsx
│   │   │   ├── RecordingPanel.tsx
│   │   │   └── MediaGrid.tsx
│   │   │
│   │   ├── Timeline/
│   │   │   ├── Timeline.tsx
│   │   │   ├── Track.tsx
│   │   │   ├── Clip.tsx
│   │   │   ├── Playhead.tsx
│   │   │   ├── TimelineRuler.tsx
│   │   │   └── ZoomControls.tsx
│   │   │
│   │   ├── Preview/
│   │   │   ├── PreviewCanvas.tsx
│   │   │   ├── VideoPlayer.tsx
│   │   │   └── PlaybackControls.tsx
│   │   │
│   │   ├── Properties/
│   │   │   ├── PropertiesPanel.tsx
│   │   │   ├── SpeedControl.tsx
│   │   │   ├── VolumeControl.tsx
│   │   │   └── FadeControls.tsx
│   │   │
│   │   └── Dialogs/
│   │       ├── RecordingDialog.tsx
│   │       ├── ExportDialog.tsx
│   │       └── ProgressDialog.tsx
│   │
│   ├── store/
│   │   ├── timelineStore.ts   # Timeline state
│   │   ├── mediaStore.ts      # Media library state
│   │   └── uiStore.ts         # UI state
│   │
│   ├── hooks/
│   │   ├── useTimeline.ts
│   │   ├── useMediaImport.ts
│   │   └── useRecording.ts
│   │
│   ├── utils/
│   │   ├── fileHandling.ts
│   │   ├── timelineCalculations.ts
│   │   └── formatters.ts
│   │
│   └── App.tsx
│
├── public/
│   └── ffmpeg/                # FFmpeg binaries
│
└── package.json
```

---

## Implementation Timeline

### Monday, Oct 27 (Today) - 8 hours

#### Phase 1: Foundation (4 hours)
**Hour 1-2: Setup**
- [ ] Initialize Electron + React project
- [ ] Configure Tailwind CSS
- [ ] Set up basic window
- [ ] Test hot reload

**Hour 3-4: Basic Layout**
- [ ] Create 3-column layout (Sidebar | Preview | Properties)
- [ ] Add timeline section below
- [ ] Implement responsive sizing
- [ ] Basic styling

#### Phase 2: File Import (4 hours)
**Hour 5-6: Media Library**
- [ ] File picker integration
- [ ] Drag & drop zone
- [ ] Store file references (not copies)
- [ ] 2-column grid display

**Hour 7-8: Thumbnails**
- [ ] Generate video thumbnails (first frame)
- [ ] Audio waveform generation
- [ ] Duration display
- [ ] File type icons

**End of Day Status:** Can import files and see them in sidebar

---

### Tuesday, Oct 28 - MVP Day (12 hours)

#### Phase 3: Timeline Foundation (4 hours)
**Hour 1-2: Basic Timeline**
- [ ] Single track rendering
- [ ] Drag from sidebar to timeline
- [ ] Display clips as colored blocks
- [ ] Time ruler with markers

**Hour 3-4: Playhead & Preview**
- [ ] Playhead indicator (white line)
- [ ] Click to move playhead
- [ ] Preview player shows current frame
- [ ] Play/pause functionality

#### Phase 4: Editing (4 hours)
**Hour 5-6: Trim**
- [ ] Drag clip edges to trim
- [ ] Visual feedback
- [ ] Update clip duration
- [ ] Preview updates

**Hour 7-8: Export Pipeline**
- [ ] FFmpeg integration
- [ ] Basic export (single clip)
- [ ] Progress indicator
- [ ] Save to file system

#### Phase 5: MVP Polish (4 hours)
**Hour 9-10: Testing**
- [ ] Test import → preview → trim → export flow
- [ ] Fix critical bugs
- [ ] Performance testing

**Hour 11-12: Packaging**
- [ ] Build distributable (.dmg/.exe)
- [ ] Test packaged app
- [ ] Create README
- [ ] Submit MVP

**MVP DEADLINE: 10:59 PM CT**

---

### Wednesday, Oct 29 - Full Version (12 hours)

#### Phase 6: Multi-Track Timeline (3 hours)
**Hour 1-2:**
- [ ] Support multiple tracks
- [ ] [+ Add Track] button
- [ ] Drag clips between tracks
- [ ] Track ordering

**Hour 3:**
- [ ] Multi-select (Shift, Ctrl, drag box)
- [ ] Bulk operations (delete, duplicate)
- [ ] Context menu (right-click)

#### Phase 7: Advanced Features (4 hours)
**Hour 4-5: Effects**
- [ ] Speed control (0.25x - 16x)
- [ ] Volume control
- [ ] Fade in/out
- [ ] Visual updates on timeline

**Hour 6-7: Properties Panel**
- [ ] Right sidebar layout
- [ ] Bind controls to selected clip
- [ ] Real-time preview updates

#### Phase 8: Recording (3 hours)
**Hour 8-9: Screen Recording**
- [ ] desktopCapturer API
- [ ] Source selection dialog
- [ ] MediaRecorder implementation
- [ ] Save to media library

**Hour 10: Webcam & Audio**
- [ ] getUserMedia for camera
- [ ] Audio input capture
- [ ] Combined recording
- [ ] Save options dialog

#### Phase 9: Export & Polish (2 hours)
**Hour 11:**
- [ ] Multi-track export
- [ ] Resolution options (720p/1080p/4K)
- [ ] Apply all effects in export
- [ ] Overlay composition

**Hour 12: Final Testing**
- [ ] End-to-end testing
- [ ] Bug fixes
- [ ] Demo video recording
- [ ] Documentation

**FINAL DEADLINE: 10:59 PM CT**

---

## Technical Implementation Details

### FFmpeg Export Pipeline

```javascript
// Simplified export flow
async function exportTimeline(timeline, outputPath, resolution) {
  const tempFiles = [];
  
  // 1. Process each track
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      // Apply effects to each clip
      const processedClip = await applyEffects(clip, {
        speed: clip.speed,
        volume: clip.volume,
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut,
        trim: [clip.trimStart, clip.trimEnd]
      });
      
      tempFiles.push(processedClip);
    }
  }
  
  // 2. Concatenate clips in each track
  const trackOutputs = await Promise.all(
    timeline.tracks.map(track => concatenateClips(track.clips))
  );
  
  // 3. Composite all tracks (overlay)
  const finalVideo = await compositeTrack(trackOutputs, resolution);
  
  // 4. Encode and save
  await encodeVideo(finalVideo, outputPath);
  
  // 5. Cleanup temp files
  await cleanupTempFiles(tempFiles);
}
```

### Screen Recording Implementation

```javascript
// Electron main process
const { desktopCapturer } = require('electron');

async function startScreenRecording(options) {
  // Get available sources
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window']
  });
  
  // Let user choose source
  const sourceId = await showSourcePicker(sources);
  
  // In renderer process:
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        minWidth: 1280,
        maxWidth: 1920,
        minHeight: 720,
        maxHeight: 1080
      }
    }
  });
  
  // Add webcam if requested
  if (options.includeCamera) {
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: options.includeMicrophone
    });
    
    // Composite streams (canvas or video processing)
    const compositeStream = compositeVideoStreams(stream, cameraStream);
  }
  
  // Record with MediaRecorder
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 2500000
  });
  
  const chunks = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    await saveRecording(blob);
  };
  
  recorder.start();
  return recorder;
}
```

### Timeline State Management

```typescript
// Zustand store
interface TimelineStore {
  tracks: Track[];
  playheadPosition: number;
  selectedClipIds: string[];
  zoom: number;
  
  // Actions
  addTrack: () => void;
  removeTrack: (trackId: string) => void;
  addClip: (trackId: string, clip: TimelineClip) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  deleteClip: (clipId: string) => void;
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void;
  splitClip: (clipId: string, splitTime: number) => void;
  setPlayhead: (time: number) => void;
  selectClips: (clipIds: string[]) => void;
  setZoom: (zoom: number) => void;
}

const useTimelineStore = create<TimelineStore>((set, get) => ({
  tracks: [],
  playheadPosition: 0,
  selectedClipIds: [],
  zoom: 50, // pixels per second
  
  addTrack: () => set((state) => ({
    tracks: [...state.tracks, {
      id: generateId(),
      order: state.tracks.length,
      clips: [],
      locked: false,
      visible: true,
      name: `Track ${state.tracks.length + 1}`
    }]
  })),
  
  // ... other actions
}));
```

---

## Risk Mitigation

### Technical Risks

**Risk 1: FFmpeg Export Complexity**
- **Probability:** High
- **Impact:** Critical (can't export = failed MVP)
- **Mitigation:**
  - Start with simple single-clip export Tuesday morning
  - Test early and often
  - Have fallback: export each track separately
  - Use well-tested fluent-ffmpeg library
  - Keep FFmpeg commands simple

**Risk 2: Timeline Performance**
- **Probability:** Medium
- **Impact:** High (laggy UI = poor UX)
- **Mitigation:**
  - Use React.memo for clip components
  - Virtual scrolling for long timelines
  - Debounce drag operations
  - Test with 20+ clips early
  - Optimize re-renders

**Risk 3: Recording API Platform Differences**
- **Probability:** Medium
- **Impact:** Medium (recording might not work)
- **Mitigation:**
  - Test on target platform (Mac/Windows) immediately
  - Use Electron's desktopCapturer (cross-platform)
  - Have web-based fallback (getDisplayMedia)
  - Document platform limitations

**Risk 4: Packaging/Distribution**
- **Probability:** Medium
- **Impact:** High (can't submit if won't build)
- **Mitigation:**
  - Package Tuesday night for MVP
  - Test packaged app, not just dev mode
  - Use electron-builder (mature tool)
  - Include FFmpeg binaries in bundle

**Risk 5: File Format Compatibility**
- **Probability:** Low
- **Impact:** Medium
- **Mitigation:**
  - Focus on MP4/MOV (most common)
  - Use FFmpeg for format conversion
  - Show clear error messages
  - Document supported formats

---

### Schedule Risks

**Risk 1: Feature Creep**
- **Mitigation:** 
  - Strict MVP scope Tuesday
  - Only add features Wednesday if MVP is solid
  - Skip stretch goals if behind

**Risk 2: Unexpected Bugs**
- **Mitigation:**
  - 4-hour buffer built into schedule
  - Test continuously, not just at end
  - Focus on core flow working

**Risk 3: Learning Curve (FFmpeg, Electron)**
- **Mitigation:**
  - Use tutorials and documentation liberally
  - Copy working examples
  - Ask for help if stuck >30 minutes

---

## Success Metrics

### MVP Success (Tuesday)
✅ **Must Achieve:**
- [ ] Desktop app launches
- [ ] Can import video file
- [ ] Video appears in timeline
- [ ] Can play video in preview
- [ ] Can trim video
- [ ] Can export to MP4
- [ ] Packaged as distributable

### Full Version Success (Wednesday)
✅ **Must Achieve:**
- All MVP criteria +
- [ ] Multi-track timeline works
- [ ] Can record screen
- [ ] Speed/volume/fade effects work
- [ ] Can position overlays
- [ ] Export with multiple tracks
- [ ] Export with effects applied

### Stretch Goals (If Time)
- [ ] Webcam + screen simultaneous recording
- [ ] Waveform visualization in timeline
- [ ] Keyboard shortcuts
- [ ] Split functionality
- [ ] 4K export option

---

## Testing Scenarios

### Scenario 1: Tutorial Video Creation
1. Record screen (full desktop)
2. Record webcam simultaneously
3. Import logo image
4. Arrange: screen on Track 1, webcam on Track 2, logo on Track 3
5. Position webcam in bottom-right corner
6. Trim webcam clip to match screen length
7. Add fade in to logo
8. Export as 1080p MP4
9. **Expected:** Clean video with all elements composed correctly

### Scenario 2: Music Video Montage
1. Import 5 video clips
2. Import 1 audio track (music)
3. Place audio on Track 1
4. Arrange video clips on Track 2 in sequence
5. Trim clips to match music beats
6. Adjust some clips to 2x speed
7. Add fade out to last clip
8. Export as 720p MP4
9. **Expected:** Video synced with music, effects applied

### Scenario 3: Quick Screen Recording
1. Click Record
2. Select screen + microphone
3. Record 30 seconds
4. Stop recording
5. Immediately export without editing
6. **Expected:** Recording appears in library, exports successfully

---

## Submission Checklist

### MVP Submission (Tuesday 10:59 PM)
- [ ] GitHub repository created
- [ ] README with setup instructions
- [ ] Packaged app (.dmg or .exe)
- [ ] Download link or build instructions
- [ ] Demo video showing:
  - Import
  - Timeline
  - Trim
  - Export
- [ ] All MVP features working

### Final Submission (Wednesday 10:59 PM)
- [ ] Updated GitHub repository
- [ ] Complete README with:
  - Features list
  - Setup instructions
  - Architecture overview
  - Known limitations
- [ ] Packaged app (latest version)
- [ ] Demo video (3-5 min) showing:
  - Recording (screen/camera)
  - Import
  - Multi-track editing
  - Effects (speed, volume, fade)
  - Canvas positioning
  - Export
- [ ] All core features working

---

## Development Commands

```bash
# Install dependencies
npm install

# Run development mode
npm run dev

# Build for production
npm run build

# Package app
npm run package:mac    # macOS
npm run package:win    # Windows

# Run tests
npm test
```

---

## Dependencies

### Core
```json
{
  "electron": "^28.0.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.3.0"
}
```

### Media Processing
```json
{
  "fluent-ffmpeg": "^2.1.2",
  "@ffmpeg-installer/ffmpeg": "^1.1.0"
}
```

### UI
```json
{
  "tailwindcss": "^3.4.0",
  "zustand": "^4.4.0",
  "lucide-react": "^0.300.0"
}
```

### Timeline
```json
{
  "wavesurfer.js": "^7.7.0",
  "fabric": "^5.3.0"  // Optional for canvas
}
```

---

## Key Decisions

### Why Electron over Tauri?
- More mature for media applications
- Better documentation and examples
- Easier screen capture APIs
- Larger community (faster to find solutions)
- Bundle size not critical for desktop

### Why Custom Timeline over Library?
- Specific requirements (multi-track, effects)
- Most libraries are web-based (not optimized for desktop)
- Better control over performance
- Learning experience

### Why FFmpeg?
- Industry standard
- Supports all formats
- Powerful effects pipeline
- Cross-platform
- Free and open-source

---

## Notes

- **Focus on core flow:** Import → Edit → Export must work perfectly
- **Test packaged app early:** Don't wait until Tuesday night
- **Keep UI simple:** CapCut/Clipchamp are simple for a reason
- **Performance matters:** Test with 10+ clips on timeline
- **Recording is last:** Only add if core editing is solid

---

## Contact & Support

For questions during development:
- Check Electron documentation: https://www.electronjs.org/docs
- FFmpeg guide: https://ffmpeg.org/documentation.html
- React docs: https://react.dev

---

**Version:** 1.0  
**Last Updated:** October 27, 2025  
**Status:** Ready for Development

---

## Appendix: Quick Reference

### Keyboard Shortcuts (Planned)
- `Space` - Play/Pause
- `Cmd/Ctrl + I` - Import media
- `Cmd/Ctrl + R` - Start recording
- `Cmd/Ctrl + E` - Export
- `Cmd/Ctrl + Z` - Undo (if time)
- `Delete` - Delete selected clips
- `Cmd/Ctrl + D` - Duplicate clip
- `S` - Split at playhead
- `+/-` - Zoom timeline

### File Format Support
**Import:**
- Video: MP4, MOV, WebM
- Audio: MP3, WAV, M4A
- Image: PNG, JPG, JPEG

**Export:**
- Video: MP4 (H.264 codec)
- Audio: AAC

### Performance Targets
- App launch: < 5 seconds
- Import file: < 2 seconds
- Generate thumbnail: < 1 second
- Preview playback: 30 fps minimum
- Export 5-min video: < 3 minutes
- Memory usage: < 500 MB with 20 clips

---

**END OF PRD**