import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => Promise<void>;
}

export interface ExportSettings {
  outputPath: string;
  customWidth: number;
  customHeight: number;
}

type ResolutionPreset = {
  label: string;
  width: number;
  height: number;
};

export default function ExportDialog({ isOpen, onClose, onExport }: ExportDialogProps) {
  const [outputPath, setOutputPath] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const { canvasWidth, canvasHeight } = useTimelineStore();
  
  // Generate resolution presets based on canvas aspect ratio
  const resolutionPresets = useMemo(() => {
    const aspectRatio = canvasWidth / canvasHeight;
    
    // Base heights for different resolution levels (720p, 1080p, 2K, 4K)
    const baseHeights = [720, 1080, 1440, 2160];
    
    return baseHeights.map((height) => {
      const width = Math.round(height * aspectRatio);
      // Round to even numbers for better codec compatibility
      const roundedWidth = Math.round(width / 2) * 2;
      const roundedHeight = Math.round(height / 2) * 2;
      
      let label = '';
      if (height === 720) label = '720p';
      else if (height === 1080) label = '1080p';
      else if (height === 1440) label = '2K';
      else if (height === 2160) label = '4K';
      
      return {
        label,
        width: roundedWidth,
        height: roundedHeight,
      };
    });
  }, [canvasWidth, canvasHeight]);
  
  // Initialize selected resolution to 1080p equivalent (index 1)
  const [selectedResolution, setSelectedResolution] = useState<ResolutionPreset | null>(null);
  
  // Set default resolution when dialog opens or presets change
  useEffect(() => {
    if (resolutionPresets.length > 0) {
      // Default to 1080p equivalent if available, otherwise use the first preset
      const defaultIndex = resolutionPresets.length > 1 ? 1 : 0;
      if (!selectedResolution || selectedResolution.label !== resolutionPresets[defaultIndex].label) {
        setSelectedResolution(resolutionPresets[defaultIndex]);
      }
    }
  }, [resolutionPresets, isOpen]);

  // Listen for export progress updates
  useEffect(() => {
    if (!isOpen) return;

    const handleProgress = (progress: number) => {
      setExportProgress(progress);
    };

    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.on) {
      electronAPI.on('export:progress', handleProgress);
    }

    return () => {
      if (electronAPI && electronAPI.off) {
        electronAPI.off('export:progress', handleProgress);
      }
    };
  }, [isOpen]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsExporting(false);
      setExportProgress(0);
      setError(null);
      setIsComplete(false);
      setOutputPath('');
    }
  }, [isOpen]);

  const handleExport = async () => {
    if (!outputPath) {
      setError('Please select an output path');
      return;
    }
    
    if (!selectedResolution) {
      setError('Please select a resolution');
      return;
    }

    setIsExporting(true);
    setError(null);
    setExportProgress(0);

    try {
      await onExport({
        outputPath,
        customWidth: selectedResolution.width,
        customHeight: selectedResolution.height,
      });
      
      // Ensure we show 100% progress
      setExportProgress(100);
      setIsComplete(true);
      
      // Wait a moment to show completion
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Close dialog after successful export
      onClose();
    } catch (err: any) {
      console.error('Export failed:', err);
      setError(err.message || 'Export failed. Please try again.');
      setIsExporting(false);
    }
  };

  const handleBrowse = async () => {
    const path = await (window as any).electronAPI?.saveFile?.('my-video.mp4');
    if (path) {
      setOutputPath(path);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg shadow-2xl w-96 z-50 border border-gray-700">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            {isComplete ? 'Export Complete!' : isExporting ? 'Exporting...' : 'Export Settings'}
          </h3>
          {!isExporting && !isComplete && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isExporting ? (
          /* Export Progress View */
          <div>
            <div className="mb-4">
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, exportProgress))}%` }}
                />
              </div>
              <div className="text-center text-gray-400 text-xs mt-1">
                {Math.round(exportProgress)}%
              </div>
            </div>
            
            <div className="text-xs text-gray-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Export Size:</span>
                <span className="text-white">{selectedResolution ? `${selectedResolution.width}×${selectedResolution.height}` : 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Output:</span>
                <span className="text-white text-xs truncate max-w-xs" title={outputPath}>
                  {outputPath.split(/[\\/]/).pop()}
                </span>
              </div>
            </div>

            {error && (
              <div className="mt-3 p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                {error}
              </div>
            )}

            {isComplete && !error && (
              <div className="mt-3 p-2 bg-green-900/30 border border-green-700 rounded text-green-300 text-xs">
                ✓ Your video has been exported successfully!
              </div>
            )}
          </div>
        ) : (
          /* Export Settings View */
          <>
            {/* Resolution Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Resolution
              </label>
              <div className="grid grid-cols-2 gap-2">
                {resolutionPresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setSelectedResolution(preset)}
                    className={`px-3 py-2 rounded border transition-colors text-sm ${
                      selectedResolution?.label === preset.label
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-xs opacity-75">{preset.width} × {preset.height}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas Size Info */}
            <div className="mb-4 p-3 bg-gray-700/50 rounded border border-gray-600">
              <div className="text-sm text-gray-400 mb-1">Canvas Size</div>
              <div className="text-lg font-semibold text-white">
                {canvasWidth} × {canvasHeight}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {selectedResolution && `Content will be scaled to ${selectedResolution.width} × ${selectedResolution.height}`}
              </div>
            </div>

            {/* Output Path */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Save to
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={outputPath}
                  readOnly
                  placeholder="Select output path..."
                  className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-sm"
                />
                <button
                  onClick={handleBrowse}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded transition-colors text-sm whitespace-nowrap"
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-3 p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded transition-colors font-medium text-sm"
              >
                Export
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
