export interface MediaAsset {
  id: string;                    // Unique identifier
  type: 'video' | 'audio' | 'image';
  name: string;                  // Display name
  path: string;                  // Absolute file path (reference)
  duration: number;              // Seconds (0 for images)
  width: number;                 // Dimensions
  height: number;
  fileSize: number;              // Bytes
  thumbnail: string;             // Data URL or blob URL
  waveform?: number[];           // Audio visualization data
  createdAt: Date;
  source: 'imported' | 'recorded';
}

