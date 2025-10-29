import React, { useState, useEffect } from 'react';
import { Settings, Volume2, Move, Maximize2, RotateCw, Scissors } from 'lucide-react';
import { useTimelineStore } from '../../store/timelineStore';
import { useMediaStore } from '../../store/mediaStore';
import type { TimelineClip } from '../../types/timeline';

// Helper function to format seconds to MM:SS
function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
  
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to parse MM:SS or HH:MM:SS to seconds
function parseTimeString(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  
  if (parts.length === 2) {
    // MM:SS format
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  
  return 0;
}

export default function PropertiesPanel() {
  const { tracks, selectedClipIds, updateClip } = useTimelineStore();
  const getMediaById = useMediaStore((state) => state.getMediaById);
  const [selectedClip, setSelectedClip] = useState<TimelineClip | null>(null);
  const [sourceAsset, setSourceAsset] = useState<any>(null);
  
  // Local input state for MM:SS format
  const [trimStartInput, setTrimStartInput] = useState('');
  const [durationInput, setDurationInput] = useState('');
  const [timelineStartInput, setTimelineStartInput] = useState('');
  
  // Find the selected clip
  useEffect(() => {
    if (selectedClipIds.length > 0) {
      for (const track of tracks) {
        const clip = track.clips.find(c => c.id === selectedClipIds[0]);
        if (clip) {
          setSelectedClip(clip);
          // Fetch the source media asset
          const asset = getMediaById(clip.assetId);
          setSourceAsset(asset);
          // Sync input states with MM:SS format
          setTrimStartInput(formatTime(clip.trimStart ?? 0));
          setDurationInput(formatTime(clip.duration));
          setTimelineStartInput(formatTime(clip.startTime));
          return;
        }
      }
    }
    setSelectedClip(null);
    setSourceAsset(null);
    setTrimStartInput('');
    setDurationInput('');
    setTimelineStartInput('');
  }, [selectedClipIds, tracks, getMediaById]);

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

        {/* Trimming Information - Show for all clips */}
        {selectedClip && sourceAsset && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Scissors className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-300">Timing</h3>
            </div>
            <div className="bg-gray-700 rounded p-3 space-y-2">
              {/* Source Duration */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Source Duration</span>
                <span className="text-xs font-mono text-white">{formatTime(sourceAsset.duration)}</span>
              </div>
              
              {/* Source Trim Range - Editable */}
              <div className="pt-2 border-t border-gray-600 space-y-2">
                <div className="text-xs text-gray-400 mb-1">Source Range</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Start Time</label>
                    <input 
                      type="text" 
                      placeholder="MM:SS"
                      value={trimStartInput}
                      onChange={(e) => {
                        setTrimStartInput(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          const currentSeconds = selectedClip.trimStart ?? 0;
                          const step = e.shiftKey ? 10 : 1; // Shift = 10s, normal = 1s
                          const newSeconds = e.key === 'ArrowUp' 
                            ? Math.min(sourceAsset.duration - 1, currentSeconds + step)
                            : Math.max(0, currentSeconds - step);
                          
                          setTrimStartInput(formatTime(newSeconds));
                          updateClip(selectedClip.id, {
                            trimStart: newSeconds,
                            duration: selectedClip.duration
                          });
                        }
                      }}
                      onBlur={(e) => {
                        const seconds = parseTimeString(e.target.value);
                        if (seconds >= 0 && seconds <= sourceAsset.duration) {
                          const newTrimStart = seconds;
                          const maxEndTime = sourceAsset.duration;
                          const currentEndTime = (selectedClip.trimStart ?? 0) + selectedClip.duration;
                          
                          // Calculate new duration, ensuring we don't exceed source
                          const newDuration = Math.min(selectedClip.duration, maxEndTime - newTrimStart);
                          
                          if (newDuration > 0 && newTrimStart < sourceAsset.duration) {
                            updateClip(selectedClip.id, {
                              trimStart: newTrimStart,
                              duration: newDuration
                            });
                          } else {
                            // Revert to original if invalid
                            setTrimStartInput(formatTime(selectedClip.trimStart ?? 0));
                          }
                        } else {
                          // Revert to original if invalid
                          setTrimStartInput(formatTime(selectedClip.trimStart ?? 0));
                        }
                      }}
                      className="w-full bg-gray-600 text-white px-2 py-1 rounded text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Duration</label>
                    <input 
                      type="text" 
                      placeholder="MM:SS"
                      value={durationInput}
                      onChange={(e) => {
                        setDurationInput(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          const currentSeconds = selectedClip.duration;
                          const step = e.shiftKey ? 10 : 1; // Shift = 10s, normal = 1s
                          const maxDuration = sourceAsset.duration - (selectedClip.trimStart ?? 0);
                          
                          const newSeconds = e.key === 'ArrowUp'
                            ? Math.min(maxDuration, currentSeconds + step)
                            : Math.max(1, currentSeconds - step);
                          
                          setDurationInput(formatTime(newSeconds));
                          updateClip(selectedClip.id, {
                            duration: newSeconds
                          });
                        }
                      }}
                      onBlur={(e) => {
                        const seconds = parseTimeString(e.target.value);
                        const maxDuration = sourceAsset.duration - (selectedClip.trimStart ?? 0);
                        
                        if (seconds > 0 && seconds <= maxDuration) {
                          const newDuration = Math.min(maxDuration, seconds);
                          updateClip(selectedClip.id, {
                            duration: newDuration
                          });
                        } else {
                          // Revert to original if invalid
                          setDurationInput(formatTime(selectedClip.duration));
                        }
                      }}
                      className="w-full bg-gray-600 text-white px-2 py-1 rounded text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
              
              {/* Trimmed Amount */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Source Trimmed</span>
                <span className="text-xs font-mono text-gray-300">
                  {formatTime((selectedClip.trimStart ?? 0))} from start, {formatTime(Math.max(0, sourceAsset.duration - ((selectedClip.trimStart ?? 0) + selectedClip.duration)))} from end
                </span>
              </div>
              
              {/* Timeline Position - Editable */}
              <div className="pt-2 border-t border-gray-600 space-y-2">
                <div className="text-xs text-gray-400 mb-1">Timeline Position</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Start Position</label>
                    <input 
                      type="text" 
                      placeholder="MM:SS"
                      value={timelineStartInput}
                      onChange={(e) => {
                        setTimelineStartInput(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          const currentSeconds = selectedClip.startTime;
                          const step = e.shiftKey ? 10 : 1; // Shift = 10s, normal = 1s
                          const newSeconds = e.key === 'ArrowUp' 
                            ? currentSeconds + step
                            : Math.max(0, currentSeconds - step);
                          
                          setTimelineStartInput(formatTime(newSeconds));
                          updateClip(selectedClip.id, {
                            startTime: newSeconds
                          });
                        }
                      }}
                      onBlur={(e) => {
                        const newStartTime = parseTimeString(e.target.value);
                        if (newStartTime >= 0) {
                          updateClip(selectedClip.id, {
                            startTime: newStartTime
                          });
                        } else {
                          // Revert to original if invalid
                          setTimelineStartInput(formatTime(selectedClip.startTime));
                        }
                      }}
                      className="w-full bg-gray-600 text-white px-2 py-1 rounded text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">End Position</label>
                    <div className="w-full bg-gray-700 text-gray-400 px-2 py-1 rounded text-sm font-mono flex items-center">
                      {formatTime(selectedClip.startTime + selectedClip.duration)}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Clip Duration */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Clip Duration</span>
                <span className="text-xs font-mono text-white">{formatTime(selectedClip.duration)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Properties for Selected Clip */}
        {selectedClip && (
          <div className="space-y-6">
            {/* Speed Control */}
            {selectedClip.speed !== undefined && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-gray-300">Speed</span>
                </div>
                <div className="bg-gray-700 rounded p-3 space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-2">
                      Speed: {((selectedClip.speed ?? 1) * 100).toFixed(0)}%
                    </label>
                    <input 
                      type="range" 
                      min="0.25" 
                      max="4" 
                      step="0.05"
                      value={selectedClip.speed ?? 1}
                      onChange={(e) => updateClip(selectedClip.id, {
                        speed: parseFloat(e.target.value)
                      })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Position Controls - Only show for clips with position */}
            {hasPosition && (
              <>
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

