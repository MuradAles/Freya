import { Grid } from 'lucide-react';

interface CanvasControlsProps {
  canvasZoom: number;
  setCanvasZoom: (zoom: number | ((prev: number) => number)) => void;
  canvasPan: { x: number; y: number };
  setCanvasPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  canvasColor: string;
  setCanvasColor: (color: string) => void;
  renderScale: number;
  setRenderScale: (scale: number) => void;
}

export const CanvasControls = ({
  canvasZoom,
  setCanvasZoom,
  setCanvasPan,
  showGrid,
  setShowGrid,
  canvasColor,
  setCanvasColor,
  renderScale,
  setRenderScale,
}: CanvasControlsProps) => {
  return (
    <div className="absolute top-2 left-2 z-10 flex flex-col gap-2">
      <div className="flex gap-2">
        {/* Zoom controls */}
      <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1">
        <button
          onClick={() => {
            setCanvasZoom(prev => Math.max(0.25, prev - 0.25));
          }}
          className="p-1 text-white hover:bg-gray-700 rounded"
          title="Zoom Out"
        >
          −
        </button>
        <span className="text-white text-sm min-w-[3rem] text-center">{(canvasZoom * 100).toFixed(0)}%</span>
        <button
          onClick={() => {
            setCanvasZoom(prev => Math.min(4, prev + 0.25));
          }}
          className="p-1 text-white hover:bg-gray-700 rounded"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => {
            setCanvasZoom(1);
            setCanvasPan({ x: 0, y: 0 });
          }}
          className="p-1 text-white hover:bg-gray-700 rounded ml-1"
          title="Reset Zoom/Pan"
        >
          ⟳
        </button>
      </div>

      {/* Grid toggle */}
      <button
        onClick={() => setShowGrid(!showGrid)}
        className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white"
        title={showGrid ? 'Hide Grid' : 'Show Grid'}
      >
        <Grid size={20} />
      </button>

      {/* Canvas color picker */}
      <input
        type="color"
        value={canvasColor}
        onChange={(e) => setCanvasColor(e.target.value)}
        className="w-10 h-10 bg-gray-800 rounded cursor-pointer"
        title="Change canvas background color"
      />
      </div>

      {/* Render Scale Control */}
      <div className="flex items-center gap-2 bg-gray-800 rounded px-3 py-2">
        <label className="text-white text-xs font-medium">Render Scale:</label>
        <input
          type="range"
          min="0.5"
          max="4"
          step="0.5"
          value={renderScale}
          onChange={(e) => setRenderScale(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          title="Control rendering quality (lower = better performance)"
        />
        <span className="text-white text-sm min-w-[2rem] text-center">
          {renderScale}x
        </span>
      </div>
    </div>
  );
};
