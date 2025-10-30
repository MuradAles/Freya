import { useRef, useState, useCallback } from 'react';
import { useUIStore } from '../store/uiStore';

// Module-level ref to store current camera overlay position and visibility for dynamic compositing (in screen/canvas coordinates)
const cameraOverlayPositionRef = { current: { x: 0, y: 0, width: 320, height: 240, visible: true } };

// Module-level refs to store screen dimensions and viewport dimensions for coordinate conversion
const screenDimensionsRef = { current: { width: 1920, height: 1080 } };
const viewportDimensionsRef = { current: { width: 1920, height: 1080 } };

export interface RecordingConfig {
  // Screen recording
  screenType?: 'full' | 'window';
  windowId?: string;

  // Camera recording
  cameraId?: string;
  cameraOverlay?: { x: number; y: number; width: number; height: number }; // Used for screen + camera (draggable position)

  // Audio recording
  microphoneId?: string;
  includeMicrophone?: boolean;
  includeSystemAudio?: boolean; // NEW: Control system audio separately
}

// Export refs so they can be accessed for coordinate conversion
export const getCameraOverlayScreenPosition = () => cameraOverlayPositionRef.current;
export const getScreenDimensions = () => screenDimensionsRef.current;
export const getViewportDimensions = () => viewportDimensionsRef.current;

export interface UseRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  startRecording: (config: RecordingConfig) => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<Blob>;
  toggleMicrophone: (enabled: boolean) => void;
  toggleCameraVisibility: (visible: boolean) => void;
  isCameraVisible: boolean;
  recordingDuration: number;
  error: string | null;
  recordingStream: MediaStream | null;
  cameraStream: MediaStream | null; // Separate camera stream for preview overlay
  updateCameraOverlayPosition: (position: { x: number; y: number; width: number; height: number }) => void;
  cleanup: () => void;
}

