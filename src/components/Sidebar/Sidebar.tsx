import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { useMediaStore } from '../../store/mediaStore';
import { processMediaFile } from '../../utils/fileHandling';
import MediaGrid from './MediaGrid';

export default function Sidebar() {
  const { addMedia } = useMediaStore();
  const [isDragging, setIsDragging] = useState(false);

  const handleImportClick = async () => {
    try {
      if (!window.electronAPI) {
        alert('Electron API not available');
        return;
      }

      const filePaths = await window.electronAPI.openFile();
      await processFiles(filePaths);
    } catch (error) {
      console.error('Error opening file dialog:', error);
    }
  };

  const processFiles = async (filePaths: string[]) => {
    for (const filePath of filePaths) {
      try {
        const mediaAsset = await processMediaFile(filePath);
        addMedia(mediaAsset);
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    console.log('Dropped files count:', files.length);
    
    const filePaths: string[] = [];
    
    for (const file of files) {
      console.log('Processing file:', file.name, file.type);
      
      // Use the recommended method: webUtils.getPathForFile
      let path: string | null = null;
      
      if (window.electronAPI && window.electronAPI.getPathForFile) {
        path = window.electronAPI.getPathForFile(file);
        console.log('✓ Got path from webUtils.getPathForFile:', path);
      } else {
        // Fallback: Try legacy File.path (may not work in Electron 32+)
        const fileObj = file as any;
        path = fileObj.path;
        console.log('⚠ Using legacy File.path:', path);
      }
      
      if (path) {
        filePaths.push(path);
        console.log('✓ Added path to list:', path);
      } else {
        console.error('✗ Could not get path for file:', file.name);
        alert(`Could not access file path for "${file.name}". Please use the "Import Media" button instead.`);
      }
    }

    console.log(`Total file paths extracted: ${filePaths.length}`);

    if (filePaths.length > 0) {
      await processFiles(filePaths);
    } else {
      console.warn('No valid file paths to process - user should use Import Media button');
    }
  };

  return (
    <div 
      className={`w-full h-full bg-gray-800 flex flex-col transition-colors relative ${isDragging ? 'bg-purple-900/50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">Media Library</h1>
      </div>

      {/* Import Section */}
      <div className="p-4 border-b border-gray-700">
        <button 
          onClick={handleImportClick}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded font-medium text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span>Import Media</span>
        </button>
      </div>

      {/* Media Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <MediaGrid />
      </div>
      
      {/* Drag Over Indicator */}
      {isDragging && (
        <div className="absolute inset-0 bg-purple-900/30 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-purple-600 text-white px-8 py-4 rounded-lg shadow-lg text-center">
            <Upload className="w-8 h-8 mx-auto mb-2" />
            <p className="text-lg font-semibold">Drop files here</p>
            <p className="text-sm opacity-75">Release to import</p>
          </div>
        </div>
      )}
    </div>
  );
}

