import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Volume2 } from 'lucide-react';

interface AudioRecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: {
    microphoneId: string;
  }) => void;
}

interface MicrophoneDevice {
  deviceId: string;
  label: string;
}

export default function AudioRecordingDialog({ isOpen, onClose, onStart }: AudioRecordingDialogProps) {
  const [microphones, setMicrophones] = useState<MicrophoneDevice[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load microphones when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadMicrophones();
    }
    return () => {
      stopTest();
    };
  }, [isOpen]);

  // Start audio level test when microphone is selected
  useEffect(() => {
    if (selectedMicrophoneId && isTesting) {
      startTest();
    }
    return () => {
      stopTest();
    };
  }, [selectedMicrophoneId, isTesting]);

  const loadMicrophones = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      const micList = audioInputs.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${audioInputs.indexOf(device) + 1}`
      }));
      
      setMicrophones(micList);
      if (micList.length > 0) {
        setSelectedMicrophoneId(micList[0].deviceId);
      }
    } catch (error) {
      console.error('Error loading microphones:', error);
    }
  };

  const startTest = async () => {
    try {
      if (!selectedMicrophoneId) return;

      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedMicrophoneId } }
      });

      streamRef.current = stream;

      // Create audio context for level monitoring
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Monitor audio levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (analyserRef.current && isTesting) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const max = Math.max(...dataArray);
          setAudioLevel(max);
          requestAnimationFrame(updateLevel);
        }
      };

      updateLevel();
    } catch (error) {
      console.error('Error starting audio test:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopTest = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const handleStart = () => {
    if (!selectedMicrophoneId) {
      alert('Please select a microphone');
      return;
    }

    stopTest(); // Stop testing before starting recording
    onStart({ microphoneId: selectedMicrophoneId });
  };

  const handleTestToggle = () => {
    if (isTesting) {
      stopTest();
      setIsTesting(false);
    } else {
      setIsTesting(true);
    }
  };

  if (!isOpen) return null;

  // Calculate bar count from audio level (0-255 -> 0-20 bars)
  const barCount = Math.floor(audioLevel / 12.75);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Audio Recording Setup</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Microphone Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-300 mb-3">Select Microphone:</label>
          <div className="space-y-2">
            {microphones.map((mic) => (
              <label
                key={mic.deviceId}
                className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600"
              >
                <input
                  type="radio"
                  name="microphone"
                  value={mic.deviceId}
                  checked={selectedMicrophoneId === mic.deviceId}
                  onChange={() => setSelectedMicrophoneId(mic.deviceId)}
                  className="w-5 h-5 text-purple-600"
                />
                <Mic className="w-5 h-5 text-gray-400" />
                <span className="text-white">{mic.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Audio Level Test */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-300">Test Microphone:</label>
            <button
              onClick={handleTestToggle}
              className={`px-4 py-2 rounded transition-colors text-sm font-medium ${
                isTesting
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {isTesting ? 'Stop Test' : 'Start Test'}
            </button>
          </div>

          {/* Audio Level Visualization */}
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-end gap-1 h-12">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-sm transition-colors ${
                    i < barCount
                      ? 'bg-green-500'
                      : i < barCount + 3
                      ? 'bg-green-400'
                      : 'bg-gray-700'
                  }`}
                  style={{ height: `${(i + 1) * 5}%` }}
                />
              ))}
            </div>
            {isTesting && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                Speak to test your microphone
              </p>
            )}
          </div>
        </div>

        {/* Info Message */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <Volume2 className="w-5 h-5 text-blue-400 mt-0.5" />
            <p className="text-sm text-blue-300">
              This will record audio only. No video will be recorded.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
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

