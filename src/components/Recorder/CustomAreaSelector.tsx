import React, { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';

interface ScreenSource {
  id: string;
  name: string;
}

interface CustomAreaSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (area: { x: number; y: number; width: number; height: number; screenId: string }) => void;
}

export default function CustomAreaSelector({ isOpen, onClose, onConfirm }: CustomAreaSelectorProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentArea, setCurrentArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [screens, setScreens] = useState<ScreenSource[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState<string>('');
  const [showScreenSelection, setShowScreenSelection] = useState(true);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && screenStream) {
      videoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  useEffect(() => {
    if (isOpen) {
      // Load available screens
      loadScreens();
      // Reset state when opened
      setStartPoint(null);
      setEndPoint(null);
      setCurrentArea(null);
      setIsSelecting(false);
    } else {
      // Cleanup when closing
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }
      setShowScreenSelection(true);
    }
  }, [isOpen]);

  const loadScreens = async () => {
    try {
      if (window.electronAPI && window.electronAPI.getRecordingSources) {
        const sources = await window.electronAPI.getRecordingSources();
        const screenSources = sources.filter((s: ScreenSource) => s.id.includes('screen:'));
        setScreens(screenSources);
        if (screenSources.length > 0) {
          setSelectedScreenId(screenSources[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading screens:', error);
    }
  };

  const handleScreenSelect = async () => {
    if (selectedScreenId) {
      setShowScreenSelection(false);
      await startScreenPreview(selectedScreenId);
    }
  };

  const startScreenPreview = async (screenId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenId
          } as any
        }
      } as MediaStreamConstraints);

      setScreenStream(stream);
    } catch (error) {
      console.error('Error starting screen preview:', error);
      alert('Could not access screen. Please check permissions and try again.');
      handleClose();
    }
  };

  const handleClose = () => {
    // Stop screen stream
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    // Reset state
    setShowScreenSelection(true);
    setCurrentArea(null);
    setStartPoint(null);
    setEndPoint(null);
    onClose();
  };

  // Update area when points change
  useEffect(() => {
    if (startPoint && endPoint) {
      const x = Math.min(startPoint.x, endPoint.x);
      const y = Math.min(startPoint.y, endPoint.y);
      const width = Math.abs(endPoint.x - startPoint.x);
      const height = Math.abs(endPoint.y - startPoint.y);
      setCurrentArea({ x, y, width, height });
    }
  }, [startPoint, endPoint]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSelecting(true);
    setStartPoint({ x: e.clientX, y: e.clientY });
    setEndPoint({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !startPoint) return;
    setEndPoint({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    if (isSelecting) {
      setIsSelecting(false);
    }
  };

  const handleConfirm = () => {
    if (currentArea && currentArea.width > 20 && currentArea.height > 20 && selectedScreenId) {
      onConfirm({
        ...currentArea,
        screenId: selectedScreenId
      });
    } else {
      alert('Please select a larger area (minimum 20x20 pixels)');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter' && currentArea) {
      handleConfirm();
    }
  };

  if (!isOpen) return null;

  // Show screen selection first
  if (showScreenSelection) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
        <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
          <h2 className="text-2xl font-bold text-white mb-4">Select Screen</h2>
          <p className="text-gray-400 mb-6">Choose which screen to record from</p>
          
          <div className="space-y-3 mb-6">
            {screens.map((screen) => (
              <label
                key={screen.id}
                className="flex items-center gap-3 p-4 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600"
              >
                <input
                  type="radio"
                  name="screen"
                  value={screen.id}
                  checked={selectedScreenId === screen.id}
                  onChange={() => setSelectedScreenId(screen.id)}
                  className="w-5 h-5 text-purple-600"
                />
                <div className="flex-1">
                  <div className="text-white font-medium">{screen.name}</div>
                  <div className="text-sm text-gray-400">{screen.id}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleScreenSelect}
              disabled={!selectedScreenId}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate selection bounds
  let selectionStyle: React.CSSProperties = {};
  if (currentArea) {
    selectionStyle = {
      position: 'absolute',
      left: `${currentArea.x}px`,
      top: `${currentArea.y}px`,
      width: `${currentArea.width}px`,
      height: `${currentArea.height}px`,
      border: '2px dashed #8B5CF6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      cursor: 'move',
    };
  }

  // Calculate info box position (bottom-right of selection)
  let infoStyle: React.CSSProperties = {};
  if (currentArea) {
    infoStyle = {
      position: 'absolute',
      left: `${currentArea.x + currentArea.width}px`,
      top: `${currentArea.y + currentArea.height}px`,
      transform: 'translate(-100%, 8px)',
    };
  }

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Full-screen video showing the actual screen content */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />

      {/* Semi-transparent overlay on top of video */}
      <div className="absolute inset-0 bg-gray-900/30" />

      {/* Instructions */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gray-900/95 rounded-lg px-8 py-4 z-50 border-2 border-purple-500 shadow-2xl">
        <p className="text-white font-bold text-lg mb-2">📐 Select Recording Area</p>
        <p className="text-gray-300">Click and drag on your screen to select the area you want to record</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-sm text-gray-400">
          <span>Press <kbd className="px-2 py-1 bg-gray-800 rounded">ESC</kbd> to cancel</span>
          <span>Press <kbd className="px-2 py-1 bg-gray-800 rounded">ENTER</kbd> to confirm</span>
        </div>
      </div>

      {/* Selection Rectangle */}
      {currentArea && (
        <>
          <div ref={selectionRef} style={selectionStyle}>
            {/* Corner handles for resizing */}
            <div
              className="absolute -top-1 -left-1 w-4 h-4 bg-purple-600 rounded-full border-2 border-white cursor-nwse-resize"
            />
            <div
              className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 rounded-full border-2 border-white cursor-nesw-resize"
            />
            <div
              className="absolute -bottom-1 -left-1 w-4 h-4 bg-purple-600 rounded-full border-2 border-white cursor-nesw-resize"
            />
            <div
              className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-600 rounded-full border-2 border-white cursor-nwse-resize"
            />
          </div>

          {/* Info Box with coordinates */}
          <div ref={infoStyle} className="bg-gray-800 rounded-lg p-3 border border-purple-500 z-50 shadow-lg">
            <div className="text-sm text-white space-y-1">
              <div className="font-semibold">Selection:</div>
              <div className="text-gray-300">
                Size: {currentArea.width} × {currentArea.height} px
              </div>
              <div className="text-gray-300">
                Position: ({currentArea.x}, {currentArea.y})
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3 z-50">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
            >
              <X className="w-5 h-5" />
              <span>Cancel</span>
            </button>
            <button
              onClick={handleConfirm}
              disabled={!currentArea || currentArea.width < 20 || currentArea.height < 20}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-5 h-5" />
              <span>Confirm Selection</span>
            </button>
          </div>
        </>
      )}

      {/* Overlay effect - darkens everything except selected area */}
      {currentArea && (
        <>
          {/* Top overlay */}
          <div
            className="absolute top-0 left-0 right-0 bg-black/40"
            style={{ height: `${currentArea.y}px` }}
          />
          {/* Bottom overlay */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-black/40"
            style={{ height: `${window.innerHeight - currentArea.y - currentArea.height}px` }}
          />
          {/* Left overlay */}
          <div
            className="absolute left-0 bg-black/40"
            style={{
              top: `${currentArea.y}px`,
              width: `${currentArea.x}px`,
              height: `${currentArea.height}px`,
            }}
          />
          {/* Right overlay */}
          <div
            className="absolute right-0 bg-black/40"
            style={{
              top: `${currentArea.y}px`,
              width: `${window.innerWidth - currentArea.x - currentArea.width}px`,
              height: `${currentArea.height}px`,
            }}
          />
        </>
      )}
    </div>
  );
}

