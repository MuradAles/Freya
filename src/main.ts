import { app, BrowserWindow, systemPreferences } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { setupFileHandlers } from './electron/ipc/fileHandlers';
import { setupExportHandlers } from './electron/ipc/exportHandlers';
import { setupRecordingHandlers } from './electron/ipc/recordingHandlers';
import { setupAIHandlers } from './electron/ipc/aiHandlers';
import { initMain } from 'electron-audio-loopback';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Initialize electron-audio-loopback for automatic system audio capture
// This must be called before app.whenReady()
initMain();
console.log('✅ electron-audio-loopback initialized');

// Enable system audio capture on Windows
// These flags enable loopback audio capture (system sounds)
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');

// Disable hardware media key handling to prevent conflicts
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

const createWindow = () => {
  // Check screen recording permissions (macOS)
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen');
    console.log('📹 Screen recording permission status:', status);
    if (status !== 'granted') {
      console.warn('⚠️  Screen recording permission not granted. Requesting...');
      // This will trigger a system dialog on macOS
    }
  }

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Freya',
    icon: path.join(__dirname, '../Freya.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Enable proper file system access
      sandbox: false,
      webSecurity: false, // Allow local file:// URLs for video playback
    },
  });

  // Set permissions for media access - GRANT ALL MEDIA PERMISSIONS
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    console.log('🔐 Permission requested:', permission);
    // Grant all media-related permissions for screen recording
    const allowedPermissions = ['media', 'mediaKeySystem', 'display-capture', 'screen'];
    if (allowedPermissions.includes(permission)) {
      console.log('✅ Granted permission:', permission);
      callback(true);
    } else {
      console.log('❌ Denied permission:', permission);
      callback(false);
    }
  });

  // Also handle permission checks (not requests)
  mainWindow.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
    console.log('🔍 Permission check:', permission);
    const allowedPermissions = ['media', 'mediaKeySystem', 'display-capture', 'screen'];
    return allowedPermissions.includes(permission);
  });

  // Modern Electron screen capture handler
  mainWindow.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
    console.log('📹 Display media request received');
    try {
      const { desktopCapturer } = await import('electron');
      const sources = await desktopCapturer.getSources({ 
        types: ['screen', 'window'],
        thumbnailSize: { width: 200, height: 200 }
      });
      
      console.log('📹 Available sources:', sources.length);
      
      // Grant access to the first screen by default
      // The actual source selection is done in the UI through the recording dialog
      const screenSource = sources.find(s => s.id.startsWith('screen:'));
      if (screenSource) {
        console.log('✅ Granting access to:', screenSource.name);
        // Try to enable system audio capture
        // Note: This may not work on all Windows systems without "Stereo Mix" or similar enabled
        try {
          callback({ video: screenSource, audio: 'loopback' as any });
        } catch (err) {
          console.warn('⚠️  Audio loopback not supported, granting video only');
          callback({ video: screenSource });
        }
      } else {
        console.error('❌ No screen sources available');
        callback({});
      }
    } catch (error) {
      console.error('❌ Error handling display media request:', error);
      callback({});
    }
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  // Note: You may see Autofill-related errors in console - these are harmless
  // and come from Chrome DevTools trying to use features not available in Electron
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
  setupFileHandlers();
  setupExportHandlers();
  setupRecordingHandlers();
  setupAIHandlers();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
