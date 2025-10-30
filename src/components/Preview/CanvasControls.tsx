import { useState, useEffect } from 'react';
import { Grid, Monitor, X } from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';

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
  const { canvasWidth, canvasHeight, setCanvasDimensions } = useTimelineStore();
  const [showSizeDialog, setShowSizeDialog] = useState(false);
  const [tempWidth, setTempWidth] = useState(canvasWidth);
  const [tempHeight, setTempHeight] = useState(canvasHeight);

  // Sync temp values when dialog opens or store values change
  useEffect(() => {
    if (showSizeDialog) {
      setTempWidth(canvasWidth);
      setTempHeight(canvasHeight);
    }
  }, [showSizeDialog, canvasWidth, canvasHeight]);

  // Common resolutions
  const commonResolutions = [
    { name: '720p HD', width: 1280, height: 720 },
    { name: '1080p Full HD', width: 1920, height: 1080 },
    { name: '1440p 2K', width: 2560, height: 1440 },
    { name: '4K UHD', width: 3840, height: 2160 },
    { name: 'Square 1:1', width: 1080, height: 1080 },
    { name: 'Vertical 9:16', width: 1080, height: 1920 },
    { name: 'Vertical 16:9', width: 1920, height: 1080 },
  ];

  const handlePresetResolution = (width: number, height: number) => {
    setTempWidth(width);
    setTempHeight(height);
  };

  const handleApplySize = () => {
    setCanvasDimensions(tempWidth, tempHeight);
    setShowSizeDialog(false);
  };

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

      {/* Canvas size button */}
      <button
        onClick={() => setShowSizeDialog(true)}
        className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white"
        title="Change canvas size"
      >
        <Monitor size={20} />
      </button>
      </div>

      {/* Render Scale Control */}
      <div className="flex items-center gap-1.5 bg-gray-800 rounded px-2 py-1.5">
        <label className="text-white text-[10px] font-medium">Render Scale:</label>
        <input
          type="range"
          min="0.5"
          max="4"
          step="0.5"
          value={renderScale}
          onChange={(e) => setRenderScale(parseFloat(e.target.value))}
          className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          title="Control rendering quality (lower = better performance)"
        />
        <span className="text-white text-[10px] min-w-[1.75rem] text-center">
          {renderScale}x
        </span>
      </div>

      {/* Canvas Size Dialog */}
      {showSizeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSizeDialog(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Canvas Size</h3>
              <button
                onClick={() => setShowSizeDialog(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Common Resolutions</label>
              <div className="grid grid-cols-3 gap-2">
                {commonResolutions.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetResolution(preset.width, preset.height)}
                    className={`px-3 py-2 text-xs rounded ${
                      tempWidth === preset.width && tempHeight === preset.height
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {preset.name}
                    <div className="text-xs opacity-75">{preset.width}×{preset.height}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Width</label>
                <input
                  type="number"
                  min="128"
                  max="7680"
                  value={tempWidth}
                  onChange={(e) => setTempWidth(Math.max(128, Math.min(7680, parseInt(e.target.value) || 128)))}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Height</label>
                <input
                  type="number"
                  min="128"
                  max="4320"
                  value={tempHeight}
                  onChange={(e) => setTempHeight(Math.max(128, Math.min(4320, parseInt(e.target.value) || 128)))}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleApplySize}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium"
              >
                Apply
              </button>
              <button
                onClick={() => setShowSizeDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
