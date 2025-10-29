import React from 'react';
import { useUIStore } from '../store/uiStore';
import { FileEdit, Video } from 'lucide-react';

export default function ModeSwitcher() {
  const { currentMode, setMode } = useUIStore();

  return (
    <div className="flex gap-2 px-4">
      <button
        onClick={() => setMode('editor')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
          currentMode === 'editor'
            ? 'bg-purple-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        <FileEdit className="w-4 h-4" />
        <span className="text-sm font-medium">Editor</span>
      </button>

      <button
        onClick={() => setMode('recorder')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
          currentMode === 'recorder'
            ? 'bg-purple-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        <Video className="w-4 h-4" />
        <span className="text-sm font-medium">Recorder</span>
      </button>
    </div>
  );
}

