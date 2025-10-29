# Freya - Technical Context

## Technology Stack

### Core Framework
- **Electron 38.4.0** - Desktop application framework
  - Main process for system access
  - Renderer process for React UI
  - IPC for communication
  - Bundled with Electron Forge
  
- **React 19.2.0** - UI library
  - Functional components with hooks
  - TypeScript for type safety
  - Vite for build tooling

### Build Tools
- **Vite 5.4.21** - Fast build tool
  - Hot module replacement (HMR)
  - TypeScript compilation
  - Asset bundling
  
- **Electron Forge 7.10.2** - Electron packaging
  - Generates .dmg (Mac), .exe (Windows)
  - Bundles FFmpeg binary
  - Creates installers

### State Management
- **Zustand 5.0.8** - Lightweight state management
  - Simple API (no boilerplate)
  - Built-in persist middleware (localStorage)
  - No context providers needed

### Media Processing
- **fluent-ffmpeg 2.1.3** - FFmpeg wrapper
  - Video encoding/decoding
  - Audio processing
  - Filter application (speed, volume, fade)
  
- **@ffmpeg-installer/ffmpeg 1.1.0** - FFmpeg binary bundling
  - Auto-detects platform
  - Bundles correct binary
  - Sets path in fluent-ffmpeg

- **@ffprobe-installer/ffprobe 2.1.2** - FFprobe binary
  - Metadata extraction
  - Video/audio analysis

### UI Components
- **Tailwind CSS 4.1.16** - Utility-first CSS framework
  - Dark theme by default
  - Responsive utilities
  - Custom color palette
  
- **lucide-react 0.548.0** - Icon library
  - SVG icons
  - Tree-shakeable
  - Consistent style

### Audio Visualization
- **wavesurfer.js 7.11.1** - Waveform rendering
  - Audio waveform visualization
  - Scrub bar interaction
  - Timeline audio display

### Audio Capture
- **electron-audio-loopback 1.0.6** - System audio capture
  - Automatic system audio capture on Windows
  - No manual "Stereo Mix" configuration needed
  - Intercepts getDisplayMedia calls
  - Enables loopback audio capture

### TypeScript
- **TypeScript ~4.5.4** - Static typing
  - Strict mode enabled
  - Interfaces for all data structures
  - Type inference for cleaner code

## Development Environment

### Node.js & Package Management
- **Node.js** - Latest LTS version
- **npm** - Package manager (lock file included)
- **Package Install Command:**
  ```bash
  npm install
  ```

### Development Commands
```bash
# Start development server
npm start
# → Runs Electron with HMR
# → Opens app window
# → Hot reload on file changes

# Lint code
npm run lint
# → ESLint check
# → TypeScript validation

# Package app
npm run package
# → Builds production version
# → Creates .dmg (Mac) or .exe (Windows)
```

### Project Structure

**Root Files:**
```
Freya/
├── forge.config.ts       # Electron Forge configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript config
├── vite.main.config.ts   # Vite config for main process
├── vite.renderer.config.ts  # Vite config for renderer
├── tailwind.config.js    # Tailwind config
└── index.html            # Entry HTML file
```

**Source Files:**
```
src/
├── App.tsx              # Root React component
├── main.ts              # Electron main process entry
├── preload.ts           # Preload script (IPC bridge)
├── renderer.tsx         # React entry point
├── index.css            # Global styles
│
├── components/          # React components
│   ├── Sidebar/
│   ├── Preview/
│   ├── Timeline/
│   └── Properties/
│
├── store/               # Zustand stores
│   ├── mediaStore.ts
│   ├── timelineStore.ts
│   └── uiStore.ts
│
├── types/               # TypeScript definitions
│   ├── media.ts
│   ├── timeline.ts
│   └── electron.d.ts
│
├── utils/               # Utility functions
│   ├── fileHandling.ts
│   └── thumbnailGenerator.ts
│
├── hooks/               # Custom React hooks
└── electron/            # Electron-specific code
    └── ipc/
        └── fileHandlers.ts
```

## Dependencies Overview

