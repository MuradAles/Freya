import React from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import PreviewCanvas from './components/Preview/PreviewCanvas';
import Timeline from './components/Timeline/Timeline';
import PropertiesPanel from './components/Properties/PropertiesPanel';

function App() {
  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
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
          <Timeline />
        </div>
      </div>

      {/* Right Sidebar - Properties - 300px fixed */}
      <div className="w-[300px] flex-shrink-0">
        <PropertiesPanel />
      </div>
    </div>
  );
}

export default App;

