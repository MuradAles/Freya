# Task List: Interactive Canvas System

**Based on:** `tasks/prd-interactive-canvas.md`  
**Priority:** 🔴 Critical for MVP  
**Estimated Time:** 8 hours

---

## Relevant Files

- `src/components/Preview/CompositeCanvas.tsx` - Main canvas component, full interactive canvas with drag/resize/rotate/handles ✅ Phase 1+2 Complete
- `src/components/Canvas/CanvasControls.tsx` - New file: Canvas interaction logic and hit testing
- `src/components/Canvas/ClipHandle.tsx` - New file: Resize and rotation handle components
- `src/components/PropertiesPanel/PropertiesPanel.tsx` - Add position, size, rotation, volume controls
- `src/components/PropertiesPanel/PositionControls.tsx` - New file: Position input components
- `src/components/PropertiesPanel/RotationControls.tsx` - New file: Rotation slider component
- `src/store/timelineStore.ts` - Add updatePosition, updateSize, updateRotation actions
- `src/electron/ipc/exportHandlers.ts` - Apply transformations (position, size, rotation) in export
- `src/types/timeline.ts` - Verify `clip.position` interface

---

## Tasks

- [x] 1.0 Phase 1: Visual Canvas Border & Guides
  - [x] 1.1 Add visible canvas border (2px solid purple) in CompositeCanvas.tsx
  - [x] 1.2 Add dimension labels ("1920×1080") in corner of canvas
  - [x] 1.3 Add optional grid overlay (10×10px grid, subtle gray)
  - [x] 1.4 Test canvas border is visible on white/black backgrounds

- [x] 2.0 Phase 2: Interactive Canvas
  - [x] 2.1 Make canvas handle mouse events (onMouseDown, onMouseMove, onMouseUp)
  - [x] 2.2 Implement hit testing to detect which clip is clicked
  - [x] 2.3 Add drag functionality - move clip when mouse drags
  - [x] 2.4 Add resize handles (4 corner handles) to selected clip ✅ Purple corner handles
  - [x] 2.5 Implement resize logic - update width/height when dragging handles ✅ Drag corners to resize
  - [x] 2.6 Add rotation handle (circular handle at corner) ✅ Top-center circular handle
  - [x] 2.7 Implement rotation logic - update angle when dragging rotation handle ✅ Drag to rotate
  - [x] 2.8 Constrain clips to canvas boundaries (snap-to-edges) ✅ Boundaries enforced (0-1 range)
  - [x] 2.9 Add visual feedback (outline, handles) on clip selection ✅ Purple dashed outline + handles
  - [x] 2.10 Support multi-select on canvas (shift+click) ✅ Shift+click toggles selection

- [x] 3.0 Phase 3: Properties Panel Controls
  - [x] 3.1 Add Position section to PropertiesPanel
  - [x] 3.2 Add X/Y input fields with number inputs
  - [x] 3.3 Add Size section with Width/Height inputs
  - [x] 3.4 Add Lock Aspect Ratio checkbox
  - [x] 3.5 Add Rotation section with angle slider (-180° to +180°)
  - [x] 3.6 Add Reset Rotation button
  - [x] 3.7 Verify volume control exists (clip.volume slider)
  - [x] 3.8 Add Mute checkbox for audio
  - [x] 3.9 Add preset position buttons (TL, TR, BL, BR, Center)
  - [x] 3.10 Sync inputs with canvas (update when clip moved on canvas)
  - [x] 3.11 Update canvas when inputs changed

- [x] 4.0 Phase 4: Store Actions (Already handled by updateClip)
  - [ ] 4.1 Add `updateClipPosition(clipId, x, y)` to timelineStore
  - [ ] 4.2 Add `updateClipSize(clipId, width, height)` to timelineStore
  - [ ] 4.3 Add `updateClipRotation(clipId, angle)` to timelineStore
  - [ ] 4.4 Add `updateClipVolume(clipId, volume)` to timelineStore (if not exists)
  - [ ] 4.5 Test all actions update store correctly

- [x] 5.0 Phase 5: Export Integration
  - [x] 5.1 Update `processClip()` to read `clip.position.x` and `y`
  - [x] 5.2 Apply position in FFmpeg overlay filter: `overlay=x={x}:y={y}`
  - [x] 5.3 Update scaling to use `clip.position.width` and `height`
  - [x] 5.4 Add rotation to FFmpeg processing using `rotate` filter
  - [x] 5.5 Verify volume is already applied (check `-af "volume={clip.volume}"`)
  - [x] 5.6 Update multi-clip composition to respect positions
  - [x] 5.7 Handle clip ordering (zIndex) in export
  - [x] 5.8 Test export with positioned, sized, rotated clips

- [ ] 6.0 Phase 6: Testing & Polish
  - [ ] 6.1 Test drag and resize on canvas
  - [ ] 6.2 Test rotation handles work smoothly
  - [ ] 6.3 Test Properties panel inputs update canvas
  - [ ] 6.4 Test canvas interactions update Properties panel
  - [ ] 6.5 Test export matches preview exactly
  - [ ] 6.6 Test multiple positioned clips export correctly
  - [ ] 6.7 Test aspect ratio lock works
  - [ ] 6.8 Test volume slider and mute checkbox
  - [ ] 6.9 Fix any visual glitches or performance issues
  - [ ] 6.10 Add tooltips to explain controls

---

## Implementation Notes

### Canvas Interaction Architecture

```typescript
// Component structure
CompositeCanvas.tsx
  - Handles rendering of clips on canvas
  - Delegates interaction to CanvasControls.tsx
  
CanvasControls.tsx (NEW)
  - Handles mouse events
  - Hit testing
  - Drag, resize, rotation logic
  - Updates store via actions
  
ClipHandle.tsx (NEW)
  - Renders resize handles (4 corners)
  - Renders rotation handle
  - Shows visual feedback
```

### FFmpeg Export Logic

```typescript
// In exportHandlers.ts
// For each clip with position:
const x = clip.position.x * resolution.width;
const y = clip.position.y * resolution.height;
const w = clip.position.width * resolution.width;
const h = clip.position.height * resolution.height;

// Apply overlay
overlay=x=${x}:y=${y}

// Scale to size
scale=${w}:${h}

// Rotate if needed
transpose=1  // or custom rotate filter
```

### Position Calculation

All positions stored as **percentages (0-1)**:
- `x=0.25` means 25% from left edge
- `width=0.5` means 50% of canvas width

This allows:
- Resolution independence
- Easy export scaling
- Works on any canvas size

---

## Success Criteria

✅ Canvas border is visible  
✅ Clips can be dragged, resized, rotated  
✅ Properties panel controls work  
✅ Export matches preview exactly  
✅ Performance remains smooth (60fps)  
✅ No crashes or errors  
✅ User feedback is positive  

---

**Next Step:** Start Phase 1 - Visual Canvas Border

