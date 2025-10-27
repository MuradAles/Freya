import React from 'react';
import { useMediaStore } from '../../store/mediaStore';
import MediaItem from './MediaItem';

export default function MediaGrid() {
  const { mediaLibrary } = useMediaStore();
  
  return (
    <div className="overflow-y-auto flex-1">
      <div className="grid grid-cols-2 gap-3 p-4">
        {mediaLibrary.length === 0 ? (
          <div className="col-span-2 text-center text-gray-500 py-8">
            <p className="text-sm">No media files yet</p>
            <p className="text-xs mt-1">Import or record media to get started</p>
          </div>
        ) : (
          mediaLibrary.map((media) => (
            <MediaItem key={media.id} media={media} />
          ))
        )}
      </div>
    </div>
  );
}

