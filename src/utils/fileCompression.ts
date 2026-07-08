
/**
 * Utility for compressing files before upload.
 * Specifically targets images to ensure they are under 3MB.
 * Checks file size for other types (HTML).
 */

const MAX_IMAGE_SIZE_MB = 3;
const MAX_FILE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Compresses an image file to be under the target size.
 * Returns the original file if it's already small enough or not an image.
 * Throws an error if the file (after compression attempts) is still too large.
 */
export async function compressFile(file: File, addWatermark: boolean = false): Promise<File> {
  // 0. Global safety check: Absolute max file size (5MB) for ANY upload
  // The user explicitly requested "no 10MB file just 5MB max size"
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the ${MAX_FILE_SIZE_MB}MB limit.`);
  }

  // 1. Check if it's an image
  if (file.type.startsWith('image/')) {
    // If it's already small enough and no watermark needed, return it
    if (file.size <= MAX_IMAGE_SIZE_BYTES && !addWatermark) {
      return file;
    }
    return await compressImage(file, addWatermark);
  }

  // 2. For non-images (like HTML/PDF), check against general file size limit
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the ${MAX_FILE_SIZE_MB}MB limit.`);
  }

  return file;
}

async function compressImage(file: File, addWatermark: boolean = false): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Initial resizing if dimensions are huge (e.g. > 2000px)
      // This helps with performance and compression
      const MAX_DIMENSION = 2000;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Add watermark if requested
      if (addWatermark) {
        const watermarkText = "ONEDAYPILOT - FOR VERIFICATION ONLY";
        const fontSize = Math.max(20, Math.floor(width / 25));
        ctx.font = `bold ${fontSize}px Arial`;
        
        // Semi-transparent white background for text
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        const textMetrics = ctx.measureText(watermarkText);
        const textWidth = textMetrics.width;
        
        // Draw diagonal watermark multiple times
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = "center";
        
        // Fill pattern
        for (let x = -width; x < width; x += textWidth * 1.5) {
          for (let y = -height; y < height; y += fontSize * 4) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
            ctx.fillText(watermarkText, x, y);
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.fillText(watermarkText, x + 2, y + 2);
          }
        }
        ctx.restore();
      }

      // Attempt compression recursively
      // Start with 0.9 quality
      attemptCompression(canvas, file.name, file.type, 0.9, resolve, reject);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = url;
  });
}

function attemptCompression(
  canvas: HTMLCanvasElement, 
  fileName: string, 
  fileType: string, 
  quality: number,
  resolve: (file: File) => void,
  reject: (error: Error) => void
) {
  if (quality < 0.1) {
    reject(new Error(`Unable to compress image below ${MAX_IMAGE_SIZE_MB}MB even at lowest quality.`));
    return;
  }

  canvas.toBlob(
    (blob) => {
      if (!blob) {
        reject(new Error("Compression failed"));
        return;
      }

      if (blob.size <= MAX_IMAGE_SIZE_BYTES) {
        // Success!
        const compressedFile = new File([blob], fileName, {
          type: fileType,
          lastModified: Date.now(),
        });
        resolve(compressedFile);
      } else {
        // Try again with lower quality
        attemptCompression(canvas, fileName, fileType, quality - 0.1, resolve, reject);
      }
    },
    fileType,
    quality
  );
}
