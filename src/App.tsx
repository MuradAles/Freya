import React from 'react';
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
          {/* Left Sidebar - 300px fixed */}
          <div className="w-[300px] flex-shrink-0">
            <Sidebar />
          </div>

          {/* Center - Flexible */}
          <div className="flex-1 flex flex-col bg-gray-900 min-w-0">
            {/* Preview Area */}
            <div className="flex-1 min-h-0">
              <PreviewCanvas />
            </div>

            {/* Timeline - 250px fixed height */}
            <div className="h-64 flex-shrink-0">
              <TimelineNew />
            </div>
          </div>

          {/* Right Sidebar - Properties - 300px fixed */}
          <div className="w-[300px] flex-shrink-0">
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

