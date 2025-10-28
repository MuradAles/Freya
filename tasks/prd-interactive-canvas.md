# Product Requirements Document: Interactive Canvas System

**Feature:** Interactive Canvas with Position, Size, Rotation, and Volume Controls  
**Project:** ClipForge - Desktop Video Editor  
**Date:** January 2025  
**Priority:** 🔴 Critical for MVP

---

## 1. Introduction/Overview

Currently, ClipForge can position clips on a canvas for preview, but lacks:
1. Visual canvas boundaries (users don't see the frame)
2. Interactive controls to move/resize/rotate clips
3. Export that respects custom positioning, sizing, and rotation
4. Volume controls in the Properties panel

This feature adds an **interactive canvas system** allowing users to:
- See a visible canvas border in preview
- Drag clips around the canvas
- Resize clips by dragging handles
- Rotate clips
- Adjust audio volume
- Export videos respecting all positioning, sizing, and rotation

**Goal:** Enable professional video composition with full control over clip positioning, size, rotation, and audio levels.

---

## 2. Goals

1. **Visual Canvas** - Show clear canvas boundaries in the preview window
2. **Interactive Canvas** - Enable dragging, resizing, and rotating clips on canvas
3. **Properties Panel** - Add position, size, rotation, and volume controls
4. **Export Integration** - FFmpeg export respects all positioning, sizing, and rotation
5. **User Feedback** - Real-time visual feedback during editing

---

## 3. User Stories

### As a video editor:
1. **As a user**, I want to see the canvas boundaries so I know where my content will be visible
2. **As a user**, I want to drag clips around the canvas to position them visually
3. **As a user**, I want to resize clips by dragging corner handles
4. **As a user**, I want to rotate clips to any angle
5. **As a user**, I want to see live preview of changes as I adjust position/size/rotation
6. **As a user**, I want to adjust audio volume using a slider
7. **As a user**, I want my exported video to match exactly what I see in the preview canvas

---

## 4. Functional Requirements

### 4.1 Visual Canvas
- [x] Display canvas border (visible frame)
- [ ] Add rulers/guides on canvas edges
- [ ] Show canvas dimensions (e.g., "1920x1080")
- [ ] Optional: Grid overlay
- [ ] Optional: Center crosshair guides

### 4.2 Interactive Canvas (New Features)
- [ ] Make canvas clickable to select clips
- [ ] Add drag functionality to move clips on canvas
- [ ] Add resize handles (4 corners) to clips
- [ ] Add rotation handle (circular handle)
- [ ] Add rotation anchor point (center of clip)
- [ ] Constrain to canvas boundaries (snap-to-bounds)
- [ ] Show visual feedback (outline, handles) on hover
- [ ] Update `clip.position` in store when dragged/resized
- [ ] Support multi-select drag

### 4.3 Properties Panel
- [ ] Add Position section:
  - [ ] X input (pixels or percentage)
  - [ ] Y input (pixels or percentage)
- [ ] Add Size section:
  - [ ] Width input
  - [ ] Height input
  - [ ] Lock aspect ratio checkbox
- [ ] Add Rotation section:
  - [ ] Angle input (degrees)
  - [ ] Rotation slider (-180° to +180°)
  - [ ] Reset rotation button
- [ ] Add Audio Volume section:
  - [ ] Volume slider (0% to 200%)
  - [ ] Mute checkbox
  - [ ] Visual indicator (🔇 if muted)
- [ ] Add Preset Positions:
  - [ ] Top-Left, Top-Right
  - [ ] Bottom-Left, Bottom-Right
  - [ ] Center button
- [ ] Sync inputs with canvas (update when clip moved)
- [ ] Update canvas when inputs changed

### 4.4 Export Integration
- [ ] Update export pipeline to read `clip.position.x`, `y`
- [ ] Apply position in FFmpeg overlay filter
- [ ] Scale clips to `clip.position.width` × `clip.position.height`
- [ ] Apply rotation using FFmpeg rotate/transpose filter
- [ ] Respect volume: `-af "volume={clip.volume}"`
- [ ] Maintain aspect ratio during export
- [ ] Handle multiple positioned clips in complex filter

### 4.5 Preview Integration
- [ ] Canvas updates position in real-time during drag
- [ ] Canvas updates size during resize
- [ ] Canvas updates rotation during rotation
- [ ] Preview video volume updates (already working)
- [ ] Visual snapping indicators

---

## 5. Non-Goals (Out of Scope)

### Not Included in This Version:
- [ ] Image filters (brightness, contrast, saturation)
- [ ] Video effects (blur, sharpen)
- [ ] Text overlays
- [ ] Transitions (fade, slide)
- [ ] Animation/keyframes
- [ ] Bezier curves/easing
- [ ] 3D transformations
- [ ] Canvas pan/zoom viewport (for now, keep full view)
- [ ] Undo/redo (separate feature)
- [ ] Copy/paste canvas transformations

### Export Non-Goals:
- [ ] Export partial canvas (always export full resolution)
- [ ] Custom canvas size in export (use project resolution)
- [ ] Multiple canvas compositions in one export

---

## 6. Technical Considerations

### 6.1 Data Structure (Already Exists)
```typescript
// clip.position is already defined in TimelineClip
position?: {
  x: number;                   // 0-1 percentage (e.g., 0.25 = 25% from left)
  y: number;                   // 0-1 percentage
  width: number;              // 0-1 percentage (e.g., 0.5 = 50% of canvas)
  height: number;             // 0-1 percentage
  rotation: number;           // Rotation in degrees
  zIndex: number;             // Layer order
}
```

### 6.2 FFmpeg Filters Needed

#### Position
```bash
overlay=x=100:y=200
```

#### Size (Scale)
```bash
scale=640:480
```

#### Rotation
```bash
# 90° clockwise
transpose=1

# 90° counter-clockwise  
transpose=2

# Custom angle (requires rotate filter)
-rotate PI/4
```

#### Volume (Already Working)
```bash
-af "volume=0.75"  # 75% volume
```

### 6.3 Canvas Interaction

#### HTML5 Canvas API
```typescript
// Draw clip at position with rotation
ctx.save();
ctx.translate(x + width/2, y + height/2);
ctx.rotate(angle * Math.PI / 180);
ctx.drawImage(video, -width/2, -height/2, width, height);
ctx.restore();
```

#### Mouse Events
```typescript
// Detect click on clip
const hitTest = (mouseX, mouseY) => {
  // Check if mouse is inside clip bounds
};

// Drag handler
const onMouseMove = (e) => {
  if (dragging) {
    // Update position
  }
};
```

### 6.4 Integration Points

#### Files to Modify:
1. `src/components/Preview/CompositeCanvas.tsx` - Add interaction handlers
2. `src/components/PropertiesPanel/PropertiesPanel.tsx` - Add controls
3. `src/electron/ipc/exportHandlers.ts` - Apply transformations in export
4. `src/store/timelineStore.ts` - Add updatePosition, updateSize, updateRotation actions

#### Files to Create:
1. `src/components/Canvas/CanvasControls.tsx` - Handle canvas interaction logic
2. `src/components/Canvas/ClipHandle.tsx` - Resize/rotation handles
3. `src/components/PropertiesPanel/PositionControls.tsx` - Position inputs
4. `src/components/PropertiesPanel/RotationControls.tsx` - Rotation slider

---

## 7. Design Considerations

### 7.1 Visual Design

#### Canvas Border
- 2px solid border
- Color: `#8B5CF6` (purple theme)
- Optional: Subtle shadow

#### Selection Indicators
- Outline: 2px dashed purple
- Handles: 8×8px square, purple background
- Rotation handle: Circular, at corner

#### Grid Overlay (Optional)
- 10×10 pixel grid
- Color: `#333333`
- Subtle, non-intrusive

### 7.2 User Experience

#### Interaction Flow
1. User clicks on clip → Highlights with outline
2. Drag → Moves clip, updates position live
3. Hover over resize handle → Cursor changes to "resize"
4. Drag resize handle → Updates size, maintains center
5. Rotate handle → Updates angle smoothly
6. Change Properties → Canvas updates in real-time

#### Feedback
- Smooth transitions (0.2s)
- Visual guides during drag
- Constraints visible (if outside bounds, show indicator)
- Audio volume icon changes if muted

### 7.3 Constraints

#### Canvas Boundaries
- Clips cannot be dragged outside canvas
- Snap to edges when close
- Visual indicator when at boundary

#### Aspect Ratio
- Lock aspect ratio checkbox (default: enabled)
- When unlocked, allow distortion
- Visual warning if aspect ratio changes significantly

---

## 8. Success Metrics

1. **Usability Test:** Users can successfully position, resize, and rotate clips within 2 minutes
2. **Export Accuracy:** Exported video matches preview canvas with 95% accuracy
3. **Performance:** Canvas remains responsive at 60fps during drag/resize
4. **Error Rate:** <1% of exports fail due to positioning issues
5. **User Satisfaction:** >4/5 stars for canvas features

---

## 9. Edge Cases

1. **Very Small Clips** - Make minimum size 20×20px
2. **Very Large Clips** - Allow up to 2× canvas size (overflow allowed)
3. **Overlapping Clips** - Respect zIndex for selection
4. **Rotated Clips** - Hit testing must account for rotation
5. **Canvas Resize** - Maintain clip positions relative to center
6. **Export Resolution Mismatch** - Scale positions proportionally
7. **Audio-Only Clips** - Hide position controls (show volume only)
8. **Image Clips** - Support full positioning
9. **Deleted Clips** - Clean up handles/selection
10. **Multi-Track Overlays** - Ensure proper z-ordering

---

## 10. Open Questions

1. **Should we allow negative rotation?** (Beyond 0-360°) → YES
2. **Should we lock aspect ratio by default?** → YES
3. **What's the minimum/maximum clip size?** → 20px min, 2× canvas max
4. **Should we add a "reset position" button?** → YES
5. **Canvas zoom?** → Not in MVP, full view only
6. **Multiple clip selection on canvas?** → YES, shift+click
7. **Keyboard shortcuts for rotation?** → Future enhancement
8. **Preset aspect ratios (16:9, 4:3)?** → Future enhancement

---

## 11. Dependencies

### Existing
- ✅ `clip.position` data structure
- ✅ Canvas rendering in `CompositeCanvas.tsx`
- ✅ FFmpeg export pipeline
- ✅ Properties panel structure

### New Dependencies
- None (use HTML5 Canvas API and existing FFmpeg)

---

## 12. Implementation Phases

### Phase 1: Visual Canvas (1 hour)
- Add canvas border
- Add rulers/guides
- Show canvas dimensions

### Phase 2: Interactive Canvas (3 hours)
- Make clips draggable
- Add resize handles
- Add rotation handle
- Hit testing
- Visual feedback

### Phase 3: Properties Panel (2 hours)
- Add position inputs
- Add size inputs
- Add rotation slider
- Add volume slider (if not exists)
- Sync with canvas

### Phase 4: Export Integration (2 hours)
- Read positions in export
- Apply FFmpeg overlay with x/y
- Scale clips to width/height
- Apply rotation in FFmpeg
- Handle multi-clip composition

---

**Total Estimated Time:** 8 hours  
**Status:** 📋 Ready for Task Breakdown  
**Next Step:** Generate detailed task list

