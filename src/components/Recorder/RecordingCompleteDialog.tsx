import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Folder } from 'lucide-react';

interface RecordingCompleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (filePath: string, addToLibrary: boolean) => Promise<void>;
  onDiscard: () => void;
  recordingBlob: Blob;
  duration: number;
  recordingType?: 'screen' | 'camera' | 'audio'; // NEW: Detect audio-only recordings
}

export default function RecordingCompleteDialog({
  isOpen,
  onClose,
  onSave,
  onDiscard,
  recordingBlob,
  duration,
  recordingType = 'screen' // Default to screen if not provided
}: RecordingCompleteDialogProps) {
  const [filePath, setFilePath] = useState('');
  const [addToLibrary, setAddToLibrary] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('medium');
  const [frameRate, setFrameRate] = useState<30 | 60>(60);

  // Listen for compression progress
  useEffect(() => {
    const handleProgress = (progress: number) => {
      setCompressionProgress(progress);
    };

    window.electronAPI?.on('recording:compressionProgress', handleProgress);

    return () => {
      window.electronAPI?.off('recording:compressionProgress', handleProgress);
    };
  }, []);

  // Generate default filename based on recording type
  const getDefaultFilename = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '-');
    const extension = recordingType === 'audio' ? 'mp3' : 'mp4';
    return `recording-${dateStr}.${extension}`;
  };

  // Convert blob to base64 for saving
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleBrowse = async () => {
    try {
      const defaultFilename = getDefaultFilename();
      // Get default path to user's Documents folder
      const path = await window.electronAPI?.showRecordingSaveDialog(defaultFilename);
      if (path) {
        setFilePath(path);
      }
    } catch (err) {
      console.error('Error showing save dialog:', err);
      setError('Failed to open save dialog. The app may need to be restarted.');
    }
  };

  const handleSave = async () => {
    if (!filePath) {
      setError('Please select a file location');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Convert blob to base64
      const base64Data = await blobToBase64(recordingBlob);

      // Determine file extension and format based on recording type
      const isAudioOnly = recordingType === 'audio';
      const targetExtension = isAudioOnly ? '.mp3' : '.mp4';
      const tempExtension = isAudioOnly ? '_temp.webm' : '_temp.webm';

      // Ensure file path ends with correct extension
      let finalPath = filePath;
      if (!finalPath.toLowerCase().endsWith(targetExtension)) {
        const lastDotIndex = finalPath.lastIndexOf('.');
        if (lastDotIndex > 0) {
          finalPath = finalPath.substring(0, lastDotIndex) + targetExtension;
        } else {
          finalPath = finalPath + targetExtension;
        }
      }

      // Save temp WebM file
      const tempWebMPath = finalPath.replace(targetExtension, tempExtension);

      const saveResult = await window.electronAPI.saveRecording(base64Data, tempWebMPath);

      if (!saveResult?.success) {
        setError(saveResult?.error || 'Failed to save file');
        setIsSaving(false);
        return;
      }

      // Convert to final format
      if (isAudioOnly) {
        // Convert to MP3 for audio-only recordings
        const convertResult = await window.electronAPI?.convertRecordingToMP3?.(
          tempWebMPath,
          finalPath,
          quality
        );

        if (convertResult?.success) {
          await window.electronAPI?.deleteFile?.(tempWebMPath);
          await onSave(finalPath, addToLibrary);
          onClose();
        } else {
          console.error('❌ MP3 conversion failed:', convertResult?.error);
          await window.electronAPI?.deleteFile?.(tempWebMPath);
          setError(`Failed to save as MP3: ${convertResult?.error || 'Unknown error'}`);
        }
      } else {
        // Convert to MP4 with selected quality and frame rate for video recordings
        const convertResult = await window.electronAPI?.convertRecordingToMP4?.(
          tempWebMPath,
          finalPath,
          quality,
          frameRate
        );

        if (convertResult?.success) {
          await window.electronAPI?.deleteFile?.(tempWebMPath);
          await onSave(finalPath, addToLibrary);
          onClose();
        } else {
          console.error('❌ MP4 conversion failed:', convertResult?.error);
          await window.electronAPI?.deleteFile?.(tempWebMPath);
          setError(`Failed to save as MP4: ${convertResult?.error || 'Unknown error'}`);
        }
      }
    } catch (err) {
      console.error('Error saving recording:', err);
      setError('Failed to save recording');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (confirm('Are you sure you want to discard this recording?')) {
      onDiscard();
      onClose();
    }
  };

  if (!isOpen) return null;

  const fileSizeMB = (recordingBlob.size / 1024 / 1024).toFixed(2);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {recordingType === 'audio' ? 'Audio Recording Complete' : 'Recording Complete'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Recording Info */}
        <div className="bg-gray-900 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Duration:</span>
            <span className="text-white font-medium">
              {minutes}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">File Size:</span>
            <span className="text-white font-medium">{fileSizeMB} MB</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Format:</span>
            <span className="text-white font-medium">
              {recordingType === 'audio' ? 'MP3 (Audio)' : 'MP4 (H.264)'}
            </span>
          </div>
        </div>

        {/* Quality Settings - Only show for video recordings */}
        {recordingType !== 'audio' && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-300 mb-2">Video Quality:</label>
            <div className="grid grid-cols-3 gap-2">
              {(['high', 'medium', 'low'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`px-4 py-2 rounded transition-colors ${
                    quality === q
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {q === 'high' && 'High (CRF 18)'}
                  {q === 'medium' && 'Medium (CRF 23)'}
                  {q === 'low' && 'Low (CRF 28)'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {quality === 'high' && 'Best quality, larger file size (~5-10 MB/min)'}
              {quality === 'medium' && 'Balanced quality and file size (~2-5 MB/min)'}
              {quality === 'low' && 'Smallest file size (~0.5-2 MB/min)'}
            </p>
          </div>
        )}

        {/* Audio Quality Settings - Show for audio recordings */}
        {recordingType === 'audio' && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-300 mb-2">Audio Quality:</label>
            <div className="grid grid-cols-3 gap-2">
              {(['high', 'medium', 'low'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`px-4 py-2 rounded transition-colors ${
                    quality === q
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {q === 'high' && 'High (320kbps)'}
                  {q === 'medium' && 'Medium (192kbps)'}
                  {q === 'low' && 'Low (128kbps)'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {quality === 'high' && 'Highest quality (~2.4 MB/min)'}
              {quality === 'medium' && 'Good quality (~1.4 MB/min)'}
              {quality === 'low' && 'Smallest file (~1.0 MB/min)'}
            </p>
          </div>
        )}

        {/* Frame Rate Settings - Only show for video recordings */}
        {recordingType !== 'audio' && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-300 mb-2">Frame Rate:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFrameRate(30)}
                className={`px-4 py-2 rounded transition-colors ${
                  frameRate === 30
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                30 FPS (Smooth)
              </button>
              <button
                onClick={() => setFrameRate(60)}
                className={`px-4 py-2 rounded transition-colors ${
                  frameRate === 60
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                60 FPS (Very Smooth)
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Higher frame rate = smoother video but larger file size
            </p>
          </div>
        )}

        {/* Save Location */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-300 mb-2">Save Location:</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={filePath || getDefaultFilename()}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="Select a location..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
            />
            <button
              onClick={handleBrowse}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors flex items-center gap-2"
            >
              <Folder className="w-5 h-5" />
              Browse
            </button>
          </div>
        </div>

        {/* Add to Library Checkbox */}
        <div className="mb-6">
          <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
            <input
              type="checkbox"
              checked={addToLibrary}
              onChange={(e) => setAddToLibrary(e.target.checked)}
              className="w-5 h-5 text-purple-600 rounded"
            />
            <span className="text-white">Add to Media Library</span>
          </label>
        </div>

        {/* Progress Bar */}
        {isSaving && compressionProgress > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-300">Compressing video...</span>
              <span className="text-sm text-gray-400">{Math.round(compressionProgress)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${compressionProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleDiscard}
            className="flex items-center gap-2 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors font-medium"
          >
            <Trash2 className="w-5 h-5" />
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !filePath}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Saving...' : 'Save Recording'}
          </button>
        </div>
      </div>
    </div>
  );
}

