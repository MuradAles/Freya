# ClipForge - Development Task List

**Project:** Desktop Video Editor  
**Stack:** Electron + React + Vite + Tailwind  
**Timeline:** 72 Hours (Oct 27-29, 2025)

---

## 🎯 Quick Reference

### Deadlines
- **MVP:** Tuesday, Oct 28 at 10:59 PM CT (Tomorrow!)
- **Final:** Wednesday, Oct 29 at 10:59 PM CT

### Priority
- 🔴 Critical (Must have for MVP)
- 🟡 Important (Full version)
- 🟢 Nice to have (If time permits)

---

# MONDAY, OCT 27 (TODAY) - Foundation

## Phase 1: Project Setup & Dependencies (1 hour)
**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Complete

### Dependencies Installation
- [x] Install Tailwind CSS (if not already)
- [x] Install Zustand for state management
- [x] Install fluent-ffmpeg
- [x] Install @ffmpeg-installer/ffmpeg
- [x] Install lucide-react (icons)
- [x] Install wavesurfer.js (audio waveforms)

```bash
npm install tailwindcss zustand fluent-ffmpeg @ffmpeg-installer/ffmpeg lucide-react wavesurfer.js
npm install -D @types/fluent-ffmpeg
```

### Project Structure Setup
- [x] Create `/src/components` folder structure:
  - [x] `/Sidebar` (MediaLibrary, RecordingPanel, MediaGrid)
  - [x] `/Timeline` (Timeline, Track, Clip, Playhead, TimelineRuler)
  - [x] `/Preview` (PreviewCanvas, VideoPlayer, PlaybackControls)
  - [x] `/Properties` (PropertiesPanel, SpeedControl, VolumeControl, FadeControls)
  - [x] `/Dialogs` (RecordingDialog, ExportDialog, ProgressDialog)
- [x] Create `/src/store` folder (timelineStore, mediaStore, uiStore)
- [x] Create `/src/hooks` folder
- [x] Create `/src/utils` folder
- [x] Create `/electron` folder for main process code

---

## Phase 2: Basic Layout (2 hours) 🔴

### Main App Layout
- [x] Create 3-column layout component
  - [x] Left sidebar (300px fixed)
  - [x] Center preview (flexible)
  - [x] Right properties panel (300px fixed)
- [x] Add timeline section at bottom (250px fixed)
- [x] Make layout responsive
- [ ] Add dark theme styling (matching CapCut/Clipchamp)

### Sidebar Structure
- [x] Create `Sidebar.tsx` container
- [x] Add "ClipForge" header with logo
- [x] Create collapsible recording section at top
- [x] Add "Import Media" button (prominent, purple)
- [x] Create 2-column media grid container
- [x] Add scroll area for media items

### Preview Area Structure
- [x] Create `PreviewCanvas.tsx` container
- [x] Add video player placeholder (black background)
- [x] Add playback controls bar below player
  - [x] Previous frame button
  - [x] Play/Pause button
  - [x] Next frame button
  - [x] Timecode display (00:00 / 00:00)
- [ ] Add canvas for overlay positioning (later)

### Properties Panel Structure
- [x] Create `PropertiesPanel.tsx` container
- [x] Show "No Selection" placeholder initially
- [x] Prepare sections for:
  - [x] Speed control
  - [x] Volume control
  - [x] Fade in/out
  - [x] Position controls
  - [x] Filters (placeholder)
  - [x] Effects (placeholder)

### Timeline Structure
- [x] Create `Timeline.tsx` container
- [x] Add zoom controls (top-right)
  - [x] [-] button
  - [x] Slider placeholder
  - [x] [+] button
- [x] Add [Export] button (top-right)
- [x] Create time ruler area (showing 0s, 1:00, 2:00, etc.)
- [x] Create tracks container
- [x] Add [+ Add Track] button at bottom
- [x] Style with dark theme

**End of Phase 2 Checkpoint:**
✅ App shows complete layout with all sections visible
✅ No functionality yet, just UI structure

---

## Phase 3: State Management Setup (1 hour) 🔴

### Media Store
- [x] Create `src/store/mediaStore.ts`
- [x] Define MediaAsset interface
- [x] Add state:
  - [x] mediaLibrary: MediaAsset[]
- [x] Add actions:
  - [x] addMedia(asset: MediaAsset)
  - [x] removeMedia(id: string)
  - [x] getMediaById(id: string)
- [x] Add persist middleware (localStorage)

