export async function generateThumbnail(filePath: string, type: 'video' | 'audio' | 'image'): Promise<string> {
  return new Promise((resolve) => {
    // Normalize file path for Windows - replace backslashes with forward slashes
    let normalizedPath = filePath.replace(/\\/g, '/');
    
    // For Windows absolute paths, ensure it starts with / after file:///
    // file:///C:/path/to/file
    const fileUrl = `file:///${normalizedPath}`;
    
    if (type === 'image') {
      // For images, use the file URL directly
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = fileUrl;
      
      img.onload = () => {
        // Create a canvas to resize the image to thumbnail size
         const canvas = document.createElement('canvas');
         const maxWidth = 400;
         const maxHeight = 400;
        
        let { width, height } = img;
        
        // Calculate the dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = (height / width) * maxWidth;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width / height) * maxHeight;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        } else {
          console.error('❌ Canvas context failed');
          resolve('');
        }
      };
      
      img.onerror = (e) => {
        console.error('❌ Image load error:', e);
        console.error('  URL:', fileUrl);
        resolve('');
      };
      
      // Timeout after 5 seconds
      setTimeout(() => {
        resolve('');
      }, 5000);
    } else if (type === 'video') {
      // For videos, extract first frame
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.crossOrigin = 'anonymous';
      video.src = fileUrl;
      
      video.onloadedmetadata = () => {
        video.currentTime = 0.1; // Seek to 0.1 seconds
      };
      
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 400;
          canvas.height = video.videoHeight || 300;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          } else {
            console.error('❌ Canvas context failed for video');
            resolve('');
          }
        } catch (error) {
          console.error('❌ Video thumbnail error:', error);
          resolve('');
        }
      };
      
      video.onerror = (e) => {
        console.error('❌ Video load error:', e);
        console.error('  URL:', fileUrl);
        resolve('');
      };
      
      // Timeout after 5 seconds
      setTimeout(() => {
        resolve('');
      }, 5000);
    } else {
      // For audio, create a simple waveform placeholder
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Simple audio waveform visualization
        ctx.fillStyle = '#8B5CF6';
        const centerY = canvas.height / 2;
        
        for (let i = 0; i < 20; i++) {
          const x = (i / 20) * canvas.width;
          const height = Math.random() * 40 + 10;
          ctx.fillRect(x, centerY - height / 2, 8, height);
        }
        
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve('');
      }
    }
  });
}

export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    // Normalize path for Windows
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fileUrl = `file:///${normalizedPath}`;
    
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.src = fileUrl;
    
    video.onloadedmetadata = () => {
      resolve(video.duration || 0);
    };
    
    video.onerror = () => {
      resolve(0);
    };
    
    // Timeout
    setTimeout(() => {
      resolve(0);
    }, 5000);
  });
}

