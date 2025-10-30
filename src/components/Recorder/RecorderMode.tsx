import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Monitor, Camera, Mic, Pause, Play, Maximize, PictureInPicture, Square } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useRecording, type RecordingConfig, getCameraOverlayScreenPosition, getScreenDimensions, getViewportDimensions } from '../../hooks/useRecording';
import { useMediaStore } from '../../store/mediaStore';
import { processMediaFile } from '../../utils/fileHandling';
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
    toggleCameraVisibility,
    isCameraVisible,
    recordingDuration, 
    error, 
    recordingStream,
    cameraStream,
    updateCameraOverlayPosition,
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
  
  // Track recording config for resize detection
  const recordingConfigRef = useRef<{ screenType?: string; windowId?: string } | null>(null);
  
  // Microphone control
  const [micEnabled, setMicEnabled] = useState(true);
  
  // Camera visibility state (synced with hook)
  // Note: We also track it locally to show immediate UI feedback
  const [localCameraVisible, setLocalCameraVisible] = useState(true);
  
  // Countdown state
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Preview mode: 'fullscreen' | 'pip' | 'small'
  const [previewMode, setPreviewMode] = useState<'fullscreen' | 'pip' | 'small'>('fullscreen');
  
  // Track recording dimensions to show actual recording area
  const [recordingDimensions, setRecordingDimensions] = useState<{ width: number; height: number } | null>(null);
  
  // Preview stream before recording starts
  const [previewStreamBeforeRecording, setPreviewStreamBeforeRecording] = useState<MediaStream | null>(null);
  const [pendingRecordingConfig, setPendingRecordingConfig] = useState<RecordingConfig | null>(null);
  
  // Draggable preview state
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [previewSize, setPreviewSize] = useState({ width: 320, height: 180 });
  
  // PIP state (also draggable and resizable)
  const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 });
  const [pipSize, setPipSize] = useState({ width: 400, height: 300 });
  
  // Camera overlay state (for screen + camera recording)
  const [cameraOverlayPosition, setCameraOverlayPosition] = useState({ x: 0, y: 0 });
  const [cameraOverlaySize, setCameraOverlaySize] = useState({ width: 320, height: 240 });
  const [isDraggingCamera, setIsDraggingCamera] = useState(false);
  const [isResizingCamera, setIsResizingCamera] = useState(false);
  const [cameraDragStart, setCameraDragStart] = useState({ x: 0, y: 0 });
  const [cameraResizeStart, setCameraResizeStart] = useState<{ x: number; y: number; width: number; height: number; position: { x: number; y: number } } | null>(null);
  const [resizeHandle, setResizeHandle] = useState<'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's' | null>(null);
  const [hasCameraOverlay, setHasCameraOverlay] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStartState, setResizeStartState] = useState<{ position: { x: number, y: number }, size: { width: number, height: number } } | null>(null);
  
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRefPIP = useRef<HTMLVideoElement>(null);
  const previewVideoRefSmall = useRef<HTMLVideoElement>(null);
  const cameraOverlayVideoRef = useRef<HTMLVideoElement>(null);
  const smallContainerRef = useRef<HTMLDivElement>(null);
  const pipContainerRef = useRef<HTMLDivElement>(null);
  
  // Throttle camera overlay position updates to prevent buffer errors
  const lastCameraOverlayUpdateRef = useRef<number>(0);
  const CAMERA_UPDATE_THROTTLE_MS = 33; // ~30fps updates (reduces Windows Media Foundation buffer errors)

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

  // Sync local camera visibility with hook state
  useEffect(() => {
    setLocalCameraVisible(isCameraVisible);
  }, [isCameraVisible]);

  // Update ALL video elements with recording stream (this is the composited stream for screen+camera)
  useEffect(() => {
    const videos = [
      previewVideoRef.current,
      previewVideoRefPIP.current,
      previewVideoRefSmall.current
    ].filter(Boolean);

    if (videos.length > 0 && recordingStream) {
      videos.forEach((video) => {
        if (video) {
          video.srcObject = recordingStream;
          const playPromise = video.play();
          
          if (playPromise !== undefined) {
            playPromise
              .catch(err => console.error(`❌ Video preview error:`, err));
          }
        }
      });

      // Store dimensions for preview
      const videoTrack = recordingStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        
        // Store recording dimensions to show actual recording area bounds
        if (settings.width && settings.height) {
          setRecordingDimensions({ width: settings.width, height: settings.height });
        }
      }
    }
  }, [recordingStream, localIsRecording, previewMode, hasCameraOverlay]);

  // Camera overlay video removed - we use a simple visual indicator instead
  // to avoid Windows Media Foundation buffer conflicts from multiple camera stream access

  // Camera overlay drag handler
  const handleCameraOverlayMouseDown = (e: React.MouseEvent) => {
    // Don't drag if clicking on a resize handle
    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCamera(true);
    setCameraDragStart({
      x: e.clientX - cameraOverlayPosition.x,
      y: e.clientY - cameraOverlayPosition.y
    });
    // Set cursor style globally during drag to ensure proper cursor
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    
    // Camera preview video removed - no longer needed (causes buffer conflicts)
  };

  // Camera overlay resize handler
  const handleCameraResizeStart = (e: React.MouseEvent, handle: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingCamera(true);
    setResizeHandle(handle);
    setCameraResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: cameraOverlaySize.width,
      height: cameraOverlaySize.height,
      position: { ...cameraOverlayPosition }
    });
    // Set cursor style based on resize handle
    const cursors: Record<string, string> = {
      'se': 'nwse-resize',
      'sw': 'nesw-resize',
      'ne': 'nesw-resize',
      'nw': 'nwse-resize',
      'e': 'ew-resize',
      'w': 'ew-resize',
      'n': 'ns-resize',
      's': 'ns-resize'
    };
    document.body.style.cursor = cursors[handle] || 'default';
    document.body.style.userSelect = 'none';
  };

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
    if (isResizingCamera && cameraResizeStart && resizeHandle) {
      const deltaX = e.clientX - cameraResizeStart.x;
      const deltaY = e.clientY - cameraResizeStart.y;
      let newWidth = cameraResizeStart.width;
      let newHeight = cameraResizeStart.height;
      let newX = cameraResizeStart.position.x;
      let newY = cameraResizeStart.position.y;

      // Minimum size
      const minWidth = 160;
      const minHeight = 120;

      // Handle different resize directions
      if (resizeHandle.includes('e')) {
        newWidth = Math.max(minWidth, cameraResizeStart.width + deltaX);
      }
      if (resizeHandle.includes('w')) {
        newWidth = Math.max(minWidth, cameraResizeStart.width - deltaX);
        newX = cameraResizeStart.position.x + (cameraResizeStart.width - newWidth);
      }
      if (resizeHandle.includes('s')) {
        newHeight = Math.max(minHeight, cameraResizeStart.height + deltaY);
      }
      if (resizeHandle.includes('n')) {
        newHeight = Math.max(minHeight, cameraResizeStart.height - deltaY);
        newY = cameraResizeStart.position.y + (cameraResizeStart.height - newHeight);
      }

      // Constrain to viewport
      const constrainedX = Math.max(0, Math.min(newX, window.innerWidth - newWidth));
      const constrainedY = Math.max(0, Math.min(newY, window.innerHeight - newHeight));
      const constrainedWidth = Math.min(newWidth, window.innerWidth - constrainedX);
      const constrainedHeight = Math.min(newHeight, window.innerHeight - constrainedY);

      const finalPosition = { x: constrainedX, y: constrainedY };
      const finalSize = { width: constrainedWidth, height: constrainedHeight };
      
      setCameraOverlayPosition(finalPosition);
      setCameraOverlaySize(finalSize);
      
      // Throttle compositing position updates to prevent Windows Media Foundation buffer errors
      const now = Date.now();
      if (now - lastCameraOverlayUpdateRef.current >= CAMERA_UPDATE_THROTTLE_MS) {
        lastCameraOverlayUpdateRef.current = now;
        // Update the compositing position and size in real-time
        if (updateCameraOverlayPosition) {
          updateCameraOverlayPosition({
            ...finalPosition,
            ...finalSize
          });
        }
      }
    } else if (isDraggingCamera) {
      const newPosition = {
        x: e.clientX - cameraDragStart.x,
        y: e.clientY - cameraDragStart.y
      };
      // Constrain position to be within viewport
      const constrainedX = Math.max(0, Math.min(newPosition.x, window.innerWidth - cameraOverlaySize.width));
      const constrainedY = Math.max(0, Math.min(newPosition.y, window.innerHeight - cameraOverlaySize.height));
      
      const finalPosition = { x: constrainedX, y: constrainedY };
      setCameraOverlayPosition(finalPosition);
      
      // Throttle compositing position updates to prevent Windows Media Foundation buffer errors
      const now = Date.now();
      if (now - lastCameraOverlayUpdateRef.current >= CAMERA_UPDATE_THROTTLE_MS) {
        lastCameraOverlayUpdateRef.current = now;
        // Update the compositing position in real-time so recording captures the new position
        if (updateCameraOverlayPosition) {
          updateCameraOverlayPosition({
            ...finalPosition,
            width: cameraOverlaySize.width,
            height: cameraOverlaySize.height
          });
        }
      }
    } else if (isDragging) {
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
    setIsDraggingCamera(false);
    setIsResizingCamera(false);
    setIsResizing(false);
    setResizeStartState(null);
    setCameraResizeStart(null);
    setResizeHandle(null);
    // Reset cursor style when drag ends
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  useEffect(() => {
    if (isDragging || isDraggingCamera || isResizingCamera || isResizing) {
      document.addEventListener('mousemove', handlePreviewMouseMove);
      document.addEventListener('mouseup', handlePreviewMouseUp);
      return () => {
        document.removeEventListener('mousemove', handlePreviewMouseMove);
        document.removeEventListener('mouseup', handlePreviewMouseUp);
      };
    }
  }, [isDragging, isDraggingCamera, isResizingCamera, isResizing, dragStart, cameraDragStart, cameraResizeStart, previewPosition, pipPosition, previewMode, resizeStartState, previewSize, pipSize, cameraOverlaySize, cameraOverlayPosition, resizeHandle, updateCameraOverlayPosition]);

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

  // Camera visibility toggle handler
  const handleCameraToggle = () => {
    const newState = !localCameraVisible;
    setLocalCameraVisible(newState);
    toggleCameraVisibility(newState);
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

      // Initialize camera overlay position to bottom-right if camera is enabled
      let initialCameraPosition = { x: 0, y: 0 };
      if (config.cameraId) {
        setHasCameraOverlay(true);
        setLocalCameraVisible(true); // Reset camera visibility when starting recording
        // Calculate initial position properly
        initialCameraPosition = {
          x: Math.max(0, window.innerWidth - cameraOverlaySize.width - 20),
          y: Math.max(0, window.innerHeight - cameraOverlaySize.height - 20)
        };
        setCameraOverlayPosition(initialCameraPosition);
      } else {
        setHasCameraOverlay(false);
        setLocalCameraVisible(false);
      }

      // Create preview stream BEFORE recording starts - shows what will be recorded
      try {
        let previewStream: MediaStream | null = null;
        
        if (config.screenType === 'window' && config.windowId) {
          // Preview window stream
          previewStream = await navigator.mediaDevices.getUserMedia({
            video: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: config.windowId
              }
            } as any,
            audio: false
          });
        } else if (config.screenType === 'full') {
          // Preview full screen - will trigger picker
          previewStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: 'screen' as any,
            } as any,
            audio: false
          });
        }
        
        if (previewStream) {
          setPreviewStreamBeforeRecording(previewStream);
          setPendingRecordingConfig(config);
          setCurrentRecordingType('screen');
        }
      } catch (previewErr) {
        console.error('Failed to create preview stream:', previewErr);
        // Continue anyway - preview is optional, but show error to user
      }

      // Countdown before starting
      await countdownAndExecute(async () => {
        // Cleanup preview stream before starting actual recording
        if (previewStreamBeforeRecording) {
          previewStreamBeforeRecording.getTracks().forEach(track => track.stop());
          setPreviewStreamBeforeRecording(null);
        }
        
        // Start recording FIRST before showing preview overlay
        // Use the calculated initial position instead of state (which may not be updated yet)
        await startRecording({
          screenType: config.screenType,
          windowId: config.windowId,
          includeMicrophone: config.includeMicrophone,
          microphoneId: config.microphoneId,
          cameraId: config.cameraId,
          cameraOverlay: config.cameraId ? {
            x: initialCameraPosition.x,
            y: initialCameraPosition.y,
            width: cameraOverlaySize.width,
            height: cameraOverlaySize.height
          } : undefined,
        });
        
        // Store recording config for resize detection
        recordingConfigRef.current = { 
          screenType: config.screenType, 
          windowId: config.windowId 
        };

        // Small delay before showing preview to let stream stabilize
        setTimeout(() => {
          setLocalIsRecording(true); // This triggers the preview
          setPendingRecordingConfig(null);
        }, 200);
      });
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert(err instanceof Error ? err.message : 'Failed to start recording');
      setLocalIsRecording(false);
      recordingConfigRef.current = null;
    }
  };

  const handleStartCameraRecording = async (config: RecordingConfig) => {
    try {
      setCameraDialogOpen(false); // Close dialog first so preview can show
      
      await countdownAndExecute(async () => {
        await startRecording({
          cameraId: config.cameraId,
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
      setAudioDialogOpen(false); // Close dialog first

      // Set recording type BEFORE starting to prevent video preview flash
      setCurrentRecordingType('audio');

      await countdownAndExecute(async () => {
        await startRecording({
          microphoneId: config.microphoneId,
        });

        setLocalIsRecording(true); // Trigger recording UI (no video preview for audio)
      });
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert(err instanceof Error ? err.message : 'Failed to start recording');
      setLocalIsRecording(false);
      setCurrentRecordingType(null);
    }
  };

  const handleStopRecording = async () => {
    try {
      const blob = await stopRecording();
      setRecordingBlob(blob);
      setLocalIsRecording(false);
      recordingConfigRef.current = null; // Clear recording config
      // DON'T clear currentRecordingType yet - save dialog needs it to determine file format!
      // It will be cleared when the dialog closes
      setShowSaveDialog(true);
      
      // Clean up preview stream if it exists
      if (previewStreamBeforeRecording) {
        previewStreamBeforeRecording.getTracks().forEach(track => track.stop());
        setPreviewStreamBeforeRecording(null);
        setPendingRecordingConfig(null);
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      alert('Failed to stop recording');
    }
  };

  const handleSaveRecording = async (filePath: string, addToLibrary: boolean) => {
    try {
      // Add to media library if requested
      if (addToLibrary) {
        const mediaAsset = await processMediaFile(filePath);
        // Mark as recorded (not imported)
        const recordedAsset = {
          ...mediaAsset,
          source: 'recorded' as const
        };
        useMediaStore.getState().addMedia(recordedAsset);
      }
    } catch (err) {
      console.error('Failed to add recording to media library:', err);
      // Don't block save if library add fails
    }
    
    // Clean up all recording state after saving
    cleanup(); 
    setRecordingBlob(null);
    setLocalIsRecording(false);
    setCurrentRecordingType(null);
    setPendingRecordingConfig(null);
    if (previewStreamBeforeRecording) {
      previewStreamBeforeRecording.getTracks().forEach(track => track.stop());
      setPreviewStreamBeforeRecording(null);
    }
    recordingConfigRef.current = null;
  };

  const handleDiscardRecording = () => {
    setRecordingBlob(null);
    setShowSaveDialog(false);
    // Fully reset all recording state
    cleanup();
    setCurrentRecordingType(null);
    setLocalIsRecording(false);
    setPendingRecordingConfig(null);
    if (previewStreamBeforeRecording) {
      previewStreamBeforeRecording.getTracks().forEach(track => track.stop());
      setPreviewStreamBeforeRecording(null);
    }
    recordingConfigRef.current = null;
  };

  // Clean up stream when save dialog closes
  const handleSaveDialogClose = () => {
    setShowSaveDialog(false);
    cleanup();
    // Fully reset all recording state
    setCurrentRecordingType(null);
    setRecordingBlob(null);
    setLocalIsRecording(false);
    setPendingRecordingConfig(null);
    if (previewStreamBeforeRecording) {
      previewStreamBeforeRecording.getTracks().forEach(track => track.stop());
      setPreviewStreamBeforeRecording(null);
    }
    recordingConfigRef.current = null;
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

  // Render overlay as portal so it persists across mode switches
  // Show preview stream BEFORE recording starts, or recording stream AFTER recording starts
  const showPreview = (localIsRecording || storeIsRecording) && recordingStream 
    ? recordingStream 
    : previewStreamBeforeRecording;
    
  const overlayContent = (pendingRecordingConfig || (localIsRecording || storeIsRecording)) && showPreview ? (
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
            {isPaused ? 'Paused: ' : currentRecordingType === 'audio' ? 'Recording Audio: ' : 'Recording: '}
            {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
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

          {/* Camera Visibility Toggle - only show for screen+camera recordings */}
          {hasCameraOverlay && (
            <button
              onClick={handleCameraToggle}
              className={`px-3 py-2 rounded transition-colors ${
                localCameraVisible 
                  ? 'bg-white text-gray-800 hover:bg-gray-100' 
                  : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
              }`}
              title={localCameraVisible ? 'Camera Visible (Click to Hide)' : 'Camera Hidden (Click to Show)'}
            >
              <Camera className="w-5 h-5" />
            </button>
          )}

          {/* View Mode Toggle - only show for video recordings */}
          {currentRecordingType !== 'audio' && (
            <>
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
            </>
          )}
          
          <button
            onClick={handleStopRecording}
            className="px-4 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 font-medium transition-colors"
          >
            Stop Recording
          </button>
        </div>
      )}

      {/* Video preview - Fullscreen (only for video recordings) */}
      {/* Shows the actual recording area rectangle with visible borders */}
      {/* Show preview stream before recording, or recording stream after recording */}
      {previewMode === 'fullscreen' && showPreview && currentRecordingType !== 'audio' && (() => {
        // Get recording dimensions from the stream (preview or recording)
        const track = showPreview.getVideoTracks()[0];
        const settings = track?.getSettings();
        const recordWidth = settings?.width || recordingDimensions?.width || 1920;
        const recordHeight = settings?.height || recordingDimensions?.height || 1080;
        
        if (!recordWidth || !recordHeight) {
          // Fallback while dimensions load
          return (
            <div className="fixed inset-0 bg-black z-[9998] flex items-center justify-center">
              <video
                ref={previewVideoRef}
                className="w-full h-full object-contain"
                playsInline
                muted
                autoPlay
              />
            </div>
          );
        }
        
        // Calculate scale to fit recording area on screen (with padding for borders)
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const padding = 80; // Padding for borders and UI elements
        const availableWidth = screenWidth - padding;
        const availableHeight = screenHeight - padding;
        
        const scaleX = availableWidth / recordWidth;
        const scaleY = availableHeight / recordHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1:1 (don't make bigger than actual)
        
        const previewWidth = recordWidth * scale;
        const previewHeight = recordHeight * scale;
        
        return (
          <div className="fixed inset-0 bg-gray-900 z-[9998] flex items-center justify-center">
            {/* Outer border showing exact recording area bounds */}
            <div 
              className="absolute border-4 border-purple-500 border-dashed bg-purple-500/5 pointer-events-none z-[10001]"
              style={{
                width: `${previewWidth}px`,
                height: `${previewHeight}px`,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 30px rgba(139, 92, 246, 0.6), inset 0 0 20px rgba(139, 92, 246, 0.2)'
              }}
            >
              {/* Corner indicators for precise bounds */}
              <div className="absolute -top-2 -left-2 w-4 h-4 border-t-4 border-l-4 border-purple-400" />
              <div className="absolute -top-2 -right-2 w-4 h-4 border-t-4 border-r-4 border-purple-400" />
              <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-4 border-l-4 border-purple-400" />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-4 border-r-4 border-purple-400" />
            </div>
            
            {/* Resolution indicator */}
            <div className="absolute top-4 left-4 bg-black/90 text-white px-3 py-2 rounded-lg text-sm font-mono z-[10001] pointer-events-none border border-purple-500">
              {recordWidth}×{recordHeight}
              {scale < 1 && (
                <span className="text-xs text-gray-400 ml-2">({Math.round(scale * 100)}% scale)</span>
              )}
            </div>
            
            {/* Window resize warning - only show for window recording */}
            {recordingConfigRef.current?.screenType === 'window' && (
              <div className="absolute top-4 right-4 bg-yellow-600/90 text-white px-4 py-2 rounded-lg text-xs max-w-xs z-[10001] pointer-events-none">
                <div className="font-semibold mb-1">⚠️ Window Recording</div>
                <div className="text-yellow-100">If you resize the recorded window, the recording won't update automatically. Current size is locked.</div>
              </div>
            )}
            
            {/* Video preview - shown at actual recording dimensions */}
            <div
              className="relative overflow-hidden bg-black"
              style={{
                width: `${previewWidth}px`,
                height: `${previewHeight}px`,
                maxWidth: '100vw',
                maxHeight: '100vh'
              }}
            >
              <video
                ref={previewVideoRef}
                className="w-full h-full"
                style={{
                  objectFit: 'fill', // Fill the exact dimensions - shows actual recording area
                  imageRendering: 'auto',
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden',
                  WebkitTransform: 'translateZ(0)'
                }}
                playsInline
                muted
                autoPlay
              />
            </div>
            
            {/* Camera overlay indicator - Draggable during recording (for repositioning) */}
            {/* Position relative to the scaled preview area - uses actual screen coordinates from recording */}
            {/* Only show camera overlay when actually recording (not during preview) */}
            {hasCameraOverlay && recordingStream && (() => {
              // Get the actual camera overlay position in screen coordinates (where it actually is in the recording)
              const screenCameraPos = getCameraOverlayScreenPosition();
              const screenDims = getScreenDimensions();
              
              const track = recordingStream.getVideoTracks()[0];
              const settings = track?.getSettings();
              const recordWidth = settings?.width || recordingDimensions?.width || screenDims.width || 1920;
              const recordHeight = settings?.height || recordingDimensions?.height || screenDims.height || 1080;
              
              if (!recordWidth || !recordHeight) return null;
              
              // Calculate preview scale
              const screenWidth = window.innerWidth;
              const screenHeight = window.innerHeight;
              const padding = 80;
              const availableWidth = screenWidth - padding;
              const availableHeight = screenHeight - padding;
              const scaleX = availableWidth / recordWidth;
              const scaleY = availableHeight / recordHeight;
              const scale = Math.min(scaleX, scaleY, 1);
              
              // Convert screen coordinates (where camera actually is in recording) to preview coordinates
              // The screen position is already in recording dimensions, just scale it down for preview
              const scaledX = screenCameraPos.x * scale;
              const scaledY = screenCameraPos.y * scale;
              const scaledWidth = screenCameraPos.width * scale;
              const scaledHeight = screenCameraPos.height * scale;
              
              return (
                <div
                  className={`absolute bg-black/60 rounded-lg shadow-2xl overflow-hidden border-2 border-dashed select-none z-[10002] pointer-events-auto ${
                    localCameraVisible 
                      ? 'border-blue-500' 
                      : 'border-red-500 opacity-50'
                  } ${
                    isDraggingCamera ? 'cursor-grabbing' : 'cursor-move'
                  }`}
                  style={{
                    left: `calc(50% - ${previewWidth / 2}px + ${scaledX}px)`,
                    top: `calc(50% - ${previewHeight / 2}px + ${scaledY}px)`,
                    width: `${scaledWidth}px`,
                    height: `${scaledHeight}px`,
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={(e) => {
                    // Don't drag if clicking on a resize handle
                    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
                      return;
                    }
                    
                    // Get current camera position in screen coordinates (from compositor)
                    const screenCameraPos = getCameraOverlayScreenPosition();
                    const screenDims = getScreenDimensions();
                    const viewportDims = getViewportDimensions();
                    
                    // Convert screen coordinates to viewport coordinates
                    // This gives us what cameraOverlayPosition SHOULD be
                    const viewportX = (screenCameraPos.x / screenDims.width) * viewportDims.width;
                    const viewportY = (screenCameraPos.y / screenDims.height) * viewportDims.height;
                    
                    // Update cameraOverlayPosition state to match screen position (so drag works correctly)
                    setCameraOverlayPosition({ x: viewportX, y: viewportY });
                    setCameraOverlaySize({ 
                      width: (screenCameraPos.width / screenDims.width) * viewportDims.width,
                      height: (screenCameraPos.height / screenDims.height) * viewportDims.height
                    });
                    
                    // Now calculate drag start normally (using viewport coordinates)
                    setCameraDragStart({
                      x: e.clientX - viewportX,
                      y: e.clientY - viewportY
                    });
                    
                    setIsDraggingCamera(true);
                    document.body.style.cursor = 'grabbing';
                    document.body.style.userSelect = 'none';
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  title="Drag to reposition, drag corners/edges to resize camera overlay"
                >
                  {/* Simple visual indicator */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded">
                    <div className="text-center">
                      <div className={`text-xs font-semibold mb-0.5 ${localCameraVisible ? 'text-white' : 'text-red-300'}`}>
                        {localCameraVisible ? '📹 CAMERA' : '🚫 HIDDEN'}
                      </div>
                      <div className="text-white/70 text-[10px]">Drag to move</div>
                    </div>
                  </div>
                  <div className={`absolute top-1 left-1 text-white px-1.5 py-0.5 rounded text-[10px] font-semibold z-10 ${
                    localCameraVisible ? 'bg-blue-600' : 'bg-red-600'
                  }`}>
                    {localCameraVisible ? 'CAM' : 'OFF'}
                  </div>
                  
                  {/* Resize handles - corners */}
                  <div 
                    className="resize-handle absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border border-blue-300 rounded-sm cursor-nwse-resize z-20"
                    onMouseDown={(e) => handleCameraResizeStart(e, 'nw')}
                  />
                  <div 
                    className="resize-handle absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border border-blue-300 rounded-sm cursor-nesw-resize z-20"
                    onMouseDown={(e) => handleCameraResizeStart(e, 'ne')}
                  />
                  <div 
                    className="resize-handle absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border border-blue-300 rounded-sm cursor-nesw-resize z-20"
                    onMouseDown={(e) => handleCameraResizeStart(e, 'sw')}
                  />
                  <div 
                    className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-blue-300 rounded-sm cursor-nwse-resize z-20"
                    onMouseDown={(e) => handleCameraResizeStart(e, 'se')}
                  />
                  
                  {/* Resize handles - edges */}
                  <div 
                    className="resize-handle absolute -top-1 left-1/2 transform -translate-x-1/2 w-8 h-1.5 bg-blue-500 border border-blue-300 rounded-sm cursor-ns-resize z-20"
                    onMouseDown={(e) => handleCameraResizeStart(e, 'n')}
                  />
                  <div 
                    className="resize-handle absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1.5 bg-blue-500 border border-blue-300 rounded-sm cursor-ns-resize z-20"
                    onMouseDown={(e) => handleCameraResizeStart(e, 's')}
                  />
                  <div 
                    className="resize-handle absolute -left-1 top-1/2 transform -translate-y-1/2 w-1.5 h-8 bg-blue-500 border border-blue-300 rounded-sm cursor-ew-resize z-20"
                    onMouseDown={(e) => handleCameraResizeStart(e, 'w')}
                  />
                  <div 
                    className="resize-handle absolute -right-1 top-1/2 transform -translate-y-1/2 w-1.5 h-8 bg-blue-500 border border-blue-300 rounded-sm cursor-ew-resize z-20"
                    onMouseDown={(e) => handleCameraResizeStart(e, 'e')}
                  />
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Video preview - Picture-in-Picture (Draggable & Resizable) - only for video recordings */}
      {previewMode === 'pip' && recordingStream && currentRecordingType !== 'audio' && (
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

            {/* Camera Visibility Toggle - only show for screen+camera recordings in PIP */}
            {hasCameraOverlay && (
              <button
                onClick={handleCameraToggle}
                className={`px-2 py-1 rounded transition-colors ${
                  localCameraVisible 
                    ? 'bg-white/20 hover:bg-white/30' 
                    : 'bg-gray-600/50'
                }`}
                title={localCameraVisible ? 'Camera Visible (Click to Hide)' : 'Camera Hidden (Click to Show)'}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
            )}

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

      {/* Video preview - Small Draggable - only for video recordings */}
      {previewMode === 'small' && recordingStream && currentRecordingType !== 'audio' && (
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
          recordingType={currentRecordingType as 'screen' | 'camera' | 'audio'}
        />
      )}
    </>
  );
}

