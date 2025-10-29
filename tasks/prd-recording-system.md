# Product Requirements Document: Recording System

**Feature:** Video Screen, Camera, and Audio Recording  
**Project:** Freya (ClipForge) - Desktop Video Editor  
**Date:** January 2025  
**Priority:** 🔴 Critical for MVP

---

## 1. Introduction/Overview

Currently, Freya allows users to import existing media files for editing but lacks the ability to create new recordings directly within the application. This feature adds a **Recording Mode** where users can capture:

- **Screen recordings** (full screen, specific window, or custom area)
- **Camera recordings** (webcam with positionable overlay)
- **Audio recordings** (microphone only)
- **Combined recordings** (screen + camera + audio in one file)

**Goal:** Enable users to create and import recordings directly in Freya, eliminating the need to record in external applications.

---

## 2. Goals

1. **Recording Mode** - Add a separate "Recorder" mode distinct from "Editor" mode
2. **Screen Recording** - Capture screen content with custom area selection (like snipping tool)
3. **Camera Recording** - Record webcam feed with customizable position on screen
4. **Audio Recording** - Record microphone input (with or without video)
5. **Device Selection** - Allow users to choose specific screens, cameras, and microphones
6. **Live Preview** - Show what's being recorded in real-time
7. **Automatic Import** - Save recordings to media library after completion
8. **Seamless Workflow** - Switch from Recorder mode to Editor mode with recordings ready to use

---

## 3. User Stories

### As a content creator:
1. **As a user**, I want to record my screen so I can create tutorials and demonstrations
2. **As a user**, I want to record my screen with my camera overlay so I can appear on camera during tutorials
3. **As a user**, I want to record a specific window only so I don't capture unnecessary content
4. **As a user**, I want to record a custom screen area so I can focus on specific parts of my screen
5. **As a user**, I want to add my microphone to any recording so viewers can hear me
6. **As a user**, I want to choose which microphone to use so I can use my preferred audio device
7. **As a user**, I want to see live preview while recording so I know what I'm capturing
8. **As a user**, I want my recordings to automatically appear in my media library so I can start editing immediately

---

## 4. Functional Requirements

### 4.1 Mode Switcher (Header)
- [ ] Add "Editor" and "Recorder" mode buttons in top header
- [ ] Current mode highlighted (Editor = default, Recorder = alternate)
- [ ] Clicking mode switches the entire interface
- [ ] Editor mode shows timeline, preview, sidebars (current app)
- [ ] Recorder mode shows recording interface (new page)

### 4.2 Recorder Mode - Entry Screen
- [ ] Display three large buttons: "Record Screen", "Record Camera", "Record Audio"
- [ ] Buttons are visually distinct (icons + text)
- [ ] Each button triggers a setup dialog
- [ ] Layout: Clean, centered, easy to understand

### 4.3 Screen Recording Setup Dialog
When user clicks "Record Screen":

- [ ] **Screen Selection Options:**
  - [ ] Radio button: Full Screen
  - [ ] Radio button: Window (with dropdown to select specific open windows)
  - [ ] Radio button: Custom Area (opens click-and-drag interface like snipping tool)

- [ ] **Microphone Toggle:**
  - [ ] Checkbox: "Include Microphone"
  - [ ] When checked, show microphone dropdown
  - [ ] List all available microphones
  - [ ] Default to first available microphone

- [ ] **Action Buttons:**
  - [ ] Cancel button (closes dialog)
  - [ ] "Start Recording" button (begins capture)

### 4.4 Camera Recording Setup Dialog
When user clicks "Record Camera":

- [ ] **Camera Selection:**
  - [ ] Radio buttons for each available camera device
  - [ ] Show preview thumbnail for each camera
  - [ ] Label devices (Built-in, USB Camera, External, etc.)

- [ ] **Camera Position Selector:**
  - [ ] 9-position grid (TL, TC, TR, ML, C, MR, BL, BC, BR)
  - [ ] User clicks desired position
  - [ ] Selected position highlighted
  - [ ] Position affects how camera appears on screen during recording