### Timeline Store
- [x] Create `src/store/timelineStore.ts`
- [x] Define Track, TimelineClip interfaces
- [x] Add state:
  - [x] tracks: Track[]
  - [x] playheadPosition: number
  - [x] selectedClipIds: string[]
  - [x] zoom: number (default: 50 pixels per second)
  - [x] duration: number
- [x] Add actions:
  - [x] addTrack()
  - [x] removeTrack(trackId)
  - [x] addClip(trackId, clip)
  - [x] updateClip(clipId, updates)
  - [x] deleteClip(clipId)
  - [x] moveClip(clipId, newTrackId, newStartTime)
  - [x] setPlayhead(time)
  - [x] selectClips(clipIds)
  - [x] setZoom(zoom)

### UI Store
- [x] Create `src/store/uiStore.ts`
- [x] Add state:
  - [x] isRecording: boolean
  - [x] isExporting: boolean
  - [x] exportProgress: number
  - [x] selectedPanel: 'media' | 'recording'
- [x] Add actions for UI state changes

**End of Phase 3 Checkpoint:**
✅ State stores are created and working
✅ Can access stores from components

---

## Phase 4: File Import System (3 hours) 🔴

### Electron IPC Setup
- [x] Create `electron/fileHandling.ts`
- [x] Implement IPC handler for file dialog:
  ```typescript
  ipcMain.handle('dialog:openFile', async () => {
    // Use dialog.showOpenDialog
  })
  ```
- [x] Add preload script exposure
- [ ] Test IPC communication

