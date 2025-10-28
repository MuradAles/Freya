import React, { useState, useEffect } from 'react';
import { Settings, Volume2, Move, Maximize2, RotateCw } from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import type { TimelineClip } from '../../types/timeline';

export default function PropertiesPanel() {
  const { tracks, selectedClipIds, updateClip } = useTimelineStore();
  const [selectedClip, setSelectedClip] = useState<TimelineClip | null>(null);
  
  // Find the selected clip
  useEffect(() => {
    if (selectedClipIds.length > 0) {
      for (const track of tracks) {
        const clip = track.clips.find(c => c.id === selectedClipIds[0]);
        if (clip) {
          setSelectedClip(clip);
          return;
        }
      }
    }
    setSelectedClip(null);
  }, [selectedClipIds, tracks]);

  // Get clip properties or show "no selection"
  const hasPosition = selectedClip?.position !== undefined;
  
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
        {!selectedClip && (
          <div className="text-center text-gray-400 mt-8">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No selection</p>
            <p className="text-sm mt-2 text-gray-500">
              Select a clip to adjust properties
            </p>
          </div>
        )}

        {/* Properties for Selected Clip */}
        {selectedClip && hasPosition && (
          <div className="space-y-6">
            {/* Position Controls */}
            <div className="border-t border-gray-700 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Move className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-300">Position</h3>
              </div>
              <div className="bg-gray-700 rounded p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">X</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      max={1 - (selectedClip.position.width ?? 0.5)}
                      value={selectedClip.position.x ?? 0}
                      onChange={(e) => {
                        const newX = parseFloat(e.target.value);
                        updateClip(selectedClip.id, {
                          position: { ...selectedClip.position, x: Math.max(0, Math.min(1 - (selectedClip.position.width ?? 0.5), newX)) }
                        });
                      }}
                      className="w-full bg-gray-600 text-white px-2 py-1 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Y</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      max={1 - (selectedClip.position.height ?? 0.5)}
                      value={selectedClip.position.y ?? 0}
                      onChange={(e) => {
                        const newY = parseFloat(e.target.value);
                        updateClip(selectedClip.id, {
                          position: { ...selectedClip.position, y: Math.max(0, Math.min(1 - (selectedClip.position.height ?? 0.5), newY)) }
                        });
                      }}
                      className="w-full bg-gray-600 text-white px-2 py-1 rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Size Controls */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Maximize2 className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-300">Size</h3>
              </div>
              <div className="bg-gray-700 rounded p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Width</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0.05" 
                      max="1"
                      value={selectedClip.position.width ?? 0.5}
                      onChange={(e) => {
                        const newWidth = parseFloat(e.target.value);
                        const aspectRatio = (selectedClip.position.height ?? 0.5) / (selectedClip.position.width ?? 0.5);
                        updateClip(selectedClip.id, {
                          position: { 
                            ...selectedClip.position, 
                            width: newWidth,
                            height: newWidth * aspectRatio
                          }
                        });
                      }}
                      className="w-full bg-gray-600 text-white px-2 py-1 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Height</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0.05" 
                      max="1"
                      value={selectedClip.position.height ?? 0.5}
                      onChange={(e) => {
                        const newHeight = parseFloat(e.target.value);
                        const aspectRatio = (selectedClip.position.height ?? 0.5) / (selectedClip.position.width ?? 0.5);
                        updateClip(selectedClip.id, {
                          position: { 
                            ...selectedClip.position, 
                            height: newHeight,
                            width: newHeight / aspectRatio
                          }
                        });
                      }}
                      className="w-full bg-gray-600 text-white px-2 py-1 rounded text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input 
                    type="checkbox" 
                    id="lockAspect" 
                    defaultChecked
                    className="rounded"
                  />
                  <label htmlFor="lockAspect" className="text-xs text-gray-400">Lock aspect ratio</label>
                </div>
              </div>
            </div>

            {/* Rotation Controls */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <RotateCw className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-300">Rotation</h3>
              </div>
              <div className="bg-gray-700 rounded p-3 space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-2">
                    Angle: {(selectedClip.position.rotation ?? 0).toFixed(1)}°
                  </label>
                  <input 
                    type="range" 
                    min="-180" 
                    max="180" 
                    value={selectedClip.position.rotation ?? 0}
                    onChange={(e) => updateClip(selectedClip.id, {
                      position: { ...selectedClip.position, rotation: parseFloat(e.target.value) }
                    })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>-180°</span>
                    <span>0°</span>
                    <span>180°</span>
                  </div>
                </div>
                <button
                  onClick={() => updateClip(selectedClip.id, {
                    position: { ...selectedClip.position, rotation: 0 }
                  })}
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm transition"
                >
                  Reset Rotation
                </button>
              </div>
            </div>

            {/* Volume Control */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-300">Volume</h3>
              </div>
              <div className="bg-gray-700 rounded p-3 space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-2">
                    Volume: {((selectedClip.volume ?? 1) * 100).toFixed(0)}%
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={selectedClip.volume ?? 1}
                    onChange={(e) => updateClip(selectedClip.id, {
                      volume: parseFloat(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Preset Positions */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-gray-300">Preset Positions</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => updateClip(selectedClip.id, {
                    position: { ...selectedClip.position, x: 0, y: 0 }
                  })}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs transition"
                >
                  Top Left
                </button>
                <button
                  onClick={() => updateClip(selectedClip.id, {
                    position: { ...selectedClip.position, x: 0.5, y: 0 }
                  })}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs transition"
                >
                  Top
                </button>
                <button
                  onClick={() => updateClip(selectedClip.id, {
                    position: { ...selectedClip.position, x: 1, y: 0 }
                  })}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs transition"
                >
                  Top Right
                </button>
                <button
                  onClick={() => updateClip(selectedClip.id, {
                    position: { ...selectedClip.position, x: 0, y: 0.5 }
                  })}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs transition"
                >
                  Left
                </button>
                <button
                  onClick={() => updateClip(selectedClip.id, {
                    position: { ...selectedClip.position, x: 0.5 - (selectedClip.position.width ?? 0.5) / 2, y: 0.5 - (selectedClip.position.height ?? 0.5) / 2 }
                  })}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs transition"
                >
                  Center
                </button>
                <button
                  onClick={() => updateClip(selectedClip.id, {
                    position: { ...selectedClip.position, x: 1, y: 0.5 }
                  })}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs transition"
                >
                  Right
                </button>
                <button
                  onClick={() => updateClip(selectedClip.id, {
                    position: { ...selectedClip.position, x: 0, y: 1 }
                  })}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs transition"
                >
                  Bottom Left
                </button>
                <button
                  onClick={() => updateClip(selectedClip.id, {
                    position: { ...selectedClip.position, x: 0.5, y: 1 }
                  })}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs transition"
                >
                  Bottom
                </button>
                <button
                  onClick={() => updateClip(selectedClip.id, {
                    position: { ...selectedClip.position, x: 1, y: 1 }
                  })}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs transition"
                >
                  Bottom Right
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

