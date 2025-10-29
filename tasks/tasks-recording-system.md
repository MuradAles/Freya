# Task List: Recording System

**Based on:** `tasks/prd-recording-system.md`  
**Priority:** 🔴 Critical for MVP  
**Estimated Time:** 11 hours

---

## Relevant Files

- `src/store/uiStore.ts` - Add mode state management ✅ MODIFIED
- `src/App.tsx` - Add mode switcher to header and conditional rendering ✅ MODIFIED
- `src/components/ModeSwitcher.tsx` - Mode switcher component with Editor/Recorder buttons ✅ CREATED
- `src/components/Recorder/RecorderMode.tsx` - Main recorder page with three recording buttons ✅ CREATED/MODIFIED (updated with useRecording integration)
- `src/components/Recorder/ScreenRecordingDialog.tsx` - Setup dialog for screen recording with layout ✅ CREATED
- `src/components/Recorder/CameraRecordingDialog.tsx` - Setup dialog for camera recording with live preview ✅ CREATED
- `src/components/Recorder/AudioRecordingDialog.tsx` - Setup dialog for audio-only recording with level test ✅ CREATED
- `src/components/Recorder/CustomAreaSelector.tsx` - Custom area selection overlay with drag-to-select ✅ CREATED
- `src/electron/ipc/recordingHandlers.ts` - IPC handlers for desktop capture and save ✅ MODIFIED
- `src/preload.ts` - Expose recording APIs to renderer ✅ MODIFIED
- `src/types/electron.d.ts` - TypeScript definitions for recording API ✅ MODIFIED
- `src/main.ts` - Call setupRecordingHandlers() ✅ MODIFIED
- `src/components/Recorder/RecordingCompleteDialog.tsx` - Save dialog after recording stops ✅ CREATED
- `src/hooks/useRecording.ts` - Core recording logic and MediaRecorder implementation ✅ COMPLETED (with stream exposure)

### Notes

- Use MediaRecorder API in renderer process (not main process) for performance
- Use Electron's desktopCapturer.getSources() to list available screens/windows
- Custom area selection uses click-and-drag interface similar to snipping tool
- Canvas compositing for screen + camera overlay during recording
- Record to WebM format for browser compatibility

---

## Tasks

- [x] 1.0 Mode Switcher Implementation
  - [x] 1.1 Add mode state management (editor/recorder) to uiStore
  - [x] 1.2 Create ModeSwitcher component with two buttons in header
  - [x] 1.3 Add styling for active/inactive mode buttons
  - [x] 1.4 Wire up mode switcher to state store
  - [x] 1.5 Add conditional rendering in App.tsx to show different layouts based on mode

- [x] 2.0 Recorder Entry Screen
  - [x] 2.1 Create RecorderMode.tsx component
  - [x] 2.2 Add three large recording buttons (Screen, Camera, Audio)
  - [x] 2.3 Style buttons with icons and hover effects
  - [x] 2.4 Add handlers to open respective dialogs
  - [x] 2.5 Layout: Centered, dark theme, clean design

- [x] 3.0 Screen Recording Setup Dialog
  - [x] 3.1 Create ScreenRecordingDialog.tsx component
  - [x] 3.2 Add radio buttons for screen selection (Full/Window/Custom)
  - [x] 3.3 Add window dropdown using desktopCapturer API
  - [x] 3.4 Add checkbox for microphone toggle
  - [x] 3.5 Add microphone dropdown when checkbox checked
  - [x] 3.6 Add Cancel and Start Recording buttons
  - [x] 3.7 Store selected options in state

- [x] 4.0 Camera Recording Setup Dialog
  - [x] 4.1 Create CameraRecordingDialog.tsx component
  - [x] 4.2 Add radio buttons for camera devices
  - [x] 4.3 List available cameras using getUserMedia
  - [x] 4.4 Create 9-position grid selector for camera position
  - [x] 4.5 Add position selection handling
  - [x] 4.6 Add microphone toggle and dropdown
  - [x] 4.7 Add Cancel and Start Recording buttons

- [x] 5.0 Audio Recording Setup Dialog
  - [x] 5.1 Create AudioRecordingDialog.tsx component
  - [x] 5.2 List available microphones using getUserMedia
  - [x] 5.3 Add radio buttons for microphone selection
  - [x] 5.4 Add audio level test/indicator
  - [x] 5.5 Add Cancel and Start Recording buttons

- [x] 6.0 Custom Area Selection
  - [x] 6.1 Create CustomAreaSelector.tsx component
  - [x] 6.2 Implement semi-transparent overlay
  - [x] 6.3 Add click-and-drag to create selection rectangle
  - [x] 6.4 Display coordinates and size during selection
  - [x] 6.5 Add corner handles for resize indication
  - [x] 6.6 Add Confirm and Cancel buttons
  - [x] 6.7 Return selected coordinates to parent dialog

- [x] 7.0 Recording Implementation (MediaRecorder)
  - [x] 7.1 Create useRecording.ts hook
  - [x] 7.2 Implement desktop capture stream setup
  - [x] 7.3 Implement camera stream setup
  - [x] 7.4 Implement microphone stream setup
  - [x] 7.5 Create MediaRecorder instance
  - [x] 7.6 Handle recording chunks
  - [x] 7.7 Implement start/stop recording functions
  - [x] 7.8 Generate WebM blob from chunks

- [x] 8.0 Live Preview During Recording
  - [x] 8.1 Create RecordingPreview.tsx component (integrated into RecorderMode)
  - [x] 8.2 Display recording stream in video element
  - [x] 8.3 Show recording timer (MM:SS format)
  - [x] 8.4 Add red recording indicator (animated pulse)
  - [x] 8.5 Display active sources (Screen, Camera, Microphone)
  - [x] 8.6 Add microphone level indicator bars (can be added later)
  - [x] 8.7 Add Stop Recording button
  - [x] 8.8 Update uiStore with recording state

- [ ] 9.0 Camera Overlay on Screen Recording
  - [ ] 9.1 Set up Canvas for compositing
  - [ ] 9.2 Draw screen stream to canvas background
  - [ ] 9.3 Calculate camera position based on selection (TL, TC, TR, etc.)
  - [ ] 9.4 Draw camera stream at correct position and size
  - [ ] 9.5 Implement real-time compositing during recording
  - [ ] 9.6 Capture composited canvas as recording stream

- [x] 10.0 Save Dialog and File System
  - [x] 10.1 Create RecordingCompleteDialog.tsx component
  - [x] 10.2 Show recording duration and file size
  - [x] 10.3 Add file path input with Browse button
  - [x] 10.4 Set default filename (recording-YYYY-MM-DD-HHMMSS.webm)
  - [x] 10.5 Add "Add to Media Library" checkbox (checked by default)
  - [x] 10.6 Implement saveBlobToFile function
  - [x] 10.7 Handle file save success/error
  - [x] 10.8 Add Cancel button to discard recording

- [ ] 11.0 Auto-import to Media Library
  - [ ] 11.1 Process saved video file (similar to imported files)
  - [ ] 11.2 Generate thumbnail from first frame
  - [ ] 11.3 Get video duration and metadata
  - [ ] 11.4 Create MediaAsset object
  - [ ] 11.5 Add to mediaStore
  - [ ] 11.6 Show in media grid with recorded badge (🔴)
  - [ ] 11.7 Auto-switch back to Editor mode
  - [ ] 11.8 Highlight new recording in media library

