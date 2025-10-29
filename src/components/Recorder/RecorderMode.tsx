import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Monitor, Camera, Mic, Pause, Play, Maximize, PictureInPicture, Square } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useRecording, type RecordingConfig } from '../../hooks/useRecording';
import ScreenRecordingDialog from './ScreenRecordingDialog';
import CameraRecordingDialog from './CameraRecordingDialog';
import AudioRecordingDialog from './AudioRecordingDialog';
import RecordingCompleteDialog from './RecordingCompleteDialog';

interface RecorderModeProps {
  hidden?: boolean; // When hidden, only show recording overlay, not the main UI
}

export default function RecorderMode({ hidden = false }: RecorderModeProps) {
  const { isRecording: storeIsRecording } = useUIStore();
  const { 
    startRecording, 
    pauseRecording, 
    resumeRecording, 
    stopRecording, 
    toggleMicrophone,
    recordingDuration, 
    error, 
    recordingStream, 
    isPaused,
    cleanup 
  } = useRecording();
  
  const [screenDialogOpen, setScreenDialogOpen] = useState(false);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [audioDialogOpen, setAudioDialogOpen] = useState(false);
  const [localIsRecording, setLocalIsRecording] = useState(false);
  const [currentRecordingType, setCurrentRecordingType] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  // Microphone control
  const [micEnabled, setMicEnabled] = useState(true);
  
  // Countdown state
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Preview mode: 'fullscreen' | 'pip' | 'small'
  const [previewMode, setPreviewMode] = useState<'fullscreen' | 'pip' | 'small'>('fullscreen');
  
  // Draggable preview state
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [previewSize, setPreviewSize] = useState({ width: 320, height: 180 });
  
  // PIP state (also draggable and resizable)
  const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 });
  const [pipSize, setPipSize] = useState({ width: 400, height: 300 });
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStartState, setResizeStartState] = useState<{ position: { x: number, y: number }, size: { width: number, height: number } } | null>(null);
  
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRefPIP = useRef<HTMLVideoElement>(null);
  const previewVideoRefSmall = useRef<HTMLVideoElement>(null);
  const smallContainerRef = useRef<HTMLDivElement>(null);
  const pipContainerRef = useRef<HTMLDivElement>(null);

  const isRecording = storeIsRecording || localIsRecording;

  // Reset PIP position when switching to pip mode
  useEffect(() => {
    if (previewMode === 'pip' && isRecording) {
      // Reset PIP to bottom-right corner when entering pip mode
      setPipPosition({ 
        x: window.innerWidth - 420, 
        y: window.innerHeight - 340 
      });
      // Also reset size to default
      setPipSize({ width: 400, height: 300 });
    }
    // Clear any pending resize state when switching modes
    if (previewMode !== 'pip' && previewMode !== 'small') {
      setResizeStartState(null);
      setIsResizing(false);
      setIsDragging(false);
    }
  }, [previewMode, isRecording]);

  // Update ALL video elements with recording stream
  useEffect(() => {
    const videos = [
      previewVideoRef.current,
      previewVideoRefPIP.current,
      previewVideoRefSmall.current
    ].filter(Boolean);

    if (videos.length > 0 && recordingStream) {
      console.log('🎥 Setting up video previews for', videos.length, 'video elements');
      
      videos.forEach((video, index) => {
        if (video) {
          video.srcObject = recordingStream;
          const playPromise = video.play();
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => console.log(`✅ Video ${index} preview playing`))
              .catch(err => console.error(`❌ Video ${index} preview error:`, err));
          }
        }
      });

      // Log stream info once
      const videoTrack = recordingStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log('🎥 Track settings:', settings);
        console.log('📐 Track dimensions:', settings.width, 'x', settings.height);
      }
    }
  }, [recordingStream, localIsRecording, previewMode]);

  // Draggable preview handlers
  const handlePreviewMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    setIsDragging(true);
    
    if (previewMode === 'small') {
      setDragStart({ x: e.clientX - previewPosition.x, y: e.clientY - previewPosition.y });
    } else if (previewMode === 'pip') {
      setDragStart({ x: e.clientX - pipPosition.x, y: e.clientY - pipPosition.y });
    }
  };


  const handlePreviewMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      if (previewMode === 'small') {
        setPreviewPosition({ 
          x: e.clientX - dragStart.x, 
          y: e.clientY - dragStart.y 
        });
      } else if (previewMode === 'pip') {
        setPipPosition({ 
          x: e.clientX - dragStart.x, 
          y: e.clientY - dragStart.y 
        });
      }
    } else if (isResizing && resizeStartState) {
      if (previewMode === 'small') {
        const newWidth = Math.max(160, e.clientX - resizeStartState.position.x);
        const newHeight = Math.max(90, resizeStartState.position.y + resizeStartState.size.height - e.clientY);
        setPreviewSize({ width: newWidth, height: newHeight });
      } else if (previewMode === 'pip') {
        const newWidth = Math.max(200, e.clientX - resizeStartState.position.x);
        const newHeight = Math.max(150, e.clientY - resizeStartState.position.y);
        setPipSize({ width: newWidth, height: newHeight });
      }
    }
    e.preventDefault(); // Prevent text selection during drag/resize
  };

  const handlePreviewMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeStartState(null);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handlePreviewMouseMove);
      document.addEventListener('mouseup', handlePreviewMouseUp);
      return () => {
        document.removeEventListener('mousemove', handlePreviewMouseMove);
        document.removeEventListener('mouseup', handlePreviewMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, previewPosition, pipPosition, previewMode, resizeStartState, previewSize, pipSize]);

  const handleResizeStart = (e: React.MouseEvent, mode: 'pip' | 'small' = 'pip') => {
    e.preventDefault(); // Prevent text selection
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    
    // Capture the current position and size at resize start for the correct mode
    if (mode === 'pip') {
      setResizeStartState({ position: pipPosition, size: pipSize });
    } else {
      setResizeStartState({ position: previewPosition, size: previewSize });
    }
  };

  // Microphone toggle handler
  const handleMicToggle = () => {
    const newState = !micEnabled;
    setMicEnabled(newState);
    toggleMicrophone(newState);
  };

  // Countdown utility function
  const countdownAndExecute = async (callback: () => void | Promise<void>) => {
    return new Promise<void>((resolve) => {
      let count = 3;
      setCountdown(count);
      
      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          setCountdown(count);
        } else {
          clearInterval(interval);
          setCountdown(null);
          Promise.resolve(callback()).then(() => resolve());
        }
      }, 1000);
    });
  };

  // Pause/Resume handler
  const handlePauseResume = async () => {
    if (isPaused) {
      // Resume with countdown
      await countdownAndExecute(() => {
        resumeRecording();
      });
    } else {
      pauseRecording();
    }
  };

  const handleRecordScreen = () => {
    if (isRecording) {
      alert('Please stop current recording first');
      return;
    }
    setScreenDialogOpen(true);
  };

  const handleStartRecording = async (config: RecordingConfig) => {
    try {
      console.log('Starting screen recording with config:', config);
      setScreenDialogOpen(false); // Close dialog first

      // Initialize preview position to bottom-right  
      const initialX = Math.max(0, window.innerWidth - 420); // Ensure it's visible
      const initialY = Math.max(0, window.innerHeight - 240);
      setPreviewPosition({ x: initialX, y: initialY });
      
      // Start in fullscreen mode by default
      setPreviewMode('fullscreen');
      
      // Initialize PIP position to bottom-right
      setPipPosition({ 
        x: window.innerWidth - 420, 
        y: window.innerHeight - 340 
      });

      // Countdown before starting
      await countdownAndExecute(async () => {
        // Start recording FIRST before showing preview overlay
        await startRecording({
          screenType: config.screenType,
          windowId: config.windowId,
          customArea: config.customArea,
          includeMicrophone: config.includeMicrophone,
          microphoneId: config.microphoneId,
        });

        console.log('✅ Recording started, showing preview overlay');

        // Small delay before showing preview to let stream stabilize
        setTimeout(() => {
          setLocalIsRecording(true); // This triggers the preview
          setCurrentRecordingType('screen');
        }, 200);
      });
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert(err instanceof Error ? err.message : 'Failed to start recording');
      setLocalIsRecording(false);
    }
  };

  const handleStartCameraRecording = async (config: RecordingConfig) => {
    try {
      console.log('Starting camera recording with config:', config);
      setCameraDialogOpen(false); // Close dialog first so preview can show
      
      await countdownAndExecute(async () => {
        await startRecording({
          cameraId: config.cameraId,
          cameraPosition: config.cameraPosition,
          includeMicrophone: config.includeMicrophone,
          microphoneId: config.microphoneId,
        });
        
        setLocalIsRecording(true); // This triggers the preview
        setCurrentRecordingType('camera');
      });
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert(err instanceof Error ? err.message : 'Failed to start recording');
      setLocalIsRecording(false);
    }
  };

  const handleStartAudioRecording = async (config: RecordingConfig) => {
    try {
      console.log('Starting audio recording with config:', config);
      setAudioDialogOpen(false); // Close dialog first so preview can show
      
      await countdownAndExecute(async () => {
        await startRecording({
          microphoneId: config.microphoneId,
        });
        
        setLocalIsRecording(true); // This triggers the preview (audio won't show video but will show recorder UI)
        setCurrentRecordingType('audio');
      });
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert(err instanceof Error ? err.message : 'Failed to start recording');
      setLocalIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    try {
      const blob = await stopRecording();
      setRecordingBlob(blob);
      setLocalIsRecording(false);
      setCurrentRecordingType(null);
      setShowSaveDialog(true);
      console.log('Recording stopped, blob size:', blob.size);
    } catch (err) {
      console.error('Failed to stop recording:', err);
      alert('Failed to stop recording');
    }
  };

  const handleSaveRecording = async (filePath: string, addToLibrary: boolean) => {
    console.log('Saving recording to:', filePath, 'Add to library:', addToLibrary);
    // TODO: In Task 11, add to media library
    if (addToLibrary) {
      console.log('TODO: Add recording to media library');
    }
    cleanup(); // Clean up stream after saving
  };

  const handleDiscardRecording = () => {
    setRecordingBlob(null);
    setShowSaveDialog(false);
    cleanup(); // Clean up stream when discarding
  };

  // Clean up stream when save dialog closes
  const handleSaveDialogClose = () => {
    setShowSaveDialog(false);
    cleanup();
  };

  const handleRecordCamera = () => {
    if (isRecording) {
      alert('Please stop current recording first');
      return;
    }
    setCameraDialogOpen(true);
  };

  const handleRecordAudio = () => {
    if (isRecording) {
      alert('Please stop current recording first');
      return;
    }
    setAudioDialogOpen(true);
  };

  console.log('🔍 Recording state:', { localIsRecording, hasStream: !!recordingStream });

  // Render overlay as portal so it persists across mode switches
  const overlayContent = (localIsRecording || storeIsRecording) && recordingStream ? (
    <>
      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-black/80 z-[10001] flex items-center justify-center">
          <div className="text-white text-[200px] font-bold animate-pulse">
            {countdown}
          </div>
        </div>
      )}
      
      {/* Control Bar - Hidden when in pip mode */}
      {previewMode !== 'pip' && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 rounded-lg px-6 py-3 flex items-center gap-4 z-[9999] shadow-2xl ${
          isPaused ? 'bg-yellow-600' : 'bg-red-600'
        }`}>
          <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-300' : 'bg-white animate-pulse'}`} />
          <span className="text-white font-semibold">
            {isPaused ? 'Paused: ' : 'Recording: '}{Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
          </span>
          
          {/* Pause/Resume Button */}
          <button
            onClick={handlePauseResume}
            className="px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition-colors"
            title={isPaused ? 'Resume Recording' : 'Pause Recording'}
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>

          {/* Microphone Toggle */}
          <button
            onClick={handleMicToggle}
            className={`px-3 py-2 rounded transition-colors ${
              micEnabled 
                ? 'bg-white text-gray-800 hover:bg-gray-100' 
                : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
            }`}
            title={micEnabled ? 'Microphone On (Click to Mute)' : 'Microphone Off (Click to Unmute)'}
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* View Mode Toggle */}
          {previewMode !== 'fullscreen' && (
            <button
              onClick={() => setPreviewMode('fullscreen')}
              className="px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition-colors"
              title="Enter Fullscreen"
            >
              <Maximize className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => setPreviewMode('pip')}
            className="px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition-colors"
            title="Picture-in-Picture"
          >
            <PictureInPicture className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleStopRecording}
            className="px-4 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 font-medium transition-colors"
          >
            Stop Recording
          </button>
        </div>
      )}

      {/* Video preview - Fullscreen */}
      {previewMode === 'fullscreen' && recordingStream && (
        <div className="fixed inset-0 bg-black z-[9998] flex items-center justify-center">
          <video
            ref={previewVideoRef}
            className="w-full h-full object-contain"
            playsInline
            muted
            autoPlay
          />
        </div>
      )}

      {/* Video preview - Picture-in-Picture (Draggable & Resizable) */}
      {previewMode === 'pip' && recordingStream && (
        <div
          ref={pipContainerRef}
          className="fixed bg-black rounded-lg shadow-2xl overflow-hidden z-[9998] border-4 border-red-600 cursor-move select-none"
          style={{
            left: `${pipPosition.x}px`,
            top: `${pipPosition.y}px`,
            width: `${pipSize.width}px`,
            height: `${pipSize.height}px`,
          }}
          onMouseDown={handlePreviewMouseDown}
        >
          <video
            ref={previewVideoRefPIP}
            className="w-full h-full object-contain"
            playsInline
            muted
            autoPlay
          />
          <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
            LIVE
          </div>
          
          {/* Controls inside PIP - Bottom center */}
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-black/90 rounded-lg px-3 py-2 z-[10000] pointer-events-auto">
            <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-red-400 animate-pulse'}`} />
            <span className="text-white text-xs font-semibold">
              {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
            </span>
            
            <button
              onClick={handlePauseResume}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
              title={isPaused ? 'Resume Recording' : 'Pause Recording'}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {isPaused ? <Play className="w-4 h-4 text-white" /> : <Pause className="w-4 h-4 text-white" />}
            </button>

            <button
              onClick={handleMicToggle}
              className={`px-2 py-1 rounded transition-colors ${
                micEnabled 
                  ? 'bg-white/20 hover:bg-white/30' 
                  : 'bg-gray-600/50'
              }`}
              title={micEnabled ? 'Microphone On (Click to Mute)' : 'Microphone Off (Click to Unmute)'}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Mic className="w-4 h-4 text-white" />
            </button>

            <button
              onClick={() => setPreviewMode('fullscreen')}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
              title="Enter Fullscreen"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Maximize className="w-4 h-4 text-white" />
            </button>

            <button
              onClick={handleStopRecording}
              className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded transition-colors"
              title="Stop Recording"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Square className="w-4 h-4 text-white" />
            </button>
          </div>
          
          {/* Resize handle for PIP */}
          <div
            className="absolute bottom-0 right-0 w-6 h-6 bg-red-600 cursor-nwse-resize"
            onMouseDown={(e) => handleResizeStart(e, 'pip')}
            style={{
              background: 'linear-gradient(-45deg, transparent 0%, transparent 35%, rgba(255,255,255,0.6) 35%, rgba(255,255,255,0.6) 45%, transparent 45%)'
            }}
          />
        </div>
      )}

      {/* Video preview - Small Draggable */}
      {previewMode === 'small' && recordingStream && (
        <div
          ref={smallContainerRef}
          className="fixed bg-black rounded-lg shadow-2xl overflow-hidden z-[9998] border-2 border-red-600 cursor-move select-none"
          style={{
            left: `${previewPosition.x}px`,
            top: `${previewPosition.y}px`,
            width: `${previewSize.width}px`,
            height: `${previewSize.height}px`,
          }}
          onMouseDown={handlePreviewMouseDown}
        >
          <video
            ref={previewVideoRefSmall}
            className="w-full h-full object-contain"
            playsInline
            muted
            autoPlay
          />
          
          {/* Resize handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 bg-red-600 cursor-nwse-resize"
            onMouseDown={(e) => handleResizeStart(e, 'small')}
            style={{
              background: 'linear-gradient(-45deg, transparent 0%, transparent 30%, rgba(255,255,255,0.5) 30%, rgba(255,255,255,0.5) 40%, transparent 40%)'
            }}
          />
          
          {/* Mini debug info */}
          <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
            Live Preview
          </div>
        </div>
      )}
    </>
  ) : null;

  return (
    <>
      {/* Countdown Overlay - Shows before recording starts */}
      {countdown !== null && !localIsRecording && !storeIsRecording && (
        <div className="fixed inset-0 bg-black/80 z-[10001] flex items-center justify-center">
          <div className="text-white text-[200px] font-bold animate-pulse">
            {countdown}
          </div>
        </div>
      )}
      
      {/* Render overlay as portal so it persists across mode switches */}
      {typeof document !== 'undefined' && createPortal(overlayContent, document.body)}

      {/* Main UI - only show when not hidden */}
      {!hidden && (
        <div className="flex items-center justify-center h-full bg-gray-900">
          <div className="text-center max-w-4xl px-8">
            {/* Error Display */}
            {error && (
              <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
                {error}
              </div>
            )}

            <h1 className="text-3xl font-bold text-white mb-2">Video Recorder</h1>
            <p className="text-gray-400 mb-12">Choose what you want to record</p>

            <div className="grid grid-cols-3 gap-6">
              {/* Record Screen */}
              <button
                onClick={handleRecordScreen}
                disabled={isRecording}
                className="flex flex-col items-center justify-center p-12 bg-gray-800 rounded-xl hover:bg-gray-700 transition-all hover:scale-105 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-500">
                  <Monitor className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Record Screen</h2>
                <p className="text-gray-400 text-sm">Capture your screen or specific window</p>
              </button>

              {/* Record Camera */}
              <button
                onClick={handleRecordCamera}
                disabled={isRecording}
                className="flex flex-col items-center justify-center p-12 bg-gray-800 rounded-xl hover:bg-gray-700 transition-all hover:scale-105 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-500">
                  <Camera className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Record Camera</h2>
                <p className="text-gray-400 text-sm">Record yourself with webcam</p>
              </button>

              {/* Record Audio */}
              <button
                onClick={handleRecordAudio}
                disabled={isRecording}
                className="flex flex-col items-center justify-center p-12 bg-gray-800 rounded-xl hover:bg-gray-700 transition-all hover:scale-105 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-500">
                  <Mic className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Record Audio</h2>
                <p className="text-gray-400 text-sm">Record microphone only</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ScreenRecordingDialog 
        isOpen={screenDialogOpen} 
        onClose={() => setScreenDialogOpen(false)}
        onStart={handleStartRecording}
      />
      <CameraRecordingDialog 
        isOpen={cameraDialogOpen} 
        onClose={() => setCameraDialogOpen(false)}
        onStart={handleStartCameraRecording}
      />
      <AudioRecordingDialog 
        isOpen={audioDialogOpen} 
        onClose={() => setAudioDialogOpen(false)}
        onStart={handleStartAudioRecording}
      />
      
      {/* Save Dialog */}
      {recordingBlob && (
        <RecordingCompleteDialog
          isOpen={showSaveDialog}
          onClose={handleSaveDialogClose}
          onSave={handleSaveRecording}
          onDiscard={handleDiscardRecording}
          recordingBlob={recordingBlob}
          duration={recordingDuration}
        />
      )}
    </>
  );
}

