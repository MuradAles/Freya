# Canvas Rendering Performance Optimization Plan

## Executive Summary
The application currently suffers from severe performance issues causing 100% GPU usage when idle and extreme lag during playhead scrubbing. This document outlines the identified problems and their solutions.

---

## Performance Issues Identified

### 1. NUCLEAR PROBLEM: Infinite Render Loop
**Severity:** Critical
**Location:** [useCanvasRendering.ts:508](../src/hooks/useCanvasRendering.ts#L508)

#### Current Behavior
```typescript
animationFrameRef.current = requestAnimationFrame(render);
```
This line executes at the END of every render function, creating an infinite loop that runs at ~60 FPS continuously, even when the application is completely idle.

#### Impact
- GPU runs at 100% immediately upon app launch
- Renders 60 frames per second when nothing is changing
- Wastes ~3600 frames per minute doing nothing
- Drains battery on laptops
- Heats up system unnecessarily

#### Root Cause
The render loop has no conditional logic to stop when idle. It assumes something is always changing.

---

### 2. CRITICAL PROBLEM: useEffect Dependency Chain Nightmare
**Severity:** Critical
**Location:** [useCanvasRendering.ts:518](../src/hooks/useCanvasRendering.ts#L518)

#### Current Behavior
```typescript
useEffect(() => {
  // Entire render system setup
}, [playheadPosition, isPlaying, showGrid, canvasColor, canvasRef, CANVAS_WIDTH, CANVAS_HEIGHT, RENDER_SCALE]);
```

When dragging the playhead:
1. `setPlayhead(time)` fires 60-120 times per second
2. `playheadPosition` changes
3. useEffect detects dependency change
4. **Cancels entire animation frame loop**
5. **Recreates entire render function**
6. **Restarts animation frame loop from scratch**
7. Repeat 60-120 times per second

#### Impact
- Massive overhead from recreating render function constantly
- Animation frame constantly cancelled and restarted
- All render state resets every frame during drag
- Creates stuttering and lag
- CPU spends time recreating functions instead of rendering

#### Root Cause
`playheadPosition` is a frequently-changing value in the dependency array. Dependencies should only include values that require complete system restart, not values that change every frame.

---

### 3. SEVERE PROBLEM: Ultra High-Resolution Rendering
**Severity:** High
**Location:** [CompositeCanvas.tsx:27](../src/components/Preview/CompositeCanvas.tsx#L27)

#### Current Behavior
```typescript
const RENDER_SCALE = 4;
```
- Logical canvas size: 1920×1080
- Actual rendering size: 7680×4320 (8K resolution)
- Total pixels per frame: 33.2 million pixels
- At 60 FPS: ~2 billion pixels per second

#### Impact
- Extreme GPU memory usage
- Every draw operation processes 33M pixels
- Scaling, rotation, transformations all at 8K
- Overkill for preview/editing UI
- 16x more pixels than 1080p

#### Root Cause
RENDER_SCALE set too high for editing preview. 8K quality is unnecessary for real-time editing interface.

---

### 4. MAJOR PROBLEM: Video Seeking Storm
**Severity:** High
**Location:** [useCanvasRendering.ts:350-352](../src/hooks/useCanvasRendering.ts#L350-L352)

#### Current Behavior
```typescript
if (timeDiff > seekThreshold) {
  video.currentTime = actualTime;  // Seek operation
}
```

During playhead drag:
- Every render checks video sync
- If video is >0.1s off, triggers seek
- Video decoder attempts to jump to new position
- Seeking triggers `seeking` and `seeked` events
- These events force another render
- User drags faster than video can seek
- Video constantly seeking but never catching up

#### Impact
- Video decoder constantly restarting
- CPU/GPU thrashing from decode restarts
- Videos appear frozen or jumpy during drag
- Seeking prevents smooth frame display
- Each seek = find keyframe + decode forward = expensive

#### Root Cause
Seeking on every frame during fast scrubbing. Video decoders aren't designed for 60+ seeks per second.

---

### 5. SERIOUS PROBLEM: Expensive Drawing Operations
**Severity:** Medium-High
**Location:** [canvasDrawing.ts:34-75](../src/utils/canvasDrawing.ts#L34-L75)

#### Current Behavior: Step-Down Scaling
When video needs to be scaled down >50%:
```typescript
// Step 1: Draw video to temporary canvas at intermediate size
tempCtx.drawImage(video, 0, 0, currentWidth, currentHeight);

// Step 2: Draw temp canvas to final destination
ctx.drawImage(tempCanvas, 0, 0, currentWidth, currentHeight, dx, dy, dw, dh);
```

#### Impact
- 2-3x more draw operations per clip
- Creates and caches temporary canvases in memory
- Each draw operation at high resolution
- With rotations: save/translate/rotate/draw/restore per clip
- Multiple clips = multiplicative effect

#### Example with 3 video clips:
- 3 clips × 2-3 draws each = 6-9 draw operations
- At 8K resolution
- With rotation transforms
- At 60 FPS = 360-540 draw calls per second

#### Root Cause
High-quality rendering technique optimized for quality over performance. Good for export, expensive for real-time preview.

---

## Optimization Solutions

### Solution 1: Conditional Rendering (Fixes Nuclear Problem)
**Priority:** P0 - Highest
**Expected Impact:** 90% GPU reduction when idle
**Complexity:** Medium

#### Implementation Strategy

**Step 1: Add render state tracking**
```typescript
// Track when rendering is needed
const needsRenderRef = useRef(true);
const isIdleRef = useRef(false);
```

**Step 2: Create conditional render loop**
```typescript
const render = useCallback(() => {
  // Only continue loop if:
  // - Currently playing, OR
  // - User is dragging/interacting, OR
  // - Pending changes exist

  const shouldContinue = isPlaying || isDragging || needsRenderRef.current;

  if (shouldContinue) {
    // Do rendering...
    animationFrameRef.current = requestAnimationFrame(render);
  } else {
    // Stop loop - idle state
    isIdleRef.current = true;
  }
}, [dependencies]);
```

**Step 3: Add render triggers**
```typescript
// When playhead changes while paused, trigger single render
const triggerRender = () => {
  if (isIdleRef.current) {
    needsRenderRef.current = true;
    animationFrameRef.current = requestAnimationFrame(render);
    isIdleRef.current = false;
  }
};
```

#### Files to Modify
- [useCanvasRendering.ts](../src/hooks/useCanvasRendering.ts)
- [timelineStore.ts](../src/store/timelineStore.ts) - Add `isDragging` state

#### Success Criteria
- 0% GPU usage when paused and idle
- Renders only when: playing, dragging, or properties change
- Smooth transition between render/idle states

---

### Solution 2: Decouple Playhead from useEffect (Fixes Critical Problem)
**Priority:** P0 - Highest
**Expected Impact:** Eliminates recreation storm during drag
**Complexity:** Medium

#### Implementation Strategy

**Step 1: Convert playheadPosition to ref**
```typescript
// Instead of dependency
const playheadPositionRef = useRef(playheadPosition);

// Update ref when prop changes (outside useEffect)
useEffect(() => {
  playheadPositionRef.current = playheadPosition;
}, [playheadPosition]);
```

**Step 2: Remove from main useEffect dependencies**
```typescript
// BEFORE:
useEffect(() => {
  // setup
}, [playheadPosition, isPlaying, ...]);

// AFTER:
useEffect(() => {
  // setup - playheadPositionRef.current accessed inside
}, [isPlaying, showGrid, canvasColor, ...]); // playheadPosition REMOVED
```

**Step 3: Access via ref in render loop**
```typescript
const render = useCallback(() => {
  const currentPlayhead = playheadPositionRef.current; // Use ref
  const clipsAtPlayhead = getClipsAtPlayhead(currentPlayhead);
  // ... rest of render
}, []);
```

#### Files to Modify
- [useCanvasRendering.ts](../src/hooks/useCanvasRendering.ts)

#### Success Criteria
- Dragging playhead does NOT trigger useEffect
- Render loop continues smoothly during drag
- No animation frame cancellation during scrubbing
- useEffect only triggers on major changes (media, tracks, settings)

---

### Solution 3: Reduce Render Scale (Fixes Severe Problem)
**Priority:** P0 - Highest
**Expected Impact:** 75% fewer pixels to process
**Complexity:** Trivial

#### Implementation Strategy

**Single line change:**
```typescript
// BEFORE:
const RENDER_SCALE = 4; // 7680×4320 = 33.2M pixels

// AFTER:
const RENDER_SCALE = 2; // 3840×2160 = 8.3M pixels (4K)
```

#### Comparison Table
| Scale | Resolution | Pixels | GPU Load | Quality |
|-------|-----------|--------|----------|---------|
| 4 | 7680×4320 | 33.2M | 100% | 8K (overkill) |
| 3 | 5760×3240 | 18.7M | 56% | 6K (still high) |
| 2 | 3840×2160 | 8.3M | 25% | 4K (excellent) |
| 1 | 1920×1080 | 2.1M | 6% | 1080p (good) |

#### Files to Modify
- [CompositeCanvas.tsx](../src/components/Preview/CompositeCanvas.tsx)

#### Success Criteria
- Still excellent visual quality (4K)
- 75% reduction in pixels processed
- No visual degradation noticeable in UI
- Massive GPU performance improvement

---

### Solution 4: Throttle Video Seeking (Fixes Major Problem)
**Priority:** P1 - High
**Expected Impact:** Smoother scrubbing, less decoder thrashing
**Complexity:** Medium

#### Implementation Strategy

**Step 1: Add seeking throttle state**
```typescript
const seekFrameCounterRef = useRef(0);
const SEEK_THROTTLE_FRAMES = 3; // Seek every 3 frames during drag
```

**Step 2: Track dragging state**
```typescript
// In timelineStore.ts
interface TimelineStore {
  isDragging: boolean; // NEW
  setIsDragging: (dragging: boolean) => void;
}

// In Playhead.tsx
const handleMouseDown = () => {
  setIsDragging(true); // Set store state
};

const handleMouseUp = () => {
  setIsDragging(false); // Clear store state
};
```

**Step 3: Conditional seeking logic**
```typescript
// In render loop
videos.forEach(video => {
  const timeDiff = Math.abs(video.currentTime - targetTime);

  if (isDragging) {
    // During drag: seek every N frames
    seekFrameCounterRef.current++;
    if (seekFrameCounterRef.current >= SEEK_THROTTLE_FRAMES && timeDiff > 0.2) {
      video.currentTime = targetTime;
      seekFrameCounterRef.current = 0;
    }
  } else {
    // When not dragging: seek normally
    if (timeDiff > 0.1) {
      video.currentTime = targetTime;
    }
  }
});
```

#### Files to Modify
- [useCanvasRendering.ts](../src/hooks/useCanvasRendering.ts)
- [timelineStore.ts](../src/store/timelineStore.ts)
- [Playhead.tsx](../src/components/Timeline/Playhead.tsx)

#### Success Criteria
- Video seeks every 3-5 frames during drag (not every frame)
- Smoother scrubbing experience
- Video decoder has time to catch up
- Immediate seeking when drag stops

---

### Solution 5: Dynamic Quality Mode (Advanced Optimization)
**Priority:** P2 - Medium
**Expected Impact:** Additional 50% performance during scrubbing
**Complexity:** Medium

#### Implementation Strategy

**Step 1: Create quality modes**
```typescript
enum RenderQuality {
  ULTRA = 4,    // 8K - for export preview
  HIGH = 2,     // 4K - normal editing
  MEDIUM = 1.5, // 2.7K - smooth playback
  LOW = 1       // 1080p - scrubbing
}
```

**Step 2: Dynamic quality switching**
```typescript
const getCurrentQuality = () => {
  if (isDragging) return RenderQuality.LOW;
  if (isPlaying) return RenderQuality.MEDIUM;
  return RenderQuality.HIGH; // Idle/paused
};

const render = () => {
  const quality = getCurrentQuality();
  // Adjust rendering based on quality...
};
```

**Step 3: Quality-based optimizations**
```typescript
if (quality === RenderQuality.LOW) {
  // Skip expensive operations during scrub
  - Disable step-down scaling
  - Skip grid rendering
  - Disable selection handles
  - Simple bilinear scaling
}
```

#### Files to Modify
- [useCanvasRendering.ts](../src/hooks/useCanvasRendering.ts)
- [CompositeCanvas.tsx](../src/components/Preview/CompositeCanvas.tsx)

#### Success Criteria
- Lower quality (1080p) during scrubbing
- High quality (4K) when paused/idle
- Seamless quality transitions
- User barely notices quality reduction during drag

---

## Implementation Plan

### Phase 1: Critical Fixes (Immediate - Day 1)
**Goal:** Fix the most severe performance issues

1. **Solution 3: Reduce RENDER_SCALE** (5 minutes)
   - Change `RENDER_SCALE = 4` → `RENDER_SCALE = 2`
   - Test visual quality
   - Measure GPU impact

2. **Solution 2: Decouple playhead** (30 minutes)
   - Convert playheadPosition to ref
   - Remove from useEffect dependencies
   - Test scrubbing smoothness

3. **Solution 1: Conditional rendering** (1 hour)
   - Add render state tracking
   - Implement conditional RAF loop
   - Add render triggers
   - Test idle GPU usage

**Expected Result:** 80-90% performance improvement

---

### Phase 2: Scrubbing Optimization (Day 2)
**Goal:** Make playhead dragging buttery smooth

4. **Solution 4: Throttle video seeking** (1 hour)
   - Add isDragging to store
   - Implement seek throttling
   - Test video sync during drag
   - Tune throttle parameters

**Expected Result:** Smooth, responsive scrubbing

---

### Phase 3: Advanced Polish (Day 3-4)
**Goal:** Professional-grade performance

5. **Solution 5: Dynamic quality mode** (2-3 hours)
   - Implement quality enum
   - Add quality switching logic
   - Quality-based rendering optimizations
   - Add subtle UI feedback (optional)

6. **Additional optimizations:**
   - Frame caching for static scenes
   - Conditional grid rendering
   - Debounced property updates

**Expected Result:** Production-ready performance

---

## Testing & Validation

### Performance Metrics to Track

#### Before Optimization
- **Idle GPU usage:** ~90-100%
- **Scrubbing lag:** High (stutter/freeze)
- **Render calls per second:** 60 (always)
- **Pixels per frame:** 33.2M
- **useEffect triggers during drag:** 60-120/second

#### Target After Phase 1
- **Idle GPU usage:** <5%
- **Scrubbing lag:** Low (smooth)
- **Render calls per second:** 0 when idle, 30-60 when active
- **Pixels per frame:** 8.3M (4K)
- **useEffect triggers during drag:** 0

#### Target After Phase 2
- **Video seek frequency:** Every 3-5 frames (vs every frame)
- **Scrubbing FPS:** Consistent 30+ FPS
- **Video sync lag:** <0.3 seconds

#### Target After Phase 3
- **Dynamic quality switching:** <100ms transition
- **Scrubbing quality:** 1080p
- **Idle quality:** 4K

### Test Scenarios

1. **Idle Test**
   - Open app
   - Don't touch anything for 10 seconds
   - Check GPU usage (should be ~0%)

2. **Scrubbing Test**
   - Drag playhead rapidly back and forth
   - Verify smooth movement
   - Check for stuttering or freezing

3. **Playback Test**
   - Play timeline
   - Verify consistent FPS
   - Check video sync

4. **Multi-clip Test**
   - Add 5+ video clips
   - Test performance with complex timeline
   - Verify all optimizations still work

---

## Risk Assessment

### Low Risk
- **Solution 3 (RENDER_SCALE):** Simple constant change, easily reversible
- **Solution 4 (Seek throttle):** Isolated to video sync logic

### Medium Risk
- **Solution 1 (Conditional rendering):** Requires careful state management
  - **Mitigation:** Thorough testing of all render triggers

- **Solution 2 (Decouple playhead):** Changes core render dependency chain
  - **Mitigation:** Ensure ref updates correctly, test all playhead interactions

### Rollback Plan
- Keep original code in comments during development
- Git commit after each solution
- Easy to revert individual changes if issues arise

---

## Expected Performance Gains

### Summary Table
| Optimization | GPU Reduction | Smoothness Gain | Complexity |
|-------------|---------------|-----------------|------------|
| Conditional rendering | 90% (idle) | - | Medium |
| Decouple playhead | - | High | Medium |
| RENDER_SCALE 4→2 | 75% | High | Trivial |
| Throttle seeking | 30-40% | Very High | Medium |
| Dynamic quality | 50% (scrub) | Medium | Medium |

### Combined Impact
- **Idle:** 0-5% GPU (vs 100% current)
- **Scrubbing:** Smooth 30+ FPS (vs laggy current)
- **Overall:** 80-95% performance improvement

---

## Open Questions

### For Discussion

1. **RENDER_SCALE value:**
   - Option A: 2 (4K quality) - recommended
   - Option B: 1.5 (2.7K quality) - if need more performance
   - Option C: 3 (6K quality) - if 4K not sharp enough

2. **Seek throttle frequency:**
   - Every 3 frames (smoother drag, slight video lag)
   - Every 5 frames (very smooth drag, more video lag)

3. **Dynamic quality:**
   - Implement now or later?
   - Should user see quality mode indicator?

4. **Grid during scrubbing:**
   - Auto-disable during drag?
   - Keep always on?

---

## Success Criteria

### Must Have (Phase 1)
- ✅ GPU usage <10% when idle
- ✅ Smooth playhead scrubbing without lag
- ✅ No visible quality loss at 4K (RENDER_SCALE=2)
- ✅ No useEffect recreation during drag

### Should Have (Phase 2)
- ✅ Video stays in sync during scrubbing (<0.3s lag)
- ✅ Consistent 30+ FPS during all interactions

### Nice to Have (Phase 3)
- ✅ Dynamic quality modes
- ✅ Frame caching
- ✅ Professional-grade performance

---

## Next Steps

1. **Review this plan** - Confirm approach and priorities
2. **Answer open questions** - Make decisions on parameters
3. **Begin Phase 1** - Implement critical fixes
4. **Test & measure** - Validate improvements
5. **Iterate** - Tune parameters based on results

---

**Document Version:** 1.0
**Created:** 2025-10-28
**Status:** Ready for Implementation