export function useRecording(): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isCameraVisible, setIsCameraVisible] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<number | null>(null);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null); // Separate camera stream for UI preview
  const isPausedRef = useRef(false);
  const durationWhenPausedRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  
  const { setRecording } = useUIStore();

  const startRecording = useCallback(async (config: RecordingConfig) => {
    try {
      // Reset all state to ensure clean start
      setError(null);
      chunksRef.current = [];
      setRecordingDuration(0);
      setIsPaused(false);
      isPausedRef.current = false;
      durationWhenPausedRef.current = 0;
      setIsCameraVisible(true); // Reset camera visibility
      
      // Clear any existing intervals
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      
      // Create camera stream once if needed (for screen + camera recording, we reuse it)
      let sharedCameraStream: MediaStream | null = null;
      if (config.cameraId) {
        try {
          sharedCameraStream = await createCameraStream(config.cameraId);
          // Don't create separate camera stream for UI preview - removed to prevent buffer conflicts
          // The composited recording stream shows the camera, no need for separate preview
          setCameraStream(null);
        } catch (err) {
          console.warn('⚠️ Failed to create camera stream:', err);
          setCameraStream(null);
        }
      } else {
        setCameraStream(null);
      }
      
      // Create streams based on config (pass shared camera stream to avoid duplicate creation)
      const stream = await createRecordingStream(config, sharedCameraStream);
      
      streamRef.current = stream;
      setRecordingStream(stream);

      // Use VP9 for best compression (smaller files) or VP8 for speed
      // H.264 provides excellent compression but may not be available in all browsers
      const codecOptions = [
        'video/webm;codecs=h264,opus',      // Best compression (smallest files)
        'video/webm;codecs=vp9,opus',       // Good compression
        'video/webm;codecs=vp8,opus',       // Fast but larger files
        'video/webm',                        // Default WebM (VP8)
      ];

      let selectedMimeType = 'video/webm';
      for (const mimeType of codecOptions) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      const options: MediaRecorderOptions = {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 8000000,  // 8 Mbps for high quality screen recording
        audioBitsPerSecond: 128000,   // 128 kbps audio
        bitsPerSecond: 8128000        // Total: 8M video + 128k audio
      };

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      // Handle data available event
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred');
      };

      // Note: Don't stop tracks in onstop - keep them running for preview
      recorder.onstop = () => {
      };

      // Start recording with smaller chunks for better compression
      // Smaller chunks (100ms) allow MediaRecorder to compress more efficiently
      recorder.start(100); // Collect chunks every 100ms (was 1000ms)
      setIsRecording(true);
      setRecording(true);

      // Update duration counter
      const startTime = Date.now();
      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingDuration(elapsed);
      }, 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
      setRecording(false);
    }
  }, [setRecording]);

  const stopRecording = useCallback(async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || !isRecording) {
        reject(new Error('No active recording'));
        return;
      }

      // Stop duration counter
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      const handleStop = async () => {
        // Combine all chunks into a single blob
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        
        // Cleanup - DON'T stop tracks yet, let them stay for preview until dialog closes
        chunksRef.current = [];
        setIsRecording(false);
        setRecording(false);
        setIsPaused(false); // Reset pause state
        isPausedRef.current = false;
        durationWhenPausedRef.current = 0;
        // Don't reset duration here - let it stay for display in save dialog
        
        // Convert WebM to MP4 if we can
        try {
          // For now, return as-is since MP4 conversion requires FFmpeg on backend
          // We'll handle MP4 conversion in the save dialog
          resolve(blob);
        } catch (err) {
          console.error('Error converting to MP4:', err);
          resolve(blob); // Return original blob if conversion fails
        }
      };

      mediaRecorderRef.current.onstop = handleStop;

      // Stop recording
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    });
  }, [isRecording, setRecording]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording || isPaused) return;
    
    try {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      isPausedRef.current = true;
      
      // Pause duration counter
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      
      durationWhenPausedRef.current = recordingDuration;
    } catch (err) {
      console.error('Error pausing recording:', err);
    }
  }, [isRecording, isPaused, recordingDuration]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording || !isPaused) return;
    
    try {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      isPausedRef.current = false;
      
      // Resume duration counter from where we left off
      const startTime = Date.now();
      const pauseDuration = durationWhenPausedRef.current;
      
      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingDuration(pauseDuration + elapsed);
      }, 1000);
    } catch (err) {
      console.error('Error resuming recording:', err);
    }
  }, [isRecording, isPaused]);

  // Toggle microphone on/off
  const toggleMicrophone = useCallback((enabled: boolean) => {
    if (!streamRef.current) return;
    
    const audioTracks = streamRef.current.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = enabled;
    });
  }, []);

  // Toggle camera visibility on/off during recording
  const toggleCameraVisibility = useCallback((visible: boolean) => {
    setIsCameraVisible(visible);
    if (cameraOverlayPositionRef.current) {
      cameraOverlayPositionRef.current.visible = visible;
    }
  }, []);

  // Cleanup function to stop all tracks and reset state
  const cleanup = useCallback(() => {
    // Stop duration counter if running
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    // Stop all streams
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Reset all state
    setRecordingStream(null);
    setCameraStream(null);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
    setError(null);
    isPausedRef.current = false;
    durationWhenPausedRef.current = 0;
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    
    // Clear UI store recording state
    setRecording(false);
  }, [cameraStream, setRecording]);

  // Function to update camera overlay position during recording
  // Position is in viewport coordinates, needs to be converted to screen/canvas coordinates
  const updateCameraOverlayPosition = useCallback((position: { x: number; y: number; width: number; height: number }) => {
    // Update current viewport dimensions (in case window was resized)
    viewportDimensionsRef.current = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    // Convert viewport coordinates to screen/canvas coordinates
    const screenWidth = screenDimensionsRef.current.width;
    const screenHeight = screenDimensionsRef.current.height;
    const viewportWidth = viewportDimensionsRef.current.width;
    const viewportHeight = viewportDimensionsRef.current.height;
    
    // Calculate scale factors
    const scaleX = screenWidth / viewportWidth;
    const scaleY = screenHeight / viewportHeight;
    
    // Convert position to screen coordinates (preserve visibility state)
    cameraOverlayPositionRef.current = {
      ...cameraOverlayPositionRef.current,
      x: position.x * scaleX,
      y: position.y * scaleY,
      width: position.width * scaleX,
      height: position.height * scaleY
    };
  }, []);

  return {
    isRecording,
    isPaused,
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
    cameraStream, // Expose camera stream for UI overlay
    updateCameraOverlayPosition, // Expose function to update overlay position
    cleanup, // Expose cleanup function
  };
}

/**
 * Create a MediaStream based on the recording configuration
 * @param config Recording configuration
 * @param existingCameraStream Optional existing camera stream to reuse (avoids duplicate getUserMedia calls)
 */
