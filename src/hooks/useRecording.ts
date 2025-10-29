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
  includeSystemAudio?: boolean; // NEW: Control system audio separately
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
          console.log('✅ Using codec:', mimeType);
          break;
        }
      }

      const options: MediaRecorderOptions = {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 1500000,  // 1.5 Mbps (reduced from 2 Mbps for smaller files)
        audioBitsPerSecond: 128000,   // 128 kbps audio (explicit setting)
        bitsPerSecond: 1628000        // Total: 1.5M video + 128k audio
      };

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      // Log what MediaRecorder will actually record
      console.log('\n🎬 MEDIARECORDER INITIALIZATION:');
      console.log('   Audio tracks being recorded:', stream.getAudioTracks().length);
      stream.getAudioTracks().forEach((track: MediaStreamTrack, index) => {
        console.log(`   ${index + 1}. ${track.kind}: ${track.label}`);
        console.log(`      - Enabled: ${track.enabled}`);
        console.log(`      - Muted: ${track.muted}`);
        console.log(`      - ReadyState: ${track.readyState}`);
      });
      console.log('');

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

  // System audio (loopback) - Use electron-audio-loopback via IPC
  // Only enable if user wants system audio
  if (config.includeSystemAudio !== false) { // Default to true if not specified
    try {
      console.log('🔊 Attempting to capture system audio via electron-audio-loopback...');

      // Enable loopback audio via IPC
      if (window.electronAPI?.enableLoopbackAudio) {
        await window.electronAPI.enableLoopbackAudio();
        console.log('✅ Loopback audio enabled via IPC');

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
    console.log('🔇 System audio capture disabled by user');
    // Disable loopback audio
    if (window.electronAPI?.disableLoopbackAudio) {
      await window.electronAPI.disableLoopbackAudio();
    }
  }

  // Microphone recording
  if (config.includeMicrophone && config.microphoneId) {
    console.log('🎤 Attempting to capture microphone:', config.microphoneId);
    try {
      const micStream = await createMicrophoneStream(config.microphoneId);
      streams.push(micStream);
      console.log('✅ Microphone stream created successfully');
      console.log('   Audio tracks:', micStream.getAudioTracks().length);
      micStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
        console.log(`   - ${track.label} (${track.enabled ? 'enabled' : 'disabled'})`);
      });
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

  console.log('\n📊 COLLECTING TRACKS FROM STREAMS:');
  console.log(`   Total streams: ${streams.length}`);

  streams.forEach((stream, index) => {
    console.log(`\n   Stream ${index + 1}:`);
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    console.log(`     - Video tracks: ${videoTracks.length}`);
    console.log(`     - Audio tracks: ${audioTracks.length}`);

    videoTracks.forEach(track => {
      allVideoTracks.push(track);
      console.log(`     ✓ Collected video track: ${track.label}`);
    });

    audioTracks.forEach(track => {
      allAudioTracks.push(track);
      console.log(`     ✓ Collected audio track: ${track.label}`);
    });
  });

  console.log(`\n🎵 TOTAL AUDIO TRACKS COLLECTED: ${allAudioTracks.length}`);
  console.log(`📹 TOTAL VIDEO TRACKS COLLECTED: ${allVideoTracks.length}`);

  // Mix multiple audio tracks using Web Audio API
  const combinedStream = new MediaStream();

  // Add all video tracks (these work fine with multiple tracks)
  allVideoTracks.forEach(track => {
    combinedStream.addTrack(track);
  });

  // Mix audio tracks if we have more than one
  if (allAudioTracks.length > 1) {
    console.log('\n🔊 MIXING MULTIPLE AUDIO TRACKS using Web Audio API...');
    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Connect each audio track to the destination (this mixes them)
      allAudioTracks.forEach((track, index) => {
        const source = audioContext.createMediaStreamSource(new MediaStream([track]));
        source.connect(destination);
        console.log(`   ✓ Connected audio track ${index + 1}: ${track.label}`);
      });

      // Get the mixed audio track
      const mixedAudioTrack = destination.stream.getAudioTracks()[0];
      combinedStream.addTrack(mixedAudioTrack);
      console.log('✅ Audio tracks mixed successfully into single track');
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
    console.log('\n🔊 Single audio track - adding directly');
    combinedStream.addTrack(allAudioTracks[0]);
  } else {
    console.log('\n🔇 No audio tracks to add');
  }

  console.log(`\n✅ FINAL COMBINED STREAM:`);
  console.log(`   Video tracks: ${combinedStream.getVideoTracks().length}`);
  console.log(`   Audio tracks: ${combinedStream.getAudioTracks().length}`);
  console.log('');

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
      console.log('📹 Creating window stream for:', config.windowId);
      console.log('   System audio:', requestAudio ? 'ENABLED' : 'DISABLED');

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
      console.log(`✅ Window stream created (system audio: ${requestAudio ? 'ON' : 'OFF'})`);
    } else {
      // Full screen recording
      console.log('📹 Creating screen stream with getDisplayMedia...');
      console.log('   System audio:', requestAudio ? 'ENABLED' : 'DISABLED');

      // Request audio only if user wants system audio
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          displaySurface: 'screen' as any,
          frameRate: 60, // Record at 60 fps for smooth playback
        },
        audio: requestAudio // Only request audio if system audio is enabled
      } as any);
      console.log(`✅ Screen stream created (system audio: ${requestAudio ? 'ON' : 'OFF'})`);
    }

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

    // Log audio tracks (system audio)
    const audioTracks = stream.getAudioTracks();
    console.log(`🎵 System audio tracks: ${audioTracks.length}`);
    audioTracks.forEach((track, index) => {
      console.log(`   Track ${index + 1}: ${track.label} (${track.enabled ? 'enabled' : 'disabled'})`);
    });

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

