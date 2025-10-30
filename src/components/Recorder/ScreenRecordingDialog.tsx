import React, { useState, useRef, useEffect } from 'react';
import { X, Monitor } from 'lucide-react';

interface ScreenRecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: {
    screenType: 'full' | 'window';
    windowId?: string;
    includeMicrophone: boolean;
    microphoneId?: string;
    includeSystemAudio: boolean;
    cameraId?: string; // NEW: Optional camera for screen recording
  }) => void;
}

export default function ScreenRecordingDialog({ isOpen, onClose, onStart }: ScreenRecordingDialogProps) {
  const [screenType, setScreenType] = useState<'full' | 'window'>('full');
  const [selectedWindowId, setSelectedWindowId] = useState<string>('');
  const [windows, setWindows] = useState<Array<{ id: string; name: string; thumbnail: string }>>([]);
  const [includeMicrophone, setIncludeMicrophone] = useState(true); // Default: ON
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true); // Default: ON
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('');
  const [microphones, setMicrophones] = useState<Array<{ id: string; label: string }>>([]);
  const [includeCamera, setIncludeCamera] = useState(false); // Camera overlay for screen recording
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  
  // Live preview
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Load available windows, microphones, and cameras when dialog opens
  React.useEffect(() => {
    if (isOpen && screenType === 'window') {
      loadWindows();
    }
    if (isOpen && includeMicrophone) {
      loadMicrophones();
    }
    if (isOpen && includeCamera) {
      loadCameras();
    }
  }, [isOpen, screenType, includeMicrophone, includeCamera]);

  // Start live preview when screen type changes
  useEffect(() => {
    if (!isOpen) return;

    let stream: MediaStream | null = null;

    const startPreview = async () => {
      try {
        setIsLoadingPreview(true);

        if (screenType === 'full') {
          // Skip preview_long for full screen - will use picker during actual recording
          // Showing preview would trigger the OS picker dialog which is annoying
          setPreviewStream(null);
          setIsLoadingPreview(false);
          return;
        } else if (screenType === 'window' && selectedWindowId) {
          // Start window preview using getUserMedia with Electron constraints
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              // @ts-ignore
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: selectedWindowId
              }
            } as any,
            audio: false
          });
        }

        if (stream) {
          setPreviewStream(stream);
        }
      } catch (err) {
        console.error('❌ Error starting preview:', err);
        setPreviewStream(null);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    // Only start preview for window (skip full screen to avoid picker dialog)
    if (screenType === 'window' && selectedWindowId) {
      startPreview();
    } else if (screenType === 'full') {
      // Clear preview for full screen mode
      setPreviewStream(null);
      setIsLoadingPreview(false);
    }

    // Cleanup on unmount or when screen type changes
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
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

  const loadCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoInputs.map(device => ({
        id: device.deviceId,
        label: device.label || `Camera ${videoInputs.indexOf(device) + 1}`
      })));
      if (videoInputs.length > 0) {
        setSelectedCameraId(videoInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Error loading cameras:', error);
    }
  };

  const handleScreenTypeChange = (type: 'full' | 'window') => {
    setScreenType(type);
    if (type === 'window' && windows.length === 0) {
      loadWindows();
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

  const handleStart = () => {
    if (screenType === 'window' && !selectedWindowId) {
      alert('Please select a window');
      return;
    }
    if (includeMicrophone && !selectedMicrophoneId) {
      alert('Please select a microphone');
      return;
    }
    if (includeCamera && !selectedCameraId) {
      alert('Please select a camera');
      return;
    }

    onStart({
      screenType,
      windowId: screenType === 'window' ? selectedWindowId : undefined,
      includeMicrophone,
      microphoneId: includeMicrophone ? selectedMicrophoneId : undefined,
      includeSystemAudio, // Pass system audio toggle
      cameraId: includeCamera ? selectedCameraId : undefined, // Pass camera ID if enabled
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
            </div>

            {/* Audio Controls */}
            <div className="mt-6 space-y-3">
              <div className="text-sm font-semibold text-gray-300 mb-2">Audio Sources:</div>

              {/* System Audio Toggle */}
              <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                <input
                  type="checkbox"
                  checked={includeSystemAudio}
                  onChange={(e) => setIncludeSystemAudio(e.target.checked)}
                  className="w-5 h-5 text-purple-600 rounded"
                />
                <div className="flex-1">
                  <span className="text-white block">System Audio (Media)</span>
                  <span className="text-xs text-gray-400">Music, YouTube, game sounds, etc.</span>
                </div>
              </label>

              {/* Microphone Toggle */}
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
                <div className="flex-1">
                  <span className="text-white block">Microphone</span>
                  <span className="text-xs text-gray-400">Your voice</span>
                </div>
              </label>

              {/* Microphone Dropdown */}
              {includeMicrophone && (
                <div className="ml-8">
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

              {/* Camera Overlay Toggle */}
              <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                <input
                  type="checkbox"
                  checked={includeCamera}
                  onChange={(e) => {
                    setIncludeCamera(e.target.checked);
                    if (e.target.checked && cameras.length === 0) {
                      loadCameras();
                    }
                  }}
                  className="w-5 h-5 text-purple-600 rounded"
                />
                <div className="flex-1">
                  <span className="text-white block">Camera Overlay</span>
                  <span className="text-xs text-gray-400">Show camera on screen recording (draggable during recording)</span>
                </div>
              </label>

              {/* Camera Dropdown */}
              {includeCamera && (
                <div className="ml-8">
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  >
                    {cameras.map((camera) => (
                      <option key={camera.id} value={camera.id}>
                        {camera.label}
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
                    <p className="text-sm">
                      {screenType === 'full'
                        ? 'Preview not available for full screen (you\'ll select screen when recording starts)'
                        : 'Select a window to see preview'}
                    </p>
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

    </div>
  );
}

