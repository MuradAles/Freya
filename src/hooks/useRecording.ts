import { useRef, useState, useCallback } from 'react';
import { useUIStore } from '../store/uiStore';

export interface RecordingConfig {
  // Screen recording
  screenType?: 'full' | 'window' | 'custom';
  windowId?: string;
  customArea?: { x: number; y: number; width: number; height: number; screenId: string };
  
  // Camera recording
  cameraId?: string;
  cameraPosition?: string;
  
  // Audio recording
  microphoneId?: string;
  includeMicrophone?: boolean;
}

export interface UseRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  startRecording: (config: RecordingConfig) => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<Blob>;
  toggleMicrophone: (enabled: boolean) => void;
  recordingDuration: number;
  error: string | null;
  recordingStream: MediaStream | null;
  cleanup: () => void;
}

export function useRecording(): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<number | null>(null);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const isPausedRef = useRef(false);
  const durationWhenPausedRef = useRef(0);
  
  const { setRecording } = useUIStore();

  const startRecording = useCallback(async (config: RecordingConfig) => {
    try {
      console.log('🎬 startRecording called with config:', config);
      setError(null);
      chunksRef.current = [];
      setRecordingDuration(0);
      
      // Create streams based on config
      console.log('📹 Creating recording stream...');
      const stream = await createRecordingStream(config);
      console.log('✅ Recording stream created:', {
        hasStream: !!stream,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });
      
      streamRef.current = stream;
      console.log('📤 Setting recordingStream state...');
      setRecordingStream(stream);
      console.log('✅ recordingStream state set');

      // Create MediaRecorder with H.264 codec for better MP4 conversion
      // Try different codec options in order of preference
      const codecOptions = [
        'video/webm;codecs=h264',           // Best for MP4 conversion
        'video/webm;codecs=vp9,opus',       // VP9 with audio
        'video/webm;codecs=vp8,opus',       // VP8 with audio
        'video/webm',                        // Default WebM
      ];

      let selectedMimeType = 'video/webm';
      for (const mimeType of codecOptions) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('✅ Using codec:', mimeType);
          break;
        }
      }

      const options: MediaRecorderOptions = {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
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
        console.log('MediaRecorder stopped');
      };

      // Start recording
      recorder.start(1000); // Collect chunks every second
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
        
        console.log('Recording complete, blob size:', blob.size);
        
        // Cleanup - DON'T stop tracks yet, let them stay for preview until dialog closes
        chunksRef.current = [];
        setIsRecording(false);
        setRecording(false);
        setRecordingDuration(0);
        
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
      console.log('⏸️ Recording paused');
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
      
      console.log('▶️ Recording resumed');
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
      console.log(`🎤 Audio track ${track.label} ${enabled ? 'enabled' : 'disabled'}`);
    });
  }, []);

  // Cleanup function to stop all tracks
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setRecordingStream(null);
  }, []);

  return {
    isRecording,
    isPaused,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    toggleMicrophone,
    recordingDuration,
    error,
    recordingStream,
    cleanup, // Expose cleanup function
  };
}

/**
 * Create a MediaStream based on the recording configuration
 */
async function createRecordingStream(config: RecordingConfig): Promise<MediaStream> {
  const streams: MediaStream[] = [];

  // Screen recording
  if (config.screenType) {
    const screenStream = await createScreenStream(config);
    streams.push(screenStream);
  }

  // Camera recording
  if (config.cameraId) {
    const cameraStream = await createCameraStream(config.cameraId);
    streams.push(cameraStream);
  }

  // Microphone recording
  if (config.includeMicrophone && config.microphoneId) {
    const micStream = await createMicrophoneStream(config.microphoneId);
    streams.push(micStream);
  }

  // If no streams, throw error
  if (streams.length === 0) {
    throw new Error('No recording sources selected');
  }

  // Combine streams (merge tracks from all streams)
  const combinedStream = new MediaStream();
  
  streams.forEach(stream => {
    stream.getTracks().forEach(track => {
      combinedStream.addTrack(track);
    });
  });

  return combinedStream;
}

/**
 * Create a screen capture stream using Electron's desktopCapturer
 */
async function createScreenStream(config: RecordingConfig): Promise<MediaStream> {
  let stream: MediaStream;

  try {
    console.log('📹 Creating screen stream with getDisplayMedia...');
    
    // Use the modern getDisplayMedia API which is properly handled by our session handler in main.ts
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'screen' as any,
      },
      audio: false // Audio is handled separately if needed
    });
    
    console.log('✅ Screen stream created via getDisplayMedia');

    // Log stream info
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      console.log('✅ Screen stream created:', {
        trackId: videoTrack.id,
        label: videoTrack.label,
        enabled: videoTrack.enabled,
        readyState: videoTrack.readyState,
        muted: videoTrack.muted,
        settings: settings
      });

      // CRITICAL: Check if track actually has dimensions
      if (!settings.width || !settings.height) {
        console.error('❌ VIDEO TRACK HAS NO DIMENSIONS!', settings);
        console.error('This means the screen capture is not working properly.');
        console.error('Possible causes:');
        console.error('1. Windows screen recording permissions not granted');
        console.error('2. Source ID is invalid');
        console.error('3. Running as administrator (elevation issue)');
      } else {
        console.log(`✅ Track dimensions: ${settings.width}x${settings.height}`);
      }
    } else {
      console.warn('⚠️  Stream created but has no video tracks!');
    }

    return stream;
  } catch (error) {
    console.error('❌ Error creating screen stream:', error);
    throw new Error(`Failed to create screen stream: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a camera stream
 */
async function createCameraStream(cameraId: string): Promise<MediaStream> {
  return await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: cameraId } },
  });
}

/**
 * Create a microphone stream
 */
async function createMicrophoneStream(microphoneId: string): Promise<MediaStream> {
  return await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: microphoneId } },
  });
}