### Import Button
- [x] Create `ImportButton.tsx` component
- [x] Add click handler to trigger file dialog
- [x] Accept: video/*, audio/*, image/*
- [ ] Add dropdown arrow for future options
- [x] Style as prominent purple button

### Drag & Drop
- [x] Add drag-over styling to sidebar
- [x] Implement drop handler
- [x] Prevent default browser behavior
- [x] Extract files from drop event
- [x] Validate file types (MP4, MOV, WebM, MP3, WAV, PNG, JPG)

### File Processing
- [x] Create `utils/fileHandling.ts`
- [x] Implement `processMediaFile(filePath)`:
  - [x] Read file metadata (duration, dimensions, size)
  - [x] Generate unique ID
  - [x] Determine media type
  - [x] Return MediaAsset object
- [x] Store only file PATH (not file contents)

### Thumbnail Generation
- [x] Create `utils/thumbnailGenerator.ts`
- [x] For videos: Extract first frame
  - [x] Use HTML5 video element
  - [x] Draw to canvas
  - [x] Convert to data URL
- [x] For images: Use as-is (or resize)
- [x] For audio: Generate waveform visualization
  - [x] Simple placeholder waveform
- [x] Get video duration

### Media Grid Display
- [x] Create `MediaGrid.tsx` component
- [x] Create `MediaItem.tsx` component
- [x] Display in 2-column grid
- [x] Show thumbnail
- [x] Show filename (truncated if long)
- [x] Show duration (for video/audio)
- [x] Show file size (optional)
  - [x] Add delete button (⊗) on hover
- [x] Add click to select
- [x] Add double-click to add to timeline (placeholder)

### Media Library Integration
- [x] Connect ImportButton to mediaStore
- [x] Connect MediaGrid to mediaStore
- [x] When file imported:
  - [x] Process file
  - [x] Generate thumbnail
  - [x] Add to mediaStore
  - [x] Display in grid

**End of Phase 4 Checkpoint:**
✅ Can click "Import Media" and select files
✅ Can drag & drop files onto app
✅ Files appear in 2-column grid with thumbnails
✅ Shows duration for videos/audio
✅ Thumbnails generated for video, audio, and images
✅ Click to select media
✅ Visual selection feedback with purple ring

---

## Phase 5: Basic Video Preview (1 hour) 🔴

### Video Player Component
- [ ] Create `VideoPlayer.tsx`
- [ ] Add HTML5 `<video>` element
- [ ] Style to fit preview area
- [ ] Add ref for programmatic control

### Playback Controls
- [ ] Create `PlaybackControls.tsx`
- [ ] Implement play button
  - [ ] Toggle play/pause
  - [ ] Update icon
- [ ] Implement pause button
- [ ] Add timecode display
  - [ ] Current time / Total duration
  - [ ] Format as MM:SS

### Preview Integration
- [ ] When media item clicked in grid:
  - [ ] Load video source
  - [ ] Show in preview player
  - [ ] Enable playback controls
- [ ] Update timecode during playback
- [ ] Handle video ended event

**End of Phase 5 Checkpoint:**
✅ Can click a video in media grid
✅ Video loads in preview player
✅ Can play/pause video
✅ Timecode updates during playback

**END OF MONDAY - CHECKPOINT:**
✅ App layout complete
✅ Can import files (drag/drop or button)
✅ Files show in grid with thumbnails
✅ Can play videos in preview
✅ State management working

---

# TUESDAY, OCT 28 - MVP DAY

## Phase 6: Timeline Foundation (3 hours) 🔴

### Time Ruler
- [ ] Create `TimelineRuler.tsx`
- [ ] Calculate time markers based on zoom level
- [ ] Render markers (0s, 1:00, 2:00, etc.)
- [ ] Add vertical lines at each marker
- [ ] Style with light gray text

### Single Track Rendering
- [ ] Create `Track.tsx` component
- [ ] Create single default track on mount
- [ ] Render as horizontal strip
- [ ] Add background color
- [ ] Add track label/number

### Drag from Sidebar to Timeline
- [ ] Make MediaItem draggable
  - [ ] Add draggable="true"
  - [ ] Set dataTransfer with media ID
- [ ] Make Track a drop target
  - [ ] Handle dragover event
  - [ ] Handle drop event
  - [ ] Calculate drop position (time) from mouse X
- [ ] On drop:
  - [ ] Get media from store
  - [ ] Create TimelineClip object
  - [ ] Add to track at calculated position
  - [ ] Update timelineStore

### Clip Rendering
- [ ] Create `Clip.tsx` component
- [ ] Calculate clip width based on:
  - [ ] Duration
  - [ ] Zoom level (pixels per second)
- [ ] Calculate clip X position based on:
  - [ ] Start time
  - [ ] Zoom level
- [ ] Render as colored block
- [ ] Show clip name (truncated)
- [ ] Show duration
- [ ] Add thumbnail if video (optional for MVP)

### Playhead
- [ ] Create `Playhead.tsx` component
- [ ] Render as vertical white line
- [ ] Position based on playheadPosition from store
- [ ] Add time indicator at top (00:00)
- [ ] Make draggable:
  - [ ] Click and drag to scrub
  - [ ] Update playheadPosition in store
  - [ ] Update preview player currentTime

### Timeline Click to Move Playhead
- [ ] Add click handler on timeline ruler
- [ ] Calculate time from mouse X position
- [ ] Update playheadPosition in store
- [ ] Preview player seeks to new time

**End of Phase 6 Checkpoint:**
✅ Can drag media from grid to timeline
✅ Clip appears as colored block
✅ Time ruler shows correct times
✅ Playhead visible and draggable
✅ Click timeline to move playhead

---

## Phase 7: Preview Sync with Timeline (1 hour) 🔴

### Playhead-to-Preview Sync
- [ ] Create `useTimelineSync` hook
- [ ] Subscribe to playheadPosition changes
- [ ] When playhead moves:
  - [ ] Find clip at current time
  - [ ] Load clip in preview player
  - [ ] Seek to correct position within clip
  - [ ] Handle transitions between clips

### Play from Timeline
- [ ] Add play button behavior:
  - [ ] Start from playhead position
  - [ ] Play current clip
  - [ ] Update playhead position during playback
  - [ ] Move playhead in real-time
  - [ ] When clip ends, play next clip
  - [ ] Stop at end of timeline

### Pause Behavior
- [ ] Pause button stops playback
- [ ] Playhead stays at current position
- [ ] Can resume from same position

**End of Phase 7 Checkpoint:**
✅ Playhead syncs with preview player
✅ Can play timeline from any position
✅ Playhead moves during playback
✅ Multiple clips play in sequence

---

## Phase 8: Trim Functionality (2 hours) 🔴

### Trim Handles
- [ ] Add resize handles to clip edges
- [ ] Show handles on hover
- [ ] Style as small vertical bars
- [ ] Make handles draggable

### Left Trim (Drag Start)
- [ ] On drag left handle:
  - [ ] Update clip.trimStart
  - [ ] Update clip.startTime (moves clip)
  - [ ] Update clip.duration (shorter)
  - [ ] Constrain: cannot trim past end
  - [ ] Update visual width

### Right Trim (Drag End)
- [ ] On drag right handle:
  - [ ] Update clip.trimEnd
  - [ ] Update clip.duration (shorter)
  - [ ] Constrain: cannot trim past start
  - [ ] Update visual width

### Trim Visual Feedback
- [ ] Show trimmed region grayed out
- [ ] Update clip width in real-time
- [ ] Snap to grid (1-second intervals)
- [ ] Show duration tooltip while dragging

### Trim Affects Playback
- [ ] When playing trimmed clip:
  - [ ] Start from trimStart
  - [ ] Stop at trimEnd
  - [ ] Don't play trimmed portions

**End of Phase 8 Checkpoint:**
✅ Can drag clip edges to trim
✅ Clip shortens visually
✅ Playback respects trim points
✅ Can trim from start or end

---

## Phase 9: FFmpeg Export Pipeline (4 hours) 🔴

### FFmpeg Setup
- [ ] Create `electron/ffmpeg/export.ts`
- [ ] Import fluent-ffmpeg
- [ ] Set FFmpeg path from @ffmpeg-installer
- [ ] Test FFmpeg availability

### Export Dialog
- [ ] Create `ExportDialog.tsx`
- [ ] Add resolution options:
  - [ ] 720p (1280x720)
  - [ ] 1080p (1920x1080) - default
  - [ ] Source resolution
- [ ] Add file picker for output path
- [ ] Add [Cancel] and [Export] buttons
- [ ] Show dialog when Export button clicked

### Simple Single-Clip Export
- [ ] Implement basic export function:
  ```typescript
  async function exportSingleClip(clip, outputPath, resolution) {
    // Use fluent-ffmpeg
    // Input: clip source file
    // Output: outputPath
    // Scale to resolution
    // Apply trim (if any)
  }
  ```
- [ ] Test with one clip on timeline
- [ ] Verify output plays correctly

### Progress Dialog
- [ ] Create `ProgressDialog.tsx`
- [ ] Show during export
- [ ] Display progress bar (0-100%)
- [ ] Show "Exporting..." text
- [ ] Add [Cancel] button
- [ ] Close automatically when complete

### Export IPC Communication
- [ ] Add IPC handler in main process:
  ```typescript
  ipcMain.handle('export:start', async (event, data) => {
    // Run FFmpeg export
    // Send progress updates
  })
  ```
- [ ] Send progress updates to renderer
- [ ] Handle cancellation
- [ ] Handle errors gracefully

### Multi-Clip Concatenation
- [ ] Generate file list for FFmpeg concat
- [ ] For each clip on timeline:
  - [ ] Apply trim if needed
  - [ ] Add to concat list
- [ ] Use FFmpeg concat demuxer:
  ```bash
  ffmpeg -f concat -safe 0 -i filelist.txt -c copy output.mp4
  ```
- [ ] Test with 2-3 clips in sequence

### Export Edge Cases
- [ ] Handle empty timeline (show error)
- [ ] Handle overlapping clips (not allowed in MVP)
- [ ] Handle different resolutions (scale all)
- [ ] Handle audio-only clips
- [ ] Handle image clips (treat as video with duration)

**End of Phase 9 Checkpoint:**
✅ Can click Export button
✅ Export dialog appears
✅ Can select output path and resolution
✅ FFmpeg processes timeline
✅ Progress bar shows during export
✅ Output MP4 file created
✅ Video plays correctly

---

## Phase 10: MVP Polish & Testing (2 hours) 🔴

### Bug Fixes
- [ ] Test complete flow: Import → Timeline → Trim → Export
- [ ] Fix any crashes or errors
- [ ] Ensure state persists between actions
- [ ] Handle edge cases:
  - [ ] Empty timeline export
  - [ ] Very short clips (<1s)
  - [ ] Very long clips (>1 hour)
  - [ ] Large file imports

### Performance Testing
- [ ] Test with 10 clips on timeline
- [ ] Ensure timeline remains responsive
- [ ] Check memory usage
- [ ] Optimize re-renders if needed

### UI Polish
- [ ] Fix any layout issues
- [ ] Ensure consistent styling
- [ ] Add loading states
- [ ] Add error messages (user-friendly)
- [ ] Test on actual target OS (Mac/Windows)

### Packaging
- [ ] Build production version:
  ```bash
  npm run build
  npm run package
  ```
- [ ] Test packaged app (not dev mode!)
- [ ] Verify FFmpeg binary is bundled
- [ ] Test on clean machine (if possible)
- [ ] Check app size (<200MB)

### Documentation
- [ ] Create README.md with:
  - [ ] Project description
  - [ ] Setup instructions
  - [ ] How to run dev mode
  - [ ] How to build/package
  - [ ] Features list
  - [ ] Known limitations
- [ ] Add screenshots
- [ ] Document system requirements

### Demo Video
- [ ] Record 2-3 minute demo showing:
  - [ ] App launching
  - [ ] Importing video
  - [ ] Dragging to timeline
  - [ ] Trimming clip
  - [ ] Playing preview
  - [ ] Exporting video
  - [ ] Playing exported file

### Submission
- [ ] Push code to GitHub
- [ ] Upload packaged app to Google Drive/Dropbox
- [ ] Upload demo video
- [ ] Submit before 10:59 PM CT
- [ ] Verify submission received

**MVP COMPLETE! 🎉**

---

# WEDNESDAY, OCT 29 - FULL VERSION

## Phase 11: Multi-Track Timeline (3 hours) 🟡

### Add Track Functionality
- [ ] Implement [+ Add Track] button
- [ ] Create new track in store
- [ ] Render new track in timeline
- [ ] Default to Track 1 on first load

### Remove Track
- [ ] Add delete button to each track
- [ ] Confirm before deleting
- [ ] Move clips to different track or delete
- [ ] Update store

### Track Ordering
- [ ] Add drag handle to track label
- [ ] Make tracks reorderable (drag up/down)
- [ ] Update track.order in store
- [ ] Re-render timeline with new order

### Drag Clips Between Tracks
- [ ] Make clips draggable vertically
- [ ] Detect target track on drop
- [ ] Move clip to new track
- [ ] Maintain start time
- [ ] Update store

### Multi-Track Visual Layering
- [ ] Higher tracks = on top visually
- [ ] Lower tracks = background
- [ ] Show track numbers/names
- [ ] Different colors per track (optional)

**End of Phase 11 Checkpoint:**
✅ Can add multiple tracks
✅ Can delete tracks
✅ Can drag clips between tracks
✅ Can reorder tracks

---

## Phase 12: Multi-Select & Context Menu (2 hours) 🟡

### Selection System
- [ ] Implement Shift+Click multi-select
  - [ ] Click first clip to select
  - [ ] Shift+Click second clip
  - [ ] Select all clips in range
- [ ] Implement Ctrl/Cmd+Click toggle select
  - [ ] Add/remove individual clips
- [ ] Implement drag selection box
  - [ ] Draw selection rectangle
  - [ ] Select all clips inside box
- [ ] Visual highlight (purple outline)
- [ ] Update selectedClipIds in store

### Context Menu
- [ ] Create `ContextMenu.tsx` component
- [ ] Trigger on right-click on clip
- [ ] Show options:
  - [ ] Split
  - [ ] Delete
  - [ ] Duplicate
  - [ ] Copy
  - [ ] Paste
- [ ] Position menu at mouse cursor

### Split Functionality
- [ ] Split at playhead position
- [ ] For single selection:
  - [ ] Create two clips
  - [ ] First: start to playhead
  - [ ] Second: playhead to end
- [ ] For multi-selection:
  - [ ] Split all selected clips
  - [ ] Only split if playhead intersects clip
- [ ] Update timeline

### Delete
- [ ] Delete selected clip(s)
- [ ] Remove from store
- [ ] Update timeline

### Duplicate
- [ ] Duplicate selected clip
- [ ] Place duplicate on NEW track (auto-create)
- [ ] Same start time
- [ ] Update store

### Copy/Paste
- [ ] Copy: Store clip data in clipboard (app-level)
- [ ] Paste: Create new clip at playhead position
- [ ] On same track or new track

**End of Phase 12 Checkpoint:**
✅ Can select multiple clips
✅ Can right-click for context menu
✅ Can split, delete, duplicate clips
✅ Copy/paste works

---

## Phase 13: Effects Implementation (3 hours) 🟡

### Properties Panel UI
- [ ] Show panel when clip selected
- [ ] Hide when no selection
- [ ] Display clip name at top
- [ ] Create sections for each effect

### Speed Control
- [ ] Add speed slider/dropdown:
  - [ ] 0.25x, 0.5x, 1x, 2x, 4x, 8x, 16x
- [ ] On change:
  - [ ] Update clip.speed in store
  - [ ] Recalculate clip.duration
  - [ ] Update clip width on timeline
  - [ ] 2x speed = half width
  - [ ] 0.5x speed = double width

### Volume Control
- [ ] Add volume slider (0% - 200%)
- [ ] Add mute toggle checkbox
- [ ] On change:
  - [ ] Update clip.volume in store
  - [ ] If playing, update audio gain in real-time
- [ ] Visual indicator on clip (🔇 if muted)

### Fade In/Out
- [ ] Add fade in duration input (0-5s)
- [ ] Add fade out duration input (0-5s)
- [ ] On change:
  - [ ] Update clip.fadeIn / clip.fadeOut
  - [ ] Apply opacity transition in preview
  - [ ] Visual indicator on clip timeline (gradient)

### Effects in Preview
- [ ] Speed: Change playbackRate of video element
- [ ] Volume: Change video.volume
- [ ] Fade: Apply CSS opacity transition or video alpha

### Effects in Export
- [ ] Speed: Use FFmpeg setpts filter
  ```bash
  -filter:v "setpts=0.5*PTS"  # for 2x speed
  ```
- [ ] Volume: Use FFmpeg volume filter
  ```bash
  -af "volume=1.5"  # for 150% volume
  ```
- [ ] Fade: Use FFmpeg fade filter
  ```bash
  -vf "fade=in:0:30,fade=out:270:30"
  ```
- [ ] Combine all filters in export pipeline

**End of Phase 13 Checkpoint:**
✅ Can adjust speed (clip width changes)
✅ Can adjust volume
✅ Can set fade in/out
✅ Effects visible in preview
✅ Effects applied in export

---

## Phase 14: Canvas Positioning (2 hours) 🟡

### Position Controls in Properties
- [ ] Add X position input (pixels)
- [ ] Add Y position input (pixels)
- [ ] Add Width input
- [ ] Add Height input
- [ ] Only show for images and overlay videos

### Canvas Drag System
- [ ] Make preview canvas interactive
- [ ] When clip selected:
  - [ ] Render clip on canvas at position
  - [ ] Show bounding box
  - [ ] Add drag handles on corners (resize)
  - [ ] Add center drag handle (move)
- [ ] On drag:
  - [ ] Update clip.position in store
  - [ ] Re-render canvas
  - [ ] Update properties panel inputs

### Visual Guides
- [ ] Show center guidelines (horizontal/vertical)
- [ ] Snap to center (magnetic effect)
- [ ] Show distance from edges
- [ ] Highlight on hover

### Preset Positions
- [ ] Add position preset buttons:
  - [ ] Top-Left
  - [ ] Top-Right
  - [ ] Bottom-Left
  - [ ] Bottom-Right
  - [ ] Center
- [ ] Click to apply preset position
- [ ] Can still fine-tune after

### Z-Index Control
- [ ] Add "Bring Forward" button
- [ ] Add "Send Backward" button
- [ ] Update clip.position.zIndex
- [ ] Re-layer in preview

### Position in Export
- [ ] Use FFmpeg overlay filter
  ```bash
  -filter_complex "[0:v][1:v]overlay=x=100:y=100[out]"
  ```
- [ ] Apply positions for all overlay clips
- [ ] Respect z-index (layer order)

**End of Phase 14 Checkpoint:**
✅ Can drag clips on canvas
✅ Can resize overlays
✅ Preset positions work
✅ Positions saved in export

---

## Phase 15: Recording System (4 hours) 🟡

### Recording Panel UI
- [ ] Create recording section in sidebar
- [ ] Add checkboxes:
  - [ ] ☐ Screen
  - [ ] ☐ Camera
  - [ ] ☐ Microphone
- [ ] Add [Start Recording] button
- [ ] Style to match media section

### Screen Source Selection
- [ ] Implement source picker dialog
- [ ] Use Electron desktopCapturer:
  ```typescript
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window']
  });
  ```
- [ ] Show thumbnails of available sources
- [ ] Let user select screen or window
- [ ] Add "Custom Area" option (if time)

### Camera Position Selector
- [ ] Show position selector if camera enabled
- [ ] 9 positions: TL, TC, TR, ML, C, MR, BL, BC, BR
- [ ] Preview camera feed in small box
- [ ] Let user choose position before recording

### MediaRecorder Implementation
- [ ] Get screen stream using selected source
- [ ] Get camera stream if enabled
- [ ] Get microphone stream if enabled
- [ ] Composite streams if multiple:
  - [ ] Use canvas to overlay camera on screen
  - [ ] OR keep separate (user choice)
- [ ] Create MediaRecorder
- [ ] Start recording on button click

### Recording UI Feedback
- [ ] Show red recording indicator
- [ ] Change button to [Stop Recording]
- [ ] Show timer (00:00)
- [ ] Disable other controls during recording

### Stop Recording
- [ ] Stop MediaRecorder
- [ ] Collect recorded chunks
- [ ] Create blob
- [ ] Save to temp file
- [ ] Show save dialog (Combined vs Separate)

### Save Options Dialog
- [ ] Show popup with options:
  - [ ] ○ Combined video (camera overlay)
  - [ ] ○ Separate files (screen, camera, audio)
- [ ] User selects option
- [ ] Process accordingly

### Add to Media Library
- [ ] Save recording to user-selected location
- [ ] Generate thumbnail
- [ ] Create MediaAsset
- [ ] Add to mediaStore
- [ ] Display in grid with 🔴 badge

### Multi-Stream Recording
- [ ] If screen + camera:
  - [ ] Combined: Overlay camera on screen
  - [ ] Separate: Save as two files
- [ ] If audio separate:
  - [ ] Extract audio track
  - [ ] Save as separate .m4a file
- [ ] Auto-add to timeline (optional)

**End of Phase 15 Checkpoint:**
✅ Can record screen
✅ Can record camera
✅ Can record microphone
✅ Can choose camera position
✅ Recording saves to media library
✅ Can export combined or separate

---

## Phase 16: Enhanced Export (1 hour) 🟡

### Multi-Track Export
- [ ] Process all tracks, not just one
- [ ] Layer tracks on top of each other
- [ ] Use FFmpeg overlay filter chain
- [ ] Respect track order (higher = on top)

### Resolution Options
- [ ] Add 4K option (3840x2160)
- [ ] Add "Source" option (use original)
- [ ] Calculate scaling for each clip
- [ ] Apply in FFmpeg

### Progress Improvements
- [ ] Show current step (Processing track 1/3)
- [ ] Show estimated time remaining
- [ ] Update progress more frequently
- [ ] Show FFmpeg output in debug mode

### Export Optimization
- [ ] Use hardware acceleration if available
- [ ] Choose best codec settings
- [ ] Balance quality vs file size
- [ ] Test export speed

**End of Phase 16 Checkpoint:**
✅ Multi-track export works
✅ All resolutions available
✅ Progress is detailed
✅ Export is fast

---

## Phase 17: Timeline Enhancements (1 hour) 🟡

### Audio Waveforms in Timeline
- [ ] Generate waveform data for audio clips
- [ ] Render waveform in clip block
- [ ] Use WaveSurfer.js or canvas
- [ ] Show peaks and valleys
- [ ] Match clip color

### Video Thumbnails in Timeline
- [ ] Show single thumbnail (first frame)
- [ ] On hover: Scrub through clip
  - [ ] Generate multiple thumbnails
  - [ ] Show different frame based on hover position
- [ ] Cache thumbnails for performance

### Zoom Improvements
- [ ] All three zoom methods working:
  - [ ] Slider
  - [ ] +/- buttons
  - [ ] Ctrl+Mouse wheel
- [ ] Smooth zoom animation
- [ ] Keep playhead centered during zoom
- [ ] Update time ruler markers

### Snap Features
- [ ] Snap playhead to clip edges
- [ ] Snap clips to each other (no gaps)
- [ ] Snap to grid (1-second intervals)
- [ ] Visual feedback when snapping
- [ ] Toggle snap on/off (optional)

**End of Phase 17 Checkpoint:**
✅ Waveforms show in audio clips
✅ Video thumbnails in timeline
✅ Hover scrub works
✅ Zoom is smooth and precise
✅ Snapping helps alignment

---

## Phase 18: Final Polish (2 hours) 🟡

### Additional Testing
- [ ] Test all features together
- [ ] Test with large project (20+ clips)
- [ ] Test different file formats
- [ ] Test on both Mac and Windows (if possible)
- [ ] Test edge cases:
  - [ ] Empty timeline
  - [ ] Very short/long clips
  - [ ] Missing files
  - [ ] Corrupt files

### Performance Optimization
- [ ] Profile app for bottlenecks
- [ ] Optimize timeline rendering
- [ ] Add virtualization for long timelines
- [ ] Lazy load thumbnails
- [ ] Debounce expensive operations

### Error Handling
- [ ] Add try-catch blocks
- [ ] Show user-friendly error messages
- [ ] Log errors for debugging
- [ ] Graceful fallbacks

### UI/UX Improvements
- [ ] Add keyboard shortcuts:
  - [ ] Space: Play/Pause
  - [ ] Cmd/Ctrl+I: Import
  - [ ] Cmd/Ctrl+E: Export
  - [ ] Delete: Delete selected
  - [ ] Cmd/Ctrl+D: Duplicate
  - [ ] S: Split
- [ ] Add tooltips on hover
- [ ] Add loading spinners
- [ ] Improve button states (disabled/active)
- [ ] Add animations (subtle)

### Accessibility
- [ ] Add alt text to icons
- [ ] Keyboard navigation
- [ ] Focus indicators
- [ ] Screen reader support (basic)

### Documentation
- [ ] Update README with full feature list
- [ ] Add architecture diagram
- [ ] Document known limitations
- [ ] Add troubleshooting section
- [ ] Include demo GIFs/screenshots

### Demo Video
- [ ] Record comprehensive 5-minute demo:
  - [ ] Import files
  - [ ] Record screen + camera
  - [ ] Multi-track editing
  - [ ] Apply effects (speed, volume, fade)
  - [ ] Canvas positioning
  - [ ] Split clips
  - [ ] Export with options
  - [ ] Show exported result
- [ ] Edit demo in ClipForge itself (dogfooding!)

### Final Packaging
- [ ] Build production version
- [ ] Test packaged app thoroughly
- [ ] Create installer (optional)
- [ ] Check file size (<300MB)
- [ ] Bundle all dependencies
- [ ] Test on clean machine

### Submission
- [ ] Push final code to GitHub
- [ ] Upload packaged app
- [ ] Upload demo video
- [ ] Update README with:
  - [ ] Download links
  - [ ] Demo video link
  - [ ] Feature showcase
  - [ ] Known issues
- [ ] Submit before 10:59 PM CT
- [ ] Celebrate! 🎉

**FULL VERSION COMPLETE! 🚀**

---

## Stretch Goals (If Extra Time)

### Nice to Have Features
- [ ] Undo/Redo functionality
- [ ] Auto-save project
- [ ] Project templates
- [ ] Keyboard shortcut customization
- [ ] Theme switching (light/dark)
- [ ] Batch export multiple resolutions
- [ ] Export presets (YouTube, Instagram, TikTok)
- [ ] Audio normalization
- [ ] Clip labels/colors
- [ ] Markers on timeline
- [ ] Nested timelines
- [ ] Video filters (brightness, contrast, saturation)
- [ ] Text overlays
- [ ] Transitions (fade, slide)
- [ ] Audio ducking
- [ ] Chroma key (green screen)

---

## Daily Checkpoint Summary

### End of Monday
- ✅ Layout complete
- ✅ State management working
- ✅ Can import files
- ✅ Files show in grid
- ✅ Can preview videos

### End of Tuesday (MVP)
- ✅ Timeline working
- ✅ Can drag clips to timeline
- ✅ Playhead synced
- ✅ Can trim clips
- ✅ Can export to MP4
- ✅ Packaged app

### End of Wednesday (Full)
- ✅ Multi-track timeline
- ✅ Multi-select & context menu
- ✅ Speed/volume/fade effects
- ✅ Canvas positioning
- ✅ Screen/camera recording
- ✅ Enhanced export
- ✅ Polished UI

---

## Quick Commands Reference

```bash
# Development
npm run dev

# Build
npm run build

# Package
npm run package:mac
npm run package:win

# Test
npm test
```

---

## Resources

- Electron Docs: https://www.electronjs.org/docs
- FFmpeg Guide: https://ffmpeg.org/ffmpeg.html
- Fluent-FFmpeg: https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
- WaveSurfer.js: https://wavesurfer-js.org/
- Zustand: https://github.com/pmndrs/zustand

---

**Last Updated:** October 27, 2025  
**Current Phase:** Phase 1 - Project Setup  
**Next Deadline:** MVP - Tuesday 10:59 PM CT

---

## Progress Tracking

**Overall Progress:**
- Monday Tasks: 0 / 44 complete (0%)
- Tuesday Tasks: 0 / 62 complete (0%)
- Wednesday Tasks: 0 / 89 complete (0%)

**Total Tasks:** 195
**Completed:** 0
**Remaining:** 195

---

**LET'S BUILD! 🚀**