### Production Dependencies
```json
{
  "@ffmpeg-installer/ffmpeg": "^1.1.0",
  "@ffprobe-installer/ffprobe": "^2.1.2",
  "fluent-ffmpeg": "^2.1.3",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "zustand": "^5.0.8",
  "tailwindcss": "^4.1.16",
  "lucide-react": "^0.548.0",
  "wavesurfer.js": "^7.11.1"
}
```

### Development Dependencies
```json
{
  "@electron-forge/cli": "^7.10.2",
  "@electron-forge/plugin-vite": "^7.10.2",
  "electron": "38.4.0",
  "vite": "^5.4.21",
  "typescript": "~4.5.4",
  "@typescript-eslint/*": "^5.62.0",
  "eslint": "^8.57.1"
}
```

## File Paths & References

### Absolute vs Relative Paths

**Problem:** Files are referenced by absolute path on user's system
- Example: `C:\Users\username\Videos\clip.mp4`
- Windows: `C:\...`
- Mac: `/Users/...`

**Solution:** Store absolute paths, validate on import
```typescript
interface MediaAsset {
  path: string;  // Absolute path
  // ...
}
```

### Thumbnail Storage

**Current:** Data URLs (base64) in localStorage
```typescript
thumbnail: string;  // "data:image/png;base64,iVBORw0KG..."
```

**Pros:** Simple, persistent, no filesystem
**Cons:** localStorage size limit (5-10MB)
**Future:** Consider IndexedDB for larger storage

## IPC Communication Patterns

### Exposed APIs (preload.ts)

```typescript
window.electronAPI = {
  // File operations
  dialogOpenFile: () => ipcRenderer.invoke('dialog:openFile'),
  
  // Recording
  getRecordingSources: () => ipcRenderer.invoke('recording:getSources'),
  saveRecording: (blobData, filePath) => ipcRenderer.invoke('recording:saveFile', blobData, filePath),
  showRecordingSaveDialog: (defaultFilename) => ipcRenderer.invoke('recording:showSaveDialog', defaultFilename),
  convertRecordingToMP4: (webmPath, mp4Path, quality, frameRate) => 
    ipcRenderer.invoke('recording:convertToMP4', webmPath, mp4Path, quality, frameRate),
  
  // System audio loopback
  enableLoopbackAudio: () => ipcRenderer.invoke('enable-loopback-audio'),
  disableLoopbackAudio: () => ipcRenderer.invoke('disable-loopback-audio'),
  
  // Export
  exportVideo: (timeline, path, settings) => 
    ipcRenderer.invoke('export:start', timeline, path, settings),
  
  // Event listeners
  on: (channel, callback) => ipcRenderer.on(channel, (_, ...args) => callback(...args)),
  off: (channel, callback) => ipcRenderer.removeListener(channel, callback),
};
```

### IPC Handlers (main.ts)

```typescript
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Media', extensions: ['mp4', 'mov', 'webm', 'mp3', 'wav'] }]
  });
  return result.filePaths;
});
```

## FFmpeg Integration

### Setup

```typescript
// In main process
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
```

### Recording Conversion Pipeline

```typescript
// Convert WebM recording to MP4 with quality options
ipcMain.handle('recording:convertToMP4', async (event, webmPath, mp4Path, quality, frameRate) => {
  const crfMap = {
    high: '18',    // Visually lossless
    medium: '23',  // High quality (default)
    low: '28'      // Good quality, smaller files
  };
  
  return new Promise((resolve) => {
    ffmpeg(webmPath)
      .output(mp4Path)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset', 'fast',           // Fast encoding
        '-crf', crfMap[quality],     // Quality setting
        '-r', frameRate.toString(),  // Frame rate constraint
        '-movflags', '+faststart',   // Web-optimized majest
        '-threads', '0'              // Use all CPU cores
      ])
      .on('progress', (progress) => {
        event.sender.send('recording:compressionProgress', progress.percent);
      })
      .on('end', () => resolve({ success: true }))
      .run();
  });
});
```

### Export Pipeline

```typescript
async function exportTimeline(timeline, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoFile)
      .videoFilters('scale=1920:1080')
      .outputOptions('-c:v libx264')
      .outputOptions('-preset medium')
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', reject);
  });
}
```

### FFmpeg Filters

**Speed (2x):**
```bash
-filter:v "setpts=0.5*PTS"
```

