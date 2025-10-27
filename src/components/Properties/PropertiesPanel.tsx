import React from 'react';
import { Settings, Gauge, Volume2, AlignVerticalSpaceBetween } from 'lucide-react';

export default function PropertiesPanel() {
  return (
    <div className="w-full h-full bg-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Properties</h2>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {/* No Selection State */}
        <div className="text-center text-gray-400 mt-8">
          <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No selection</p>
          <p className="text-sm mt-2 text-gray-500">
            Select a clip to adjust properties
          </p>
        </div>

        {/* Properties Sections (Placeholders for when clip selected) */}
        <div className="hidden space-y-6">
          {/* Speed Control */}
          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-300">Speed</h3>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <p className="text-xs text-gray-400">Speed control will go here</p>
            </div>
          </div>

          {/* Volume Control */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-300">Volume</h3>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <p className="text-xs text-gray-400">Volume control will go here</p>
            </div>
          </div>

          {/* Fade Controls */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlignVerticalSpaceBetween className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-300">Fade</h3>
            </div>
            <div className="bg-gray-700 rounded p-3 space-y-2">
              <div>
                <label className="text-xs text-gray-400">Fade In</label>
                <p className="text-xs text-gray-500 mt-1">Fade in control will go here</p>
              </div>
              <div>
                <label className="text-xs text-gray-400">Fade Out</label>
                <p className="text-xs text-gray-500 mt-1">Fade out control will go here</p>
              </div>
            </div>
          </div>

          {/* Position Controls */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-300">Position</span>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <p className="text-xs text-gray-400">Position controls will go here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

