import React, { useEffect, useRef } from 'react';
import { Scissors, Trash2 } from 'lucide-react';

interface ClipContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onSplit?: () => void;
  onDelete?: () => void;
  canSplit?: boolean;
}

export default function ClipContextMenu({
  x,
  y,
  onClose,
  onSplit,
  onDelete,
  canSplit = false,
}: ClipContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Also close on escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Small delay to avoid closing immediately when opening
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-gray-800 border border-gray-600 rounded shadow-lg z-50 min-w-[160px]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {canSplit && onSplit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSplit();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2 text-sm transition-colors rounded-t"
        >
          <Scissors className="w-4 h-4" />
          <span>Split at Playhead</span>
        </button>
      )}
      
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            onClose();
          }}
          className={`w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 flex items-center gap-2 text-sm transition-colors ${
            canSplit && onSplit ? '' : 'rounded-t'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </button>
      )}
    </div>
  );
}

