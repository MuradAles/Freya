# Freya - Project Brief

## Overview

**Freya** (formerly "ClipForge") is a desktop video editor built with Electron and React, designed to enable creators to record, import, edit, and export professional videos. This is a 72-hour rapid development project targeting MVP completion in 2 days, with full feature completion in 3 days.

## Core Mission

Build a production-grade desktop video editor that allows users to:
- Record their screen, webcam, and microphone simultaneously
- Import video, audio, and image files
- Arrange media on a flexible multi-track timeline
- Apply effects (speed, volume, fade)
- Position overlays and picture-in-picture
- Export professional MP4 videos

## Value Proposition

A **CapCut/Clipchamp-style** video editor that runs natively on desktop, offering screen recording, webcam capture, and professional timeline editing in a single application.

## Key Requirements

### Must Have (MVP - Tuesday 10:59 PM CT)
✅ Desktop application (Electron + React)
✅ Media import (drag & drop, file picker)
✅ Single-track timeline with playhead
✅ Video preview player
✅ Basic trim functionality
✅ Export to MP4 (1080p)

### Should Have (Full Version - Wednesday 10:59 PM CT)
✅ Multi-track timeline
✅ Recording system (screen, webcam, mic)
✅ Effects (speed, volume, fade)
✅ Canvas positioning for overlays
✅ Multi-track export
✅ Track selection and splitting

### Nice to Have (Stretch Goals)
- Undo/redo
- Text overlays
- Transitions
- Filters
- Theme customization

## Success Criteria

1. **MVP Success**
   - App launches as a native desktop application
   - Can import and preview media
   - Can drag media to timeline
   - Can export edited timeline to MP4
   - Packaged as distributable (.dmg/.exe)

2. **Full Version Success**
   - All MVP features +
   - Can record screen/camera
   - Multi-track editing works
   - Effects apply correctly
   - Export handles multiple tracks

## Timeline

- **Day 1 (Monday, Oct 27)**: Project setup, layout, import system, basic preview
- **Day 2 (Tuesday, Oct 28)**: Timeline foundation, trim, export → **MVP Deadline 10:59 PM CT**
- **Day 3 (Wednesday, Oct 29)**: Recording, multi-track, effects → **Final Deadline 10:59 PM CT**

## Project Status

**Current Phase:** Phase 4 - File Import System (In Progress)
- ✅ Foundation setup complete
- ✅ State management working
- ✅ Layout structure implemented
- ⏳ Media import and preview development
- ⏳ Timeline and export pipeline pending

## Key Constraints

- Must work as a desktop application (not web)
- Must support Windows and Mac
- Must include FFmpeg for video processing
- UI must be simple enough to learn in 5 minutes
- Must handle large files efficiently
- Export quality must be professional-grade

## Target Users

1. **Content Creators**: Creating tutorial videos with screen + webcam
2. **Video Editors**: Assembling montages from multiple clips
3. **YouTubers**: Quick editing before upload
4. **Educators**: Recording and editing instructional content

## Out of Scope

❌ Text overlays (unless time permits)
❌ Transitions between clips
❌ Color grading filters
❌ Templates library
❌ Cloud upload
❌ Undo/redo (if no time)
❌ Auto-save (if no time)

## Development Philosophy

- **Focus on core flow**: Import → Edit → Export must work perfectly
- **Test packaged app early**: Don't wait until deadline
- **Keep UI simple**: CapCut/Clipchamp are simple for a reason
- **Performance matters**: Must handle 20+ clips smoothly
- **Recording is last**: Only add if core editing is solid