**Volume (150%):**
```bash
-af "volume=1.5"
```

**Fade (2 seconds):**
```bash
-vf "fade=in:0:60"
```

## Build & Packaging

### Development Build

```bash
npm start
# → Runs vite dev server
# → Electron launches window
# → Hot module replacement
# → Fast refresh on changes
```

### Production Build

```bash
npm run package
# → Compiles TypeScript
# → Bundles JavaScript
# → Copies assets
# → Packages Electron app
# → Output: dist/ folder
```

### Packaging Targets

**Supported Platforms:**
- Windows (.exe)
- macOS (.dmg)
- Linux (.deb, .rpm)

**Package Size:**
- Target: < 200 MB
- FFmpeg binary: ~100 MB
- Electron runtime: ~50 MB
- App code: ~10 MB
- React bundle: ~2 MB

## Performance Considerations

### Memory Management
- **Media files:** Only paths stored, not content
- **Thumbnails:** Base64 strings in localStorage
- **Timeline:** Clips are lightweight objects
- **Preview:** HTML5 video element handles buffering

### Bundle Size
- **Tree shaking:** Only import used icons from lucide
- **Code splitting:** Each store is separate import
- **Asset optimization:** Thumbnails compressed

### Runtime Performance
- **React rendering:** Minimize re-renders with memo
- **Thumbnail generation:** Async, don't block UI
- **Timeline rendering:** Virtual scrolling for >50 clips
- **Export:** Background process, don't block UI

## Technical Constraints

### Platform Limits
- **Windows:** Path length limits (260 chars)
- **macOS:** Sandbox permissions for file access
- **Linux:** FFmpeg dependencies vary by distro

### Electron Limits
- **IPC serialization:** Only JSON-serializable data
- **File access:** Security restrictions in renderer
- **Bundle size:** FFmpeg adds significant size

### Browser Limits (Renderer)
- **localStorage:** 5-10MB per origin
- **File API:** CORS restrictions (not applicable in Electron)
- **Media APIs:** getUserMedia, MediaRecorder standard

## Known Issues & Workarounds

### Development
1. **Autofill errors in DevTools**
   - **Issue:** Console errors from Autofill
   - **Workaround:** Comment out `openDevTools()` in main.ts
   - **Impact:** None (dev-only)

2. **Hot reload slow for large components**
   - **Issue:** Re-rendering entire app on save
   - **Workaround:** Use React Fast Refresh (already enabled)
   - **Impact:** Acceptable for this project size

### Production
1. **FFmpeg binary size**
   - **Issue:** Large file increases app size
   - **Workaround:** Already using bundled binary
   - **Future:** Consider server-side FFmpeg (out of scope)

2. **localStorage limits with many files**
   - **Issue:** Thumbnails might fill localStorage
   - **Workaround:** None yet (address if occurs)
   - **Future:** IndexedDB or file-based thumbnails

## Security Considerations

### IPC Security
- **Context isolation:** Enabled by default
- **Preload script:** Only exposes needed APIs
- **No eval:** Strict mode prevents code injection

### File Access
- **Dialog-based:** User must explicitly select files
- **Absolute paths:** Validate before accessing
- **Sandboxing:** Electron security best practices

### Export Security
- **Path validation:** User-selected output paths
- **Error handling:** Don't overwrite important files
- **Progress feedback:** User can cancel export

## Development Workflow

### Typical Session
1. `npm start` - Launch dev server
2. Make changes to components
3. See HMR update in Electron window
4. Test functionality
5. Check console for errors
6. Repeat

### Debugging
- **DevTools:** Open in Electron (or comment out)
- **Console logs:** Useful for IPC debugging
- **React DevTools:** Install browser extension

### Git Integration
- **Ignore:** `dist/`, `node_modules/`, `.vite/`
- **Track:** All source files, configs, tasks/
- **Commits:** Small, frequent commits

## Future Technical Debt

1. **Performance optimization:** Virtual scrolling for timeline
2. **Error boundaries:** Add React error boundaries
3. **Testing:** Unit tests for stores, integration tests
4. **Documentation:** API docs, component docs
5. **Accessibility:** ARIA labels, keyboard navigation

