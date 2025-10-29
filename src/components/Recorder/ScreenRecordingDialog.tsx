import React, { useState, useRef, useEffect } from 'react';
import { X, Monitor } from 'lucide-react';
import CustomAreaSelector from './CustomAreaSelector';

interface ScreenRecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: {
    screenType: 'full' | 'window' | 'custom';
    windowId?: string;
    customArea?: { x: number; y: number; width: number; height: number; screenId: string };
    includeMicrophone: boolean;
    microphoneId?: string;
  }) => void;
}

export default function ScreenRecordingDialog({ isOpen, onClose, onStart }: ScreenRecordingDialogProps) {
  const [screenType, setScreenType] = useState<'full' | 'window' | 'custom'>('full');
  const [selectedWindowId, setSelectedWindowId] = useState<string>('');
  const [windows, setWindows] = useState<Array<{ id: string; name: string; thumbnail: string }>>([]);
  const [includeMicrophone, setIncludeMicrophone] = useState(false);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('');
  const [microphones, setMicrophones] = useState<Array<{ id: string; label: string }>>([]);
  const [showCustomAreaSelector, setShowCustomAreaSelector] = useState(false);
  const [customArea, setCustomArea] = useState<{ x: number; y: number; width: number; height: number; screenId: string } | null>(null);
  
  // Live preview
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Load available windows and microphones when dialog opens
  React.useEffect(() => {
    if (isOpen && screenType === 'window') {
      loadWindows();
    }
    if (isOpen && includeMicrophone) {
      loadMicrophones();
    }
  }, [isOpen, screenType, includeMicrophone]);

  // Start live preview when screen type changes
  useEffect(() => {
    if (!isOpen) return;

    let stream: MediaStream | null = null;

    const startPreview = async () => {
      try {
        setIsLoadingPreview(true);

        if (screenType === 'full') {
          // Start full screen preview using getDisplayMedia
          console.log('🎥 Starting full screen preview...');
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'screen' } as any,
            audio: false
          });
        } else if (screenType === 'window' && selectedWindowId) {
          // Start window preview using getUserMedia with Electron constraints
          console.log('🎥 Starting window preview for:', selectedWindowId);
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              // @ts-ignore
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: selectedWindowId
              }
            } as any
          });
        }

        if (stream) {
          console.log('✅ Preview stream started');
          setPreviewStream(stream);
        }
      } catch (err) {
        console.error('❌ Error starting preview:', err);
        setPreviewStream(null);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    // Only start preview for full screen or when window is selected
    if (screenType === 'full' || (screenType === 'window' && selectedWindowId)) {
      startPreview();
    }

    // Cleanup on unmount or when screen type changes
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        console.log('🛑 Cleaned up preview stream');
      }
      setPreviewStream(null);
    };
  }, [isOpen, screenType, selectedWindowId]);

  // Update video element with preview stream
  useEffect(() => {
    const video = previewVideoRef.current;
    if (video && previewStream) {
      video.srcObject = previewStream;
      video.play().catch(err => console.error('Error playing preview:', err));
    }
  }, [previewStream]);

  const loadWindows = async () => {
    try {
      if (window.electronAPI && window.electronAPI.getRecordingSources) {
        const sources = await window.electronAPI.getRecordingSources();
        const windowSources = sources.filter((s: any) => s.id.includes('window'));
        setWindows(windowSources);
        if (windowSources.length > 0) {
          setSelectedWindowId(windowSources[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading windows:', error);
    }
  };

  const loadMicrophones = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setMicrophones(audioInputs.map(device => ({
        id: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`
      })));
      if (audioInputs.length > 0) {
        setSelectedMicrophoneId(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Error loading microphones:', error);
    }
  };

  const handleScreenTypeChange = (type: 'full' | 'window' | 'custom') => {
    setScreenType(type);
    if (type === 'window' && windows.length === 0) {
      loadWindows();
    }
    if (type !== 'custom') {
      setCustomArea(null);
    }
    
    // Stop preview when switching to custom (since it requires area selection)
    if (type === 'custom' && previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
  };

  const handleClose = () => {
    // Clean up preview stream when closing
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
    onClose();
  };

  const handleAreaSelect = (area: { x: number; y: number; width: number; height: number; screenId: string }) => {
    setCustomArea(area);
    setShowCustomAreaSelector(false);
  };

  const handleOpenAreaSelector = () => {
    setShowCustomAreaSelector(true);
  };

  const handleStart = () => {
    if (screenType === 'window' && !selectedWindowId) {
      alert('Please select a window');
      return;
    }
    if (screenType === 'custom' && !customArea) {
      alert('Please select a custom area');
      return;
    }
    if (includeMicrophone && !selectedMicrophoneId) {
      alert('Please select a microphone');
      return;
    }

    onStart({
      screenType,
      windowId: screenType === 'window' ? selectedWindowId : undefined,
      customArea: screenType === 'custom' ? customArea! : undefined,
      includeMicrophone,
      microphoneId: includeMicrophone ? selectedMicrophoneId : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Screen Recording Setup</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Screen Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">Select Screen Source:</label>
            
            <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
              <input
                type="radio"
                name="screenType"
                value="full"
                checked={screenType === 'full'}
                onChange={() => handleScreenTypeChange('full')}
                className="w-5 h-5 text-purple-600"
              />
              <span className="text-white">Full Screen</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
              <input
                type="radio"
                name="screenType"
                value="window"
                checked={screenType === 'window'}
                onChange={() => handleScreenTypeChange('window')}
                className="w-5 h-5 text-purple-600"
              />
              <span className="text-white">Specific Window</span>
            </label>

            {/* Window Dropdown */}
            {screenType === 'window' && (
              <div className="ml-8">
                <select
                  value={selectedWindowId}
                  onChange={(e) => setSelectedWindowId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  {windows.map((window) => (
                    <option key={window.id} value={window.id}>
                      {window.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
              <input
                type="radio"
                name="screenType"
                value="custom"
                checked={screenType === 'custom'}
                onChange={() => handleScreenTypeChange('custom')}
                className="w-5 h-5 text-purple-600"
              />
              <span className="text-white">Custom Area (Click & Drag)</span>
            </label>

            {/* Custom Area Button */}
            {screenType === 'custom' && (
              <div className="ml-8 space-y-2">
                {!customArea ? (
                  <button
                    onClick={handleOpenAreaSelector}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                  >
                    Select Area
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleOpenAreaSelector}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                    >
                      Reselect Area
                    </button>
                    <div className="text-sm text-gray-300 space-y-1">
                      <p className="font-medium">Selected area:</p>
                      <p className="text-gray-400">{customArea.width}×{customArea.height}px</p>
                      <p className="text-gray-400">Position: ({customArea.x}, {customArea.y})</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>

            {/* Microphone Toggle */}
            <div className="mt-6">
          <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
            <input
              type="checkbox"
              checked={includeMicrophone}
              onChange={(e) => {
                setIncludeMicrophone(e.target.checked);
                if (e.target.checked && microphones.length === 0) {
                  loadMicrophones();
                }
              }}
              className="w-5 h-5 text-purple-600 rounded"
            />
            <span className="text-white">Include Microphone</span>
          </label>

          {/* Microphone Dropdown */}
          {includeMicrophone && (
            <div className="mt-3 ml-8">
              <select
                value={selectedMicrophoneId}
                onChange={(e) => setSelectedMicrophoneId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
              >
                {microphones.map((mic) => (
                  <option key={mic.id} value={mic.id}>
                    {mic.label}
                  </option>
                ))}
              </select>
            </div>
          )}
            </div>
          </div>

          {/* Right: Live Preview */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">Screen Preview:</label>
            <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video relative">
              {isLoadingPreview ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm">Loading preview...</p>
                  </div>
                </div>
              ) : previewStream ? (
                <video
                  ref={previewVideoRef}
                  className="w-full h-full object-contain"
                  playsInline
                  muted
                  autoPlay
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <Monitor className="w-16 h-16 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Screen preview will show here</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium transition-colors"
          >
            Start Recording
          </button>
        </div>
      </div>

      {/* Custom Area Selector Overlay */}
      <CustomAreaSelector
        isOpen={showCustomAreaSelector}
        onClose={() => setShowCustomAreaSelector(false)}
        onConfirm={handleAreaSelect}
      />
    </div>
  );
}

