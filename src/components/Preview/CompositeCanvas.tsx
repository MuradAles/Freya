import { useRef, useState, useEffect } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { useMediaStore } from '../../store/mediaStore';
import { useCanvasRendering } from '../../hooks/useCanvasRendering';
import { useCanvasInteractions } from '../../hooks/useCanvasInteractions';
import { CanvasControls } from './CanvasControls';

interface CompositeCanvasProps {
  playheadPosition: number;
  isPlaying: boolean;
}

// Key for localStorage
const RENDER_SCALE_STORAGE_KEY = 'freya-canvas-render-scale';

export default function CompositeCanvas({ playheadPosition, isPlaying }: CompositeCanvasProps) {
  const { tracks } = useTimelineStore();
  const { getMediaById } = useMediaStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // UI state
  const [showGrid, setShowGrid] = useState(true);
  const [canvasColor, setCanvasColor] = useState('#000000');
  
  // Load render scale from localStorage or default to 2
  const [renderScale, setRenderScale] = useState(() => {
    const saved = localStorage.getItem(RENDER_SCALE_STORAGE_KEY);
    return saved ? parseFloat(saved) : 2;
  });

  // Save render scale to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(RENDER_SCALE_STORAGE_KEY, renderScale.toString());
  }, [renderScale]);

  // Canvas dimensions (logical size - actual rendering will be at higher resolution)
  const CANVAS_WIDTH = 1920;
  const CANVAS_HEIGHT = 1080;

  // Get all clips at playhead - inline to avoid recreation issues
  const getClipsAtPlayhead = () => {
    const clips: Array<{ clip: any; media: any; trackOrder: number }> = [];

    tracks.forEach(track => {
      if (!track.visible) return;
      track.clips.forEach(clip => {
        if (playheadPosition >= clip.startTime && playheadPosition < clip.startTime + clip.duration) {
          const media = getMediaById(clip.assetId);
          if (media) {
            clips.push({ clip, media, trackOrder: track.order });
          }
        }
      });
    });

    // Sort by track order (lower = background, higher = foreground)
    return clips.sort((a, b) => a.trackOrder - b.trackOrder);
  };

  // Use rendering hook
  useCanvasRendering({
    canvasRef,
          playheadPosition,
          isPlaying,
    showGrid,
    canvasColor,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    RENDER_SCALE: renderScale,
  });

  // Use interactions hook
  const {
    wrapperRef,
    canvasZoom,
    canvasPan,
    setCanvasZoom,
    setCanvasPan,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  } = useCanvasInteractions({
    canvasRef,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    playheadPosition,
    getClipsAtPlayhead,
  });

  return (
    <div className="relative w-full h-full">
      {/* Controls */}
      <CanvasControls
        canvasZoom={canvasZoom}
        setCanvasZoom={setCanvasZoom}
        canvasPan={canvasPan}
        setCanvasPan={setCanvasPan}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        canvasColor={canvasColor}
        setCanvasColor={setCanvasColor}
        renderScale={renderScale}
        setRenderScale={setRenderScale}
      />

      {/* Zoom hint */}
      <div className="absolute bottom-2 left-2 z-10 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-75">
        Ctrl/Cmd + Scroll to zoom • Middle-click + drag to pan
      </div>

      <div 
        ref={wrapperRef}
        className="w-full h-full overflow-hidden"
        style={{
          transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
          transformOrigin: 'center center',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH * renderScale}
          height={CANVAS_HEIGHT * renderScale}
          className="w-full h-full object-contain"
          style={{
            backgroundColor: canvasColor,
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    </div>
  );
}