async function createRecordingStream(config: RecordingConfig, existingCameraStream?: MediaStream | null): Promise<MediaStream> {
  const streams: MediaStream[] = [];
  let screenStream: MediaStream | null = null;
  let cameraRecordStream: MediaStream | null = null;

  // Screen recording
  if (config.screenType) {
    screenStream = await createScreenStream(config);
    streams.push(screenStream);
  }

  // Camera recording - reuse existing stream if provided, otherwise create new one
  // This prevents "Failed to reserve output capture buffer" errors on Windows
  if (config.cameraId) {
    if (existingCameraStream) {
      // Reuse the existing camera stream (for screen + camera mode)
      cameraRecordStream = existingCameraStream;
    } else {
      // Create new camera stream (for camera-only mode)
      cameraRecordStream = await createCameraStream(config.cameraId);
    }
    
    // Only add to streams if we're NOT recording screen (camera-only recording)
    // If recording screen + camera, we'll composite them with canvas instead
    if (!config.screenType) {
      streams.push(cameraRecordStream);
    }
  }

  // System audio (loopback) - Use electron-audio-loopback via IPC
  // Only enable if user wants system audio AND we're doing screen/camera recording
  // For audio-only recording (just microphoneId), don't enable system audio by default
  const shouldEnableSystemAudio = config.includeSystemAudio !== false && (config.screenType || config.cameraId);

  if (shouldEnableSystemAudio) { // Default to true for screen/camera, false for audio-only
    try {
      // Enable loopback audio via IPC
      if (window.electronAPI?.enableLoopbackAudio) {
        await window.electronAPI.enableLoopbackAudio();

        // Now getDisplayMedia should include system audio automatically
        // electron-audio-loopback intercepts the call and adds system audio
      } else {
        console.warn('⚠️  electronAPI.enableLoopbackAudio not available');
      }
    } catch (err) {
      console.warn('⚠️  Failed to enable system audio loopback:', err);
      console.warn('   System audio will not be included in recording');
    }
  } else {
    // Disable loopback audio
    if (window.electronAPI?.disableLoopbackAudio) {
      await window.electronAPI.disableLoopbackAudio();
    }
  }

  // Microphone recording
  // If microphoneId is provided, always capture microphone (includeMicrophone flag is optional)
  if (config.microphoneId) {
    try {
      const micStream = await createMicrophoneStream(config.microphoneId);
      streams.push(micStream);
    } catch (err) {
      console.error('❌ Failed to capture microphone:', err);
      throw new Error(`Microphone capture failed: ${err}`);
    }
  }

  // If no streams, throw error
  if (streams.length === 0) {
    throw new Error('No recording sources selected');
  }

  // Collect all audio and video tracks
  const allAudioTracks: MediaStreamTrack[] = [];
  const allVideoTracks: MediaStreamTrack[] = [];

  streams.forEach((stream) => {
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();

    videoTracks.forEach(track => {
      allVideoTracks.push(track);
    });

    audioTracks.forEach(track => {
      allAudioTracks.push(track);
    });
  });

  // Mix multiple audio tracks using Web Audio API
  const combinedStream = new MediaStream();

  // Handle video tracks - if we have both screen and camera, composite them with canvas
  if (screenStream && cameraRecordStream) {
    // Store screen dimensions for coordinate conversion
    const screenSettings = screenStream.getVideoTracks()[0].getSettings();
    screenDimensionsRef.current = {
      width: screenSettings.width || 1920,
      height: screenSettings.height || 1080
    };
    
    // Store initial viewport dimensions (will be updated on window resize)
    viewportDimensionsRef.current = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    // Convert initial camera overlay position from viewport to screen coordinates
    let initialOverlayPosition = config.cameraOverlay;
    if (initialOverlayPosition) {
      const scaleX = screenDimensionsRef.current.width / viewportDimensionsRef.current.width;
      const scaleY = screenDimensionsRef.current.height / viewportDimensionsRef.current.height;
      initialOverlayPosition = {
        x: initialOverlayPosition.x * scaleX,
        y: initialOverlayPosition.y * scaleY,
        width: initialOverlayPosition.width * scaleX,
        height: initialOverlayPosition.height * scaleY
      };
    }
    
    const compositedStream = await compositeScreenAndCamera(screenStream, cameraRecordStream, initialOverlayPosition);
    combinedStream.addTrack(compositedStream.getVideoTracks()[0]);
  } else {
    // Add all video tracks normally (single source or camera-only)
    allVideoTracks.forEach(track => {
      combinedStream.addTrack(track);
    });
  }

  // Mix audio tracks if we have more than one
  if (allAudioTracks.length > 1) {
    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Connect each audio track to the destination (this mixes them)
      allAudioTracks.forEach((track, index) => {
        const source = audioContext.createMediaStreamSource(new MediaStream([track]));
        source.connect(destination);
      });

      // Get the mixed audio track
      const mixedAudioTrack = destination.stream.getAudioTracks()[0];
      combinedStream.addTrack(mixedAudioTrack);
    } catch (err) {
      console.error('❌ Failed to mix audio tracks:', err);
      console.warn('⚠️  Falling back to first audio track only');
      // Fallback: just use the first audio track
      if (allAudioTracks.length > 0) {
        combinedStream.addTrack(allAudioTracks[0]);
      }
    }
  } else if (allAudioTracks.length === 1) {
    // Only one audio track, add it directly
    combinedStream.addTrack(allAudioTracks[0]);
  }


  return combinedStream;
}

