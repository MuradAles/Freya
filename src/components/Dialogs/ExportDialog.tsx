import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => Promise<void>;
}

export interface ExportSettings {
  resolution: '720p' | '1080p' | '4k' | 'source';
  outputPath: string;
}

export default function ExportDialog({ isOpen, onClose, onExport }: ExportDialogProps) {
  const [selectedResolution, setSelectedResolution] = useState<'720p' | '1080p' | '4k' | 'source'>('1080p');
  const [outputPath, setOutputPath] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Listen for export progress updates
  useEffect(() => {
    if (!isOpen) return;

    const handleProgress = (progress: number) => {
      // console.log('📊 Progress update from main process:', progress);
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
      setSelectedResolution('1080p');
      setOutputPath('');
    }
  }, [isOpen]);

  const handleExport = async () => {
    if (!outputPath) {
      setError('Please select an output path');
      return;
    }

    setIsExporting(true);
    setError(null);
    setExportProgress(0);

    try {
      await onExport({
        resolution: selectedResolution,
        outputPath
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
                <span>Resolution:</span>
                <span className="text-white">{selectedResolution.toUpperCase()}</span>
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
              <div className="space-y-1.5">
                <label className="flex items-center space-x-2 cursor-pointer py-1 hover:bg-gray-700/50 rounded px-2 -mx-2">
                  <input
                    type="radio"
                    name="resolution"
                    value="720p"
                    checked={selectedResolution === '720p'}
                    onChange={(e) => setSelectedResolution(e.target.value as any)}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-white">720p (1280x720)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer py-1 hover:bg-gray-700/50 rounded px-2 -mx-2">
                  <input
                    type="radio"
                    name="resolution"
                    value="1080p"
                    checked={selectedResolution === '1080p'}
                    onChange={(e) => setSelectedResolution(e.target.value as any)}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-white">1080p (1920x1080) - Recommended</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer py-1 hover:bg-gray-700/50 rounded px-2 -mx-2">
                  <input
                    type="radio"
                    name="resolution"
                    value="4k"
                    checked={selectedResolution === '4k'}
                    onChange={(e) => setSelectedResolution(e.target.value as any)}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-white">4K (3840x2160)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer py-1 hover:bg-gray-700/50 rounded px-2 -mx-2">
                  <input
                    type="radio"
                    name="resolution"
                    value="source"
                    checked={selectedResolution === 'source'}
                    onChange={(e) => setSelectedResolution(e.target.value as any)}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-white">Source Resolution</span>
                </label>
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
