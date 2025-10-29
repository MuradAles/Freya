import React, { useState } from 'react';
import { X, Save, Trash2, Folder } from 'lucide-react';

interface RecordingCompleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (filePath: string, addToLibrary: boolean) => Promise<void>;
  onDiscard: () => void;
  recordingBlob: Blob;
  duration: number;
}

export default function RecordingCompleteDialog({
  isOpen,
  onClose,
  onSave,
  onDiscard,
  recordingBlob,
  duration
}: RecordingCompleteDialogProps) {
  const [filePath, setFilePath] = useState('');
  const [addToLibrary, setAddToLibrary] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate default filename
  const getDefaultFilename = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '-');
    return `recording-${dateStr}.mp4`; // Save as MP4 (converted via FFmpeg)
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

      // Ensure file path ends with .mp4
      let finalPath = filePath;
      if (!finalPath.toLowerCase().endsWith('.mp4')) {
        const lastDotIndex = finalPath.lastIndexOf('.');
        if (lastDotIndex > 0) {
          finalPath = finalPath.substring(0, lastDotIndex) + '.mp4';
        } else {
          finalPath = finalPath + '.mp4';
        }
      }

      // Save temp WebM file, then immediately convert to MP4
      const tempWebMPath = finalPath.replace('.mp4', '_temp.webm');
      console.log('💾 Saving temporary WebM file:', tempWebMPath);
      
      const saveResult = await window.electronAPI.saveRecording(base64Data, tempWebMPath);
      
      if (!saveResult?.success) {
        setError(saveResult?.error || 'Failed to save file');
        setIsSaving(false);
        return;
      }

      // Immediately convert to MP4
      console.log('🎬 Converting to MP4...');
      const convertResult = await window.electronAPI?.convertRecordingToMP4?.(tempWebMPath, finalPath);

      if (convertResult?.success) {
        // Delete temp file
        console.log('✅ MP4 saved successfully, cleaning up temp file');
        await window.electronAPI?.deleteFile?.(tempWebMPath);
        await onSave(finalPath, addToLibrary);
        onClose();
      } else {
        // Keep WebM if conversion fails
        console.error('❌ MP4 conversion failed:', convertResult?.error);
        await window.electronAPI?.deleteFile?.(tempWebMPath);
        setError(`Failed to save as MP4: ${convertResult?.error || 'Unknown error'}`);
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
          <h2 className="text-2xl font-bold text-white">Recording Complete</h2>
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
            <span className="text-white font-medium">MP4 (h.264)</span>
          </div>
        </div>

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