/**
 * Create a screen capture stream using Electron's desktopCapturer
 */
async function createScreenStream(config: RecordingConfig): Promise<MediaStream> {
  let stream: MediaStream;
  const requestAudio = config.includeSystemAudio !== false; // Default to true

  try {
    // If recording a specific window, use getUserMedia with Electron's chromeMediaSource
    if (config.screenType === 'window' && config.windowId) {

      // Capture window with optional audio request
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: config.windowId,
            frameRate: 60, // Record at 60 fps for smooth playback
          }
        } as any,
        audio: requestAudio ? {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: config.windowId,
          }
        } as any : false
      });
    } else {
      // Full screen recording

      // Request audio only if user wants system audio
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          displaySurface: 'screen' as any,
          frameRate: 60, // Record at 60 fps for smooth playback
        },
        audio: requestAudio // Only request audio if system audio is enabled
      } as any);
    }

    // Log stream info
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();

      // CRITICAL: Check if track actually has dimensions
      if (!settings.width || !settings.height) {
        console.error('❌ VIDEO TRACK HAS NO DIMENSIONS!', settings);
        console.error('This means the screen capture is not working properly.');
        console.error('Possible causes:');
        console.error('1. Windows screen recording permissions not granted');
        console.error('2. Source ID is invalid');
        console.error('3. Running as administrator (elevation issue)');
      }
    } else {
      console.warn('⚠️  Stream created but has no video tracks!');
    }

    // Log audio tracks (system audio)
    const audioTracks = stream.getAudioTracks();

    return stream;
  } catch (error) {
    console.error('❌ Error creating screen stream:', error);
    throw new Error(`Failed to create screen stream: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a camera stream with optimized settings to reduce buffer allocation errors
 * Windows Media Foundation has trouble with high frame rates, so we limit it to 30fps
 */
async function createCameraStream(cameraId: string): Promise<MediaStream> {
  try {
    // Request camera with VERY conservative constraints to minimize Windows MF buffer issues
    // Lower frame rate and resolution significantly reduce buffer allocation errors
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        deviceId: { exact: cameraId },
        // Limit frame rate to 15fps to DRASTICALLY reduce buffer allocation frequency
        // This is low enough that Windows Media Foundation can keep up
        frameRate: { ideal: 15, max: 15 },
        // Also limit resolution to reduce buffer size requirements
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 }
      },
    });
    
    
    return stream;
  } catch (error) {
    console.error('❌ Failed to create camera stream:', error);
    // Re-throw with more context
    throw new Error(`Camera access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Composite screen and camera streams using Canvas API
 * This allows us to overlay the camera on the screen recording
 */
async function compositeScreenAndCamera(
  screenStream: MediaStream,
  cameraStream: MediaStream,
  overlayPosition?: { x: number; y: number; width: number; height: number }
): Promise<MediaStream> {
  // Create canvas elements for both streams
  const screenVideo = document.createElement('video');
  const cameraVideo = document.createElement('video');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Set up video elements - set muted to prevent audio feedback
  screenVideo.srcObject = screenStream;
  cameraVideo.srcObject = cameraStream;
  screenVideo.autoplay = true;
  cameraVideo.autoplay = true;
  screenVideo.playsInline = true;
  cameraVideo.playsInline = true;
  screenVideo.muted = true;
  cameraVideo.muted = true;

  // Wait for videos to be ready
  await new Promise<void>((resolve) => {
    let loadedCount = 0;
    const checkReady = () => {
      loadedCount++;
      if (loadedCount === 2) {
        resolve();
      }
    };
    screenVideo.onloadedmetadata = checkReady;
    cameraVideo.onloadedmetadata = checkReady;
  });

  // Set canvas size to match actual video dimensions (more accurate than settings)
  // Use videoWidth/videoHeight from the actual video element for exact matching
  const videoWidth = screenVideo.videoWidth || 1920;
  const videoHeight = screenVideo.videoHeight || 1080;
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  
  
  // Store screen dimensions for coordinate conversion
  screenDimensionsRef.current = {
    width: videoWidth,
    height: videoHeight
  };

  // Default camera overlay position (bottom-right corner, 320x240)
  const defaultOverlay = {
    x: canvas.width - 340,
    y: canvas.height - 260,
    width: 320,
    height: 240
  };
  
  // Initialize the position ref with the initial position and visibility
  if (overlayPosition) {
    cameraOverlayPositionRef.current = { ...overlayPosition, visible: true };
  } else {
    cameraOverlayPositionRef.current = { ...defaultOverlay, visible: true };
  }

  // Animation function to composite frames - reads position from ref each frame
  // Use different frame rates for screen (30fps) and camera (15fps) to reduce buffer pressure
  let lastScreenDrawTime = 0;
  let lastCameraDrawTime = 0;
  const screenFrameRate = 30; // Screen updates at 30fps
  const cameraFrameRate = 15; // Camera updates at 15fps to SIGNIFICANTLY reduce Windows MF buffer pressure
  const screenFrameInterval = 1000 / screenFrameRate; // ~33ms
  const cameraFrameInterval = 1000 / cameraFrameRate; // ~67ms
  
  // Store last camera frame to avoid accessing video element too frequently
  let lastCameraFrame: ImageData | null = null;
  
  const drawFrame = (currentTime: number) => {
    const elapsedSinceScreen = currentTime - lastScreenDrawTime;
    const elapsedSinceCamera = currentTime - lastCameraDrawTime;
    
    // Draw screen at 30fps
    if (elapsedSinceScreen >= screenFrameInterval) {
      lastScreenDrawTime = currentTime - (elapsedSinceScreen % screenFrameInterval);
      
      // Clear canvas first to prevent any leftover pixels
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Always draw screen as background - use exact video dimensions to avoid edge artifacts
      const videoW = screenVideo.videoWidth || canvas.width;
      const videoH = screenVideo.videoHeight || canvas.height;
      ctx.drawImage(screenVideo, 0, 0, videoW, videoH, 0, 0, canvas.width, canvas.height);
      
      // Re-draw the last camera frame if we have one AND camera is visible
      if (lastCameraFrame && cameraOverlayPositionRef.current.visible) {
        const currentOverlay = cameraOverlayPositionRef.current;
        ctx.putImageData(lastCameraFrame, currentOverlay.x, currentOverlay.y);
      }
    }
    
    // Update camera frame at 15fps (HALF the screen rate to reduce buffer pressure)
    if (elapsedSinceCamera >= cameraFrameInterval) {
      lastCameraDrawTime = currentTime - (elapsedSinceCamera % cameraFrameInterval);
      
      const currentOverlay = cameraOverlayPositionRef.current;
      
      // Only update camera frame if camera is visible
      if (currentOverlay.visible) {
        // Only access camera video element every ~67ms to reduce Windows MF buffer allocations
        // readyState 2 = HAVE_CURRENT_DATA, 4 = HAVE_ENOUGH_DATA
        if (cameraVideo.readyState >= 2) {
          // Create temporary canvas to capture camera frame
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = currentOverlay.width;
          tempCanvas.height = currentOverlay.height;
          const tempCtx = tempCanvas.getContext('2d');
          
          if (tempCtx) {
            // Draw camera to temp canvas
            tempCtx.drawImage(cameraVideo, 0, 0, currentOverlay.width, currentOverlay.height);
            // Capture as ImageData to avoid accessing video element again
            lastCameraFrame = tempCtx.getImageData(0, 0, currentOverlay.width, currentOverlay.height);
          }
        }
      } else {
        // Camera is hidden - clear the last frame so it doesn't appear
        lastCameraFrame = null;
      }
    }
    
    requestAnimationFrame(drawFrame);
  };

  // Start drawing with initial timestamp
  requestAnimationFrame((timestamp) => {
    lastScreenDrawTime = timestamp;
    lastCameraDrawTime = timestamp;
    drawFrame(timestamp);
  });

  // Return canvas stream at 30fps (screen rate)
  // Camera overlay appears at 15fps within the stream
  return canvas.captureStream(screenFrameRate); // 30 FPS for smooth screen
}

/**
ես

  // Return canvas stream
  return canvas.captureStream(60); // 60 FPS
}

/**
 * Create a microphone stream
 */
async function createMicrophoneStream(microphoneId: string): Promise<MediaStream> {
  return await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: microphoneId } },
  });
}