- [ ] **Microphone Toggle:**
  - [ ] Checkbox: "Include Microphone"
  - [ ] When checked, show microphone dropdown (same as screen recording)
  - [ ] List all available microphones

- [ ] **Action Buttons:**
  - [ ] Cancel button (closes dialog)
  - [ ] "Start Recording" button (begins capture)

### 4.5 Audio Recording Setup Dialog
When user clicks "Record Audio":

- [ ] **Microphone Selection:**
  - [ ] Radio buttons for each available microphone device
  - [ ] Show device name and type
  - [ ] Test button to preview audio level

- [ ] **Action Buttons:**
  - [ ] Cancel button (closes dialog)
  - [ ] "Start Recording" button (begins capture)

### 4.6 Custom Area Selection (Screen Recording)
When user selects "Custom Area":

- [ ] Screen goes semi-transparent with overlay
- [ ] User clicks and drags to create selection rectangle
- [ ] Rectangle shows selection border and dimensions
- [ ] Can drag edges to resize selection
- [ ] Show live coordinates and size (e.g., "1280x720 at (100, 50)")
- [ ] "Confirm Selection" and "Cancel" buttons
- [ ] On confirm, close overlay and return to setup dialog with coordinates

### 4.7 Active Recording Interface
When recording starts:

- [ ] **Header Changes:**
  - [ ] Display: 🔴 RECORDING status indicator
  - [ ] Display: ⏱️ Timer (MM:SS format)
  - [ ] Mode toggle disabled (can't switch during recording)

- [ ] **Live Preview Area:**
  - [ ] Large video preview showing what's being recorded
  - [ ] For screen recording: Shows screen content
  - [ ] For camera recording: Shows camera feed
  - [ ] For combined: Shows screen with camera overlay
  - [ ] Preview updates in real-time (live feed)

- [ ] **Recording Controls:**
  - [ ] "⏹️ STOP RECORDING" button (prominent, red when hovering)
  - [ ] Microphone level indicator (visual bars showing audio input)
  - [ ] Current recording info (resolution, sources, etc.)

- [ ] **Device Indicators:**
  - [ ] Show active sources: 📺 Screen, 📷 Camera, 🎤 Microphone
  - [ ] Display device names (e.g., "USB Camera", "Built-in Mic")

### 4.8 Recording Implementation
Technical implementation:

- [ ] Use Electron's `desktopCapturer` for screen recording
- [ ] Use `getUserMedia()` for camera and microphone
- [ ] Use MediaRecorder API in renderer process
- [ ] Record to WebM format (browser-compatible)
- [ ] Composite screen + camera streams in real-time using Canvas
- [ ] Apply camera position settings (where to overlay on screen)
- [ ] Mix audio tracks together
- [ ] Collect recorded chunks in memory
- [ ] Display live preview from recorded stream

### 4.9 After Recording Stops
When user clicks "STOP RECORDING":

- [ ] Stop MediaRecorder and collect all chunks
- [ ] Create Blob from recorded data
- [ ] Show "Saving..." indicator
- [ ] Display completion dialog with options:

**Save Dialog:**
- [ ] "Recording Complete!"
- [ ] Show duration and file size
- [ ] "Save to:" file path input with [Browse] button
- [ ] Default filename: "recording-YYYY-MM-DD-HHMMSS.webm"
- [ ] "Add to Media Library" checkbox (checked by default)
- [ ] [Cancel] [Save & Add to Library] buttons

### 4.10 Automatic Import & Editor Switch
After saving:

- [ ] Process video file (similar to imported files)
- [ ] Generate thumbnail (first frame of video)
- [ ] Get video duration
- [ ] Create MediaAsset object
- [ ] Add to mediaStore (media library)
- [ ] Display in media grid with 🔴 badge (indicates recorded)
- [ ] Auto-switch back to "Editor" mode
- [ ] Highlight new recording in media library
- [ ] Optional: Auto-add to timeline (future enhancement)

---

## 5. Non-Goals (Out of Scope)

### Not Included in This Version:
- [ ] Multi-track timeline support (recording mode is separate)
- [ ] Recording from multiple screens simultaneously (one screen at a time)
- [ ] Recording system audio (captures only microphone)
- [ ] Scheduled/automated recordings
- [ ] Recording presets or templates
- [ ] Live streaming (local recording only)
- [ ] Recording annotations or overlays beyond camera
- [ ] Recording history or recently recorded files list
- [ ] Editing recordings before saving (must save, then edit in Editor mode)
- [ ] Recording quality settings (uses system default)
- [ ] Recording codec selection (always WebM)
- [ ] Custom recording hotkeys (only button-based controls)

---

## 6. Design Considerations

### 6.1 Visual Design

#### Mode Switcher (Header)
- Top bar: Fixed position, always visible
- Mode buttons: Pill-shaped, active mode highlighted purple
- Icons: 📝 (editor), 🎥 (recorder)

#### Recorder Entry Screen
- Large, prominent buttons (at least 200x200px each)
- Icons: 📺 (screen), 📷 (camera), 🎤 (audio)
- Centered layout, good spacing
- Dark theme consistent with Editor mode

#### Recording Status
- Recording indicator: 🔴 Red dot (animated pulse effect)
- Timer: Large, visible (at least 24px font)
- Preview area: Centered, takes most of screen space
- Stop button: Red background, large, easily accessible

### 6.2 User Experience

#### Recording Flow
1. User clicks "Recorder" mode
2. Selects recording type (Screen/Camera/Audio)
3. Configures devices and options
4. Starts recording
5. Records with live preview
6. Stops recording
7. Saves to location
8. Auto-imports to library
9. Returns to Editor mode

#### Error Handling
- If no camera available: Disable "Record Camera" button
- If no microphone available: Still allow recording (without audio)
- If permissions denied: Show clear error message
- If file save fails: Show error, keep blob in memory, allow retry

#### Feedback
- Visual: Red indicator, timer, preview
- Audio: Optional beep when recording starts/stops
- Loading: "Saving..." indicator during save process
- Success: Highlight new file in media library

---

## 7. Technical Considerations

### 7.1 Electron Desktop Capture
```typescript
// Get screen/window sources (main process)
const sources = await desktopCapturer.getSources({
  types: ['screen', 'window']
});

// Stream in renderer
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    mandatory: {
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: sourceId,
    }
  }
});
```

### 7.2 Camera & Microphone Capture
```typescript
// Get user media (renderer process)
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,      // camera
  audio: true        // microphone
});
```

### 7.3 MediaRecorder API
```typescript
// Create recorder
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'video/webm;codecs=vp9'
});

// Record chunks
const chunks: Blob[] = [];
mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

// Stop and save
mediaRecorder.onstop = () => {
  const blob = new Blob(chunks, { type: 'video/webm' });
  // Save blob to file
};
```

### 7.4 Custom Area Selection
```typescript
// Use HTML5 Canvas to draw overlay
// Mouse events to handle click and drag
// Calculate coordinates: { x, y, width, height }
// Use with desktopCapturer to crop the recorded area
```

### 7.5 Camera Overlay (Screen + Camera)
```typescript
// Composite using HTML5 Canvas
// Draw screen stream to canvas
// Draw camera stream at specified position
// Record combined canvas stream
```

### 7.6 File Structure Changes
```
src/
  components/
    Recorder/
      RecorderMode.tsx          - Main recorder page
      ScreenRecordingDialog.tsx - Screen setup dialog
      CameraRecordingDialog.tsx - Camera setup dialog
      AudioRecordingDialog.tsx  - Audio setup dialog
      RecordingPreview.tsx       - Live preview component
      CustomAreaSelector.tsx     - Snipping tool interface
    App.tsx                      - Add mode switcher
  hooks/
    useRecording.ts              - Recording logic
    useCustomArea.ts             - Custom area selection
  electron/
    ipc/
      recordingHandlers.ts       - IPC handlers
```

### 7.7 State Management
```typescript
// Add to uiStore or create recordingStore
interface RecordingState {
  isRecording: boolean;
  recordingType: 'screen' | 'camera' | 'audio' | null;
  selectedSources: {
    screen?: string;
    camera?: string;
    microphone?: string;
  };
  cameraPosition: string; // 'TL', 'TC', 'TR', etc.
  customArea?: { x, y, width, height };
  timer: number; // seconds
}
```

---

## 8. Success Metrics

1. **User Success Rate:** >90% of users can successfully record screen, camera, and audio within 5 minutes
2. **Recording Quality:** Recordings play smoothly without stuttering or dropped frames
3. **File Size:** Recordings do not exceed reasonable file sizes (<100MB for 5-minute 1080p)
4. **Save Success Rate:** >95% of recordings save successfully without errors
5. **Import Rate:** Recordings automatically appear in media library 100% of the time
6. **User Satisfaction:** Users report recording feature as intuitive and easy to use

---

## 9. Edge Cases

1. **No Cameras Available:** Disable "Record Camera" button, show message
2. **No Microphones Available:** Still allow recording, just mark microphone unavailable
3. **Permissions Denied:** Show clear error: "Please allow screen recording access"
4. **Large Recording (>1 hour):** Warn user: "Large file will take time to save"
5. **Disk Space Full:** Catch error, show: "Not enough disk space to save recording"
6. **Window Closed During Recording:** Handle gracefully, save partial recording
7. **Multiple Monitors:** Let user select which screen to record
8. **Camera Selected Then Disconnected:** Detect and pause recording with error
9. **Microphone Selected Then Disconnected:** Detect and continue recording (show warning)
10. **Recording While Editing:** Switch to Editor mode automatically pauses recording

---

## 10. Open Questions

1. **Recording Format:** Should we use WebM (recommended) or MP4?
   - **Decision:** WebM for compatibility, MP4 conversion in export
2. **Maximum Recording Duration:** Should there be a limit?
   - **Decision:** No limit, but warn if >1 hour
3. **Recording Quality:** Should users be able to choose quality settings?
   - **Decision:** Use system default (high quality), no settings for MVP
4. **Auto-add to Timeline:** Should recordings automatically appear on timeline?
   - **Decision:** No, just add to library (user drags to timeline)
5. **Save Location:** Should we remember last save location?
   - **Decision:** Yes, use last location or default to Videos folder
6. **Multiple Audio Sources:** Can users record from multiple microphones?
   - **Decision:** No, select one microphone at a time
7. **Recording While Minimized:** Should recording continue?
   - **Decision:** Yes, recording continues in background
8. **Cancel During Recording:** Should there be a discard option?
   - **Decision:** No, must stop and save (too risky to lose work)

---

## 11. Dependencies

### Existing
- ✅ Electron main process (for desktopCapturer)
- ✅ IPC handlers structure (fileHandlers, exportHandlers)
- ✅ MediaStore (for saving to library)
- ✅ UIStore (for recording state)
- ✅ Image/video processing utils

### New
- MediaRecorder API (built into browsers)
- Canvas API (for compositing and custom area)
- getUserMedia API (for camera/microphone)
- Electron's desktopCapturer (for screen recording)

---

## 12. Implementation Phases

### Phase 1: Mode Switcher (1 hour)
- Add mode switcher to header
- Create mode state management
- Switch between Editor and Recorder layouts

### Phase 2: Recorder Entry Screen (1 hour)
- Create three recording buttons
- Add hover effects and styling
- Connect buttons to dialog triggers

### Phase 3: Recording Dialogs (2 hours)
- Screen Recording Setup Dialog
- Camera Recording Setup Dialog
- Audio Recording Setup Dialog
- Custom Area Selector

### Phase 4: Recording Implementation (3 hours)
- Desktop capture setup
- Camera and microphone capture
- MediaRecorder initialization
- Live preview rendering

### Phase 5: Custom Area & Camera Overlay (2 hours)
- Custom area selection UI
- Coordinates calculation
- Camera position overlay
- Canvas compositing

### Phase 6: Save & Import (2 hours)
- Save dialog UI
- File system save
- Media asset creation
- Auto-import to library
- Mode switch back to Editor

---

**Total Estimated Time:** 11 hours  
**Status:** 📋 Ready for Task Breakdown  
**Next Step:** Generate detailed task list

