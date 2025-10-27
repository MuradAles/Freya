import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export default function PreviewCanvas() {
  return (
    <div className="w-full h-full bg-black flex flex-col relative">
      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Play className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Preview Canvas</p>
            <p className="text-gray-600 text-sm mt-2">Drag media here to preview</p>
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex items-center justify-center gap-4">
          {/* Previous Frame */}
          <button className="p-2 hover:bg-gray-700 rounded transition-colors">
            <SkipBack className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>

          {/* Play/Pause */}
          <button className="p-3 bg-purple-600 hover:bg-purple-700 rounded-full transition-colors">
            <Play className="w-6 h-6 text-white" />
          </button>

          {/* Next Frame */}
          <button className="p-2 hover:bg-gray-700 rounded transition-colors">
            <SkipForward className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Timecode Display */}
        <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-400">
          <span>00:00</span>
          <span>/</span>
          <span>00:00</span>
        </div>
      </div>
    </div>
  );
}

