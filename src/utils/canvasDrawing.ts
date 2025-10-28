/**
 * Canvas drawing utilities for high-quality video rendering
 */

/**
 * Check if a point is within a resize handle
 */
export const isPointInHandle = (x: number, y: number, handleX: number, handleY: number, handleSize: number = 14) => {
  return x >= handleX - handleSize / 2 && x <= handleX + handleSize / 2 &&
         y >= handleY - handleSize / 2 && y <= handleY + handleSize / 2;
};

/**
 * Draw video with ultra high-quality step-down scaling
 * Uses cached temporary canvases for performance when downscaling significantly
 */
export const drawVideoHighQuality = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  cacheKey: string,
  tempCanvasCache: Map<string, HTMLCanvasElement>
) => {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  // Calculate scale ratio
  const scaleRatio = Math.min(dw / sourceWidth, dh / sourceHeight);

  // If scaling down significantly (less than 50%), use step-down scaling
  if (scaleRatio < 0.5 && sourceWidth > 0 && sourceHeight > 0) {
    // Calculate intermediate dimensions (step down by halves)
    let currentWidth = sourceWidth;
    let currentHeight = sourceHeight;

    // Keep halving until we're close to target size
    while (currentWidth / 2 > dw && currentHeight / 2 > dh) {
      currentWidth = Math.floor(currentWidth / 2);
      currentHeight = Math.floor(currentHeight / 2);
    }

    // Create cache key with dimensions
    const fullCacheKey = `${cacheKey}_${currentWidth}x${currentHeight}`;

    // Get or create cached canvas
    let tempCanvas = tempCanvasCache.get(fullCacheKey);

    if (!tempCanvas) {
      // Create new canvas and cache it
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = currentWidth;
      tempCanvas.height = currentHeight;
      tempCanvasCache.set(fullCacheKey, tempCanvas);
    }

    const tempCtx = tempCanvas.getContext('2d', { alpha: false });

    if (!tempCtx) {
      // Fallback to direct drawing
      ctx.drawImage(video, 0, 0, sourceWidth, sourceHeight, dx, dy, dw, dh);
      return;
    }

    // First step: draw video to temp canvas at intermediate size
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(video, 0, 0, currentWidth, currentHeight);

    // Second step: draw from temp canvas to final destination
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tempCanvas, 0, 0, currentWidth, currentHeight, dx, dy, dw, dh);
  } else {
    // Direct drawing for upscaling or minor downscaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, sourceWidth, sourceHeight, dx, dy, dw, dh);
  }
};
