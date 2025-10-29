import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from './store/uiStore';
import Sidebar from './components/Sidebar/Sidebar';
import PreviewCanvas from './components/Preview/PreviewCanvas';
import TimelineNew from './components/Timeline/TimelineNew';
import PropertiesPanel from './components/Properties/PropertiesPanel';
import ModeSwitcher from './components/ModeSwitcher';
import RecorderMode from './components/Recorder/RecorderMode';
import logo from '../Freya.png';

function App() {
  const { currentMode } = useUIStore();
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(300);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(300);
  const [timelineHeight, setTimelineHeight] = useState(256);
  
  const leftResizeRef = useRef(false);
  const rightResizeRef = useRef(false);
  const timelineResizeRef = useRef(false);
  
  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (leftResizeRef.current) {
        const newWidth = e.clientX;
        if (newWidth >= 200 && newWidth <= 800) {
          setLeftSidebarWidth(newWidth);
        }
      }
      if (rightResizeRef.current) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 200 && newWidth <= 800) {
          setRightSidebarWidth(newWidth);
        }
      }
      if (timelineResizeRef.current) {
        const container = document.querySelector('.resize-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          const containerHeight = container.clientHeight;
          const mouseY = e.clientY - rect.top;
          const newHeight = containerHeight - mouseY;
          if (newHeight >= 200 && newHeight <= 600) {
            setTimelineHeight(newHeight);
          }
        }
      }
    };
    
    const handleMouseUp = () => {
      leftResizeRef.current = false;
      rightResizeRef.current = false;
      timelineResizeRef.current = false;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-900 overflow-hidden">
      {/* Header with Mode Switcher */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Freya" className="w-6 h-6" />
          <h1 className="text-xl font-bold text-white">Freya</h1>
        </div>
        <ModeSwitcher />
      </div>


      {/* Conditional Rendering based on mode */}
      {currentMode === 'editor' ? (
        // Editor Mode (existing layout)
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Resizable */}
          <div className="flex-shrink-0 relative" style={{ width: leftSidebarWidth }}>
            <Sidebar />
            
            {/* Resize Handle */}
            <div 
              className="absolute right-0 top-0 w-1 h-full bg-gray-700 hover:bg-purple-500 cursor-ew-resize group z-10"
              onMouseDown={(e) => {
                e.preventDefault();
                leftResizeRef.current = true;
              }}
            >
              <div className="absolute top-0 left-0 w-full h-full group-hover:bg-purple-500/20" />
            </div>
          </div>

          {/* Center - Flexible */}
          <div className="flex-1 flex flex-col bg-gray-900 min-w-0 resize-container">
            {/* Preview Area */}
            <div className="flex-1 min-h-0">
              <PreviewCanvas />
            </div>

            {/* Resize Handle for Timeline */}
            <div 
              className="flex-shrink-0 h-1 bg-gray-700 hover:bg-purple-500 cursor-ns-resize group z-10"
              onMouseDown={(e) => {
                e.preventDefault();
                timelineResizeRef.current = true;
              }}
            >
              <div className="w-full h-full group-hover:bg-purple-500/20" />
            </div>

            {/* Timeline - Resizable height */}
            <div className="flex-shrink-0" style={{ height: timelineHeight }}>
              <TimelineNew />
            </div>
          </div>

          {/* Right Sidebar - Properties - Resizable */}
          <div className="flex-shrink-0 relative" style={{ width: rightSidebarWidth }}>
            {/* Resize Handle */}
            <div 
              className="absolute left-0 top-0 w-1 h-full bg-gray-700 hover:bg-purple-500 cursor-ew-resize group z-10"
              onMouseDown={(e) => {
                e.preventDefault();
                rightResizeRef.current = true;
              }}
            >
              <div className="absolute top-0 left-0 w-full h-full group-hover:bg-purple-500/20" />
            </div>
            
            <PropertiesPanel />
          </div>
        </div>
      ) : (
        // Recorder Mode (new layout)
        <div className="flex-1 overflow-hidden">
          <RecorderMode />
        </div>
      )}
      
      {/* Always render RecorderMode in background when recording to keep overlay visible */}
      <RecorderMode hidden={currentMode !== 'recorder'} />
    </div>
  );
}

export default App;

