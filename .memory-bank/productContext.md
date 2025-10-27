# Freya - Product Context

## Why This Project Exists

Freya solves the problem of **fragmented desktop video editing**. Most professional editors are complex and expensive, while free alternatives lack key features like recording and multi-track editing.

### Market Opportunity

Video creation is exploding, but desktop tools are either:
- **Too Complex**: Adobe Premiere, Final Cut Pro (learning curve)
- **Too Limited**: Basic editors without recording or multi-track
- **Web-Based**: Dependent on internet, slower performance
- **Subscription-Only**: Monthly fees for basic editing

### Our Solution

Freya offers a **CapCut-style** desktop experience with:
- Native desktop performance (no browser overhead)
- Built-in screen recording (no separate tools)
- Multi-track timeline (professional editing)
- FFmpeg-powered export (production quality)
- One-time purchase (no subscriptions)

## Problems We Solve

### Problem 1: Fragmented Recording Workflow
**Current state:** Users need OBS for recording, then import to an editor
**Freya solution:** Record directly in the app, auto-add to timeline
**Impact:** Saves 10+ minutes per video, no file juggling

### Problem 2: Limited Professional Features in Free Tools
**Current state:** Basic editors lack multi-track, effects, positioning
**Freya solution:** Full timeline editing with effects (speed, volume, fade)
**Impact:** Creates professional videos without expensive software

### Problem 3: Web-Based Editors are Slow
**Current state:** Online editors lag with large files
**Freya solution:** Native desktop app with local processing
**Impact:** Smooth playback, fast export, no internet required

### Problem 4: Export Quality is Poor
**Current state:** Free tools compress exports heavily
**Freya solution:** FFmpeg ensures professional-grade output
**Impact:** YouTube-ready quality, multiple resolution options

## Target User Scenarios

### Scenario 1: Content Creator Recording a Tutorial
**Persona:** Tech YouTuber creating coding tutorials

**Workflow:**
1. Click "Record"
2. Select screen (their IDE) + webcam + microphone
3. Choose webcam position (bottom-right corner)
4. Record tutorial
5. Stop recording → media automatically added to timeline
6. Trim awkward pauses
7. Export to 1080p MP4
8. Upload to YouTube

**Pain points solved:**
- No need to switch between OBS and editor
- Webcam positioning handled automatically
- Export quality matches professional standards

### Scenario 2: Video Editor Assembling Montage
**Persona:** Social media manager creating product showcase

**Workflow:**
1. Import 5 product video clips
2. Import background music
3. Drag clips to timeline (audio on track 1, videos on track 2+)
4. Arrange clips in sequence
5. Trim clips to match music beats
6. Speed up some clips (2x) for energy
7. Add fade out to final clip
8. Position logo overlay on Track 3
9. Export to 1080p

**Pain points solved:**
- Multi-track composition without layers confusion
- Effects (speed/fade) apply instantly
- Overlay positioning is intuitive
- Professional output ready for social media

### Scenario 3: Educator Recording Lecture
**Persona:** Teacher creating online course content

**Workflow:**
1. Record screen (presentation slides) + camera + mic
2. Combine into single file for simplicity
3. Import intro and outro videos
4. Arrange: intro → recording → outro
5. Trim out mistakes
6. Adjust volume on audio track
7. Export for course platform

**Pain points solved:**
- No complex software training needed
- Recording integrated into workflow
- Multi-part videos easy to combine
- Quality suitable for professional courses

## User Experience Goals

### Simplicity (Learn in 5 Minutes)
- One-click import
- Drag-and-drop timeline
- Visual trimming (drag edges)
- Export with one button

**Principle:** If a beginner can't edit in 5 minutes, we've failed.

### Power (Professional Results)
- Multi-track composition
- Real-time effects preview
- Precise positioning
- Production-quality export

**Principle:** Professional creators should get professional results.

### Performance (Desktop-Grade Speed)
- < 5 second app launch
- < 2 second file import
- 30 fps preview playback
- Fast export (< 3 min for 5-min video)

**Principle:** Speed matters when working with media.

### Reliability (It Just Works)
- No crashes during export
- FFmpeg bundling works on all platforms
- File formats handled gracefully
- Error messages are user-friendly

**Principle:** Trust is built through reliability.

## Competitive Position

### vs CapCut/Clipchamp
- **Advantage:** Desktop-native performance (no browser)
- **Advantage:** Built-in recording (no separate tools)
- **Trade-off:** No cloud sync (local only)

### vs Adobe Premiere
- **Advantage:** One-time purchase (no subscription)
- **Advantage:** Simpler UI (5-minute learning curve)
- **Trade-off:** Fewer professional features (no text, transitions)

### vs OBS + Movie Editor
- **Advantage:** All-in-one workflow (record + edit)
- **Advantage:** Integrated timeline (no export/import)
- **Trade-off:** Less specialized recording options

## Design Philosophy

### "CapCut-Style" UI
- **Dark theme** (easy on eyes)
- **Purple accents** (professional, modern)
- **Grid layout** (sidebar | preview | properties)
- **Timeline at bottom** (standard video editor pattern)

### Color System (6 Themes)
1. **Dark** (default) - Professional video editing
2. **Light** - Bright, clean look
3. **Midnight** - Blue accent (night mode)
4. **Sunset** - Orange warmth
5. **Forest** - Green nature vibe
6. **Ocean** - Cyan fresh look

### Visual Hierarchy
- **Primary actions:** Purple buttons, prominent
- **Media grid:** 2-column, thumbnails first
- **Timeline:** Horizontal tracks, clip blocks
- **Preview:** Centered, video-first

## Success Metrics

### MVP Metrics
- ✅ All critical path features work
- ✅ Can complete "create a 3-minute video" in < 20 minutes
- ✅ Export quality is YouTube-ready
- ✅ App size < 200 MB

### Full Version Metrics
- ✅ Recording works for screen + camera simultaneously
- ✅ Multi-track export composited correctly
- ✅ Effects (speed/volume/fade) apply during export
- ✅ Canvas positioning preserved in output

## Future Vision (Out of Scope for MVP)

**Post-Launch Ideas:**
- Text overlays (titles, captions)
- Transitions (fade, slide)
- Color grading filters
- Audio ducking
- Keyboard shortcuts
- Project auto-save
- Templates library
- Batch export
- Cloud integration (optional)

## Key Learnings

1. **Import is Critical:** Users need fast, intuitive file management
2. **Timeline is Core:** Everything revolves around the timeline
3. **Preview Matters:** Real-time feedback builds trust
4. **Export is Validation:** Quality export proves the tool works
5. **Recording is Differentiator:** Built-in recording saves time

## Product Principles

1. **Desktop First:** Leverage native performance
2. **Intuitive UI:** No tutorials needed
3. **Professional Output:** Export quality matters
4. **Rapid Development:** Ship MVP in 2 days, full in 3
5. **Open Source Ready:** Code structure supports future OSS

