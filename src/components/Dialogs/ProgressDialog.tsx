import React from 'react';
import { X } from 'lucide-react';

interface ProgressDialogProps {
  isOpen: boolean;
  progress: number; // 0-100
  message?: string;
  onCancel?: () => void;
}

export default function ProgressDialog({ isOpen, progress, message, onCancel }: ProgressDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-md p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">{message || 'Exporting Video...'}</h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-2">
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-purple-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>

        {/* Progress Text */}
        <div className="text-center text-gray-400 text-sm">
          {Math.round(progress)}%
        </div>

        {/* Cancel Button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-4 w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

