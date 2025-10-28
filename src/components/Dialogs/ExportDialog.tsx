import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => void;
}

export interface ExportSettings {
  resolution: '720p' | '1080p' | '4k' | 'source';
  outputPath: string;
}

const resolutionPresets = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
  'source': { width: 0, height: 0 }
};

export default function ExportDialog({ isOpen, onClose, onExport }: ExportDialogProps) {
  const [selectedResolution, setSelectedResolution] = useState<'720p' | '1080p' | '4k' | 'source'>('1080p');
  const [outputPath, setOutputPath] = useState('');

  if (!isOpen) return null;

  const handleExport = () => {
    if (!outputPath) {
      alert('Please select an output path');
      return;
    }

    onExport({
      resolution: selectedResolution,
      outputPath
    });

    // Reset and close
    setSelectedResolution('1080p');
    setOutputPath('');
    onClose();
  };

  const handleBrowse = async () => {
    // Use IPC to show save dialog
    const path = await (window as any).electronAPI?.saveFile?.('my-video.mp4');
    if (path) {
      setOutputPath(path);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-md p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Export Video</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Resolution Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Resolution
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="resolution"
                value="720p"
                checked={selectedResolution === '720p'}
                onChange={(e) => setSelectedResolution(e.target.value as any)}
                className="text-purple-600 focus:ring-purple-500"
              />
              <span className="text-white">720p (1280x720)</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="resolution"
                value="1080p"
                checked={selectedResolution === '1080p'}
                onChange={(e) => setSelectedResolution(e.target.value as any)}
                className="text-purple-600 focus:ring-purple-500"
              />
              <span className="text-white">1080p (1920x1080) - Recommended</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="resolution"
                value="4k"
                checked={selectedResolution === '4k'}
                onChange={(e) => setSelectedResolution(e.target.value as any)}
                className="text-purple-600 focus:ring-purple-500"
              />
              <span className="text-white">4K (3840x2160)</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="resolution"
                value="source"
                checked={selectedResolution === 'source'}
                onChange={(e) => setSelectedResolution(e.target.value as any)}
                className="text-purple-600 focus:ring-purple-500"
              />
              <span className="text-white">Source Resolution</span>
            </label>
          </div>
        </div>

        {/* Output Path */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Save to
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={outputPath}
              readOnly
              placeholder="Select output path..."
              className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
            />
            <button
              onClick={handleBrowse}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Browse
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors font-medium"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

