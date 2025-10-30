import React, { useState, useEffect, useRef } from 'react';
import { X, Camera } from 'lucide-react';

interface CameraRecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: {
    cameraId: string;
    includeMicrophone: boolean;
    microphoneId?: string;
  }) => void;
}

interface CameraDevice {
  deviceId: string;
  label: string;
}

export default function CameraRecordingDialog({ isOpen, onClose, onStart }: CameraRecordingDialogProps) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [includeMicrophone, setIncludeMicrophone] = useState(false);
  const [microphones, setMicrophones] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('');
  const [previewActive, setPreviewActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load cameras when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadCameras();
    }
    return () => {
      // Clean up video stream when dialog closes
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [isOpen]);

  // Start preview when camera is selected
  useEffect(() => {
    if (selectedCameraId && isOpen) {
      startPreview();
    }
    return () => {
      stopPreview();
    };
  }, [selectedCameraId, isOpen]);

  // Load microphones when enabled
  useEffect(() => {
    if (includeMicrophone) {
      loadMicrophones();
    }
  }, [includeMicrophone]);

  const loadCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      
      const cameraList = videoInputs.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${videoInputs.indexOf(device) + 1}`
      }));
      
      setCameras(cameraList);
      if (cameraList.length > 0) {
        setSelectedCameraId(cameraList[0].deviceId);
      }
    } catch (error) {
      console.error('Error loading cameras:', error);
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

  const startPreview = async () => {
    try {
      if (!videoRef.current || !selectedCameraId) return;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedCameraId } },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setPreviewActive(true);
      }
    } catch (error) {
      console.error('Error starting camera preview:', error);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const stopPreview = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setPreviewActive(false);
    }
  };

  const handleStart = () => {
    if (!selectedCameraId) {
      alert('Please select a camera');
      return;
    }
    if (includeMicrophone && !selectedMicrophoneId) {
      alert('Please select a microphone');
      return;
    }

    stopPreview(); // Stop preview before starting recording
    onStart({
      cameraId: selectedCameraId,
      includeMicrophone,
      microphoneId: includeMicrophone ? selectedMicrophoneId : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Camera Recording Setup</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Camera Selection */}
          <div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-3">Select Camera:</label>
              <div className="space-y-2">
                {cameras.map((camera) => (
                  <label
                    key={camera.deviceId}
                    className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600"
                  >
                    <input
                      type="radio"
                      name="camera"
                      value={camera.deviceId}
                      checked={selectedCameraId === camera.deviceId}
                      onChange={() => setSelectedCameraId(camera.deviceId)}
                      className="w-5 h-5 text-purple-600"
                    />
                    <span className="text-white">{camera.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Microphone Toggle */}
            <div className="mb-6">
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
                <div className="mt-3">
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

          {/* Right: Camera Preview */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">Live Preview:</label>
            <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video">
              {previewActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Camera className="w-16 h-16 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select a camera to preview</p>
                  </div>
                </div>
              )}
            </div>
            {selectedCameraId && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                {cameras.find(c => c.deviceId === selectedCameraId)?.label || 'Camera'}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end mt-6">
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
