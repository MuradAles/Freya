import React from 'react';
import { Film, Plus, Minus } from 'lucide-react';

export default function Timeline() {
  return (
    <div className="w-full h-full bg-gray-800 border-t border-gray-700 flex flex-col">
      {/* Timeline Header */}
      <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Timeline</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <button className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors">
            <Minus className="w-4 h-4" />
          </button>
          <div className="w-32 h-2 bg-gray-700 rounded-full"></div>
          <button className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors">
            <Plus className="w-4 h-4" />
          </button>
          {/* Export Button */}
          <button className="ml-3 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition-colors">
            Export
          </button>
        </div>
      </div>

      {/* Time Ruler */}
      <div className="px-4 py-2 border-b border-gray-700 bg-gray-750">
        <div className="flex gap-8 text-xs text-gray-400">
          <span>0s</span>
          <span>1:00</span>
          <span>2:00</span>
          <span>3:00</span>
          <span>4:00</span>
          <span>5:00</span>
        </div>
      </div>

      {/* Tracks Container */}
      <div className="flex-1 overflow-y-auto">
        {/* Track Placeholder */}
        <div className="border-b border-gray-700">
          <div className="px-4 py-2 flex items-center gap-2 bg-gray-750">
            <div className="w-16 text-xs text-gray-400">Track 1</div>
            <div className="flex-1 h-16 bg-gray-800"></div>
          </div>
        </div>
      </div>

      {/* Add Track Button */}
      <div className="px-4 py-3 border-t border-gray-700">
        <button className="w-full py-2 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" />
          <span>Add Track</span>
        </button>
      </div>
    </div>
  );
}

