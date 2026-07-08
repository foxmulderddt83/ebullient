#!/usr/bin/env node

/**
 * Comprehensive Image Compression & Optimization Script
 * Compresses all images locally and prepares for Supabase upload
 * Supports JPEG, PNG, WebP conversion and optimization
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, '../src/assets');
const PUBLIC_DIR = path.join(__dirname, '../public');
const OUTPUT_DIR = path.join(__dirname, '../dist-optimized');

// Color output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.blue}→ ${msg}${colors.reset}\n`)
};

// Ensure output directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Check if ImageMagick/ffmpeg is installed
function checkDependencies() {
  const deps = {
    'imagemagick': ['convert', '--version'],
    'ffmpeg': ['ffmpeg', '-version']
  };

  log.section('Checking Dependencies');

  for (const [dep, cmd] of Object.entries(deps)) {
    try {
      execSync(`${cmd.join(' ')}`, { stdio: 'pipe' });
      log.success(`${dep} installed`);
    } catch {
      log.warn(`${dep} not installed - some optimizations will be skipped`);
    }
  }
}

// Get file size in human readable format
function getFileSize(bytes) {
  const units = ['B', 'KB', 'MB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Calculate compression ratio
function getCompressionRatio(original, compressed) {
  return (((original - compressed) / original) * 100).toFixed(1);
}

// Compress JPEG images
function compressJPEG(inputPath, outputPath, quality = 70) {
  try {
    execSync(`convert "${inputPath}" -quality ${quality} -strip -interlace Plane "${outputPath}"`, {
      stdio: 'pipe'
    });
    return true;
  } catch {
    return false;
  }
}

// Compress PNG images
function compressPNG(inputPath, outputPath) {
  try {
    execSync(`convert "${inputPath}" -strip -quality 85 "${outputPath}"`, {
      stdio: 'pipe'
    });
    return true;
  } catch {
    return false;
  }
}

// Convert to WebP
function convertToWebP(inputPath, outputPath, quality = 80) {
  try {
    execSync(`cwebp -q ${quality} "${inputPath}" -o "${outputPath}"`, {
      stdio: 'pipe'
    });
    return true;
  } catch {
    // Fallback to ImageMagick if cwebp not available
    try {
      execSync(`convert "${inputPath}" -quality ${quality} "${outputPath}"`, {
        stdio: 'pipe'
      });
      return true;
    } catch {
      return false;
    }
  }
}

// Process images in directory
function processDirectory(sourceDir, destDir, quality = 70) {
  if (!fs.existsSync(sourceDir)) {
    log.warn(`Directory not found: ${sourceDir}`);
    return { total: 0, processed: 0, saved: 0, details: [] };
  }

  ensureDir(destDir);

  const files = fs.readdirSync(sourceDir);
  const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));

  let stats = { total: imageFiles.length, processed: 0, saved: 0, details: [] };

  for (const file of imageFiles) {
    const inputPath = path.join(sourceDir, file);
    const fileSize = fs.statSync(inputPath).size;

    // JPEG/PNG compression
    const ext = path.extname(file).toLowerCase();
    let outputPath = path.join(destDir, file);

    if (['.jpg', '.jpeg'].includes(ext)) {
      if (compressJPEG(inputPath, outputPath, quality)) {
        const newSize = fs.statSync(outputPath).size;
        const saved = fileSize - newSize;
        stats.saved += saved;
        stats.processed++;
        stats.details.push({
          file,
          original: getFileSize(fileSize),
          compressed: getFileSize(newSize),
          ratio: getCompressionRatio(fileSize, newSize)
        });
        log.success(`${file}: ${getFileSize(fileSize)} → ${getFileSize(newSize)} (${getCompressionRatio(fileSize, newSize)}% saved)`);
      }
    } else if (ext === '.png') {
      if (compressPNG(inputPath, outputPath)) {
        const newSize = fs.statSync(outputPath).size;
        const saved = fileSize - newSize;
        stats.saved += saved;
        stats.processed++;
        stats.details.push({
          file,
          original: getFileSize(fileSize),
          compressed: getFileSize(newSize),
          ratio: getCompressionRatio(fileSize, newSize)
        });
        log.success(`${file}: ${getFileSize(fileSize)} → ${getFileSize(newSize)} (${getCompressionRatio(fileSize, newSize)}% saved)`);
      }
    } else {
      // Copy without compression
      fs.copyFileSync(inputPath, outputPath);
      stats.processed++;
    }

    // WebP version
    const webpPath = path.join(destDir, `${path.parse(file).name}.webp`);
    if (convertToWebP(inputPath, webpPath, quality + 5)) {
      const webpSize = fs.statSync(webpPath).size;
      log.success(`  └─ WebP: ${getFileSize(webpSize)}`);
    }
  }

  return stats;
}

// Generate compression report
function generateReport(stats) {
  log.section('Compression Summary');

  if (stats.total === 0) {
    log.warn('No images found to compress');
    return;
  }

  console.log(`Total Files: ${stats.total}`);
  console.log(`Processed: ${stats.processed}/${stats.total}`);
  console.log(`${colors.green}Total Saved: ${getFileSize(stats.saved)}${colors.reset}`);

  if (stats.details.length > 0) {
    console.log('\nDetailed Results:');
    console.log('─'.repeat(70));
    stats.details.forEach(detail => {
      console.log(`${detail.file.padEnd(30)} ${detail.original.padEnd(12)} → ${detail.compressed.padEnd(12)} ${detail.ratio}%`);
    });
    console.log('─'.repeat(70));
  }
}

// Main execution
async function main() {
  console.log(`\n${colors.bright}${colors.blue}🚀 Image Compression & Optimization Tool${colors.reset}\n`);

  checkDependencies();

  log.section('Compressing Local Assets (src/assets)');
  const assetsStats = processDirectory(ASSETS_DIR, path.join(OUTPUT_DIR, 'assets'), 75);

  log.section('Compressing Public Assets (public)');
  const publicStats = processDirectory(PUBLIC_DIR, path.join(OUTPUT_DIR, 'public'), 70);

  // Combined stats
  const totalStats = {
    total: assetsStats.total + publicStats.total,
    processed: assetsStats.processed + publicStats.processed,
    saved: assetsStats.saved + publicStats.saved,
    details: [...assetsStats.details, ...publicStats.details]
  };

  generateReport(totalStats);

  log.section('Next Steps');
  console.log(`1. Review compressed files in: ${OUTPUT_DIR}`);
  console.log(`2. Upload compressed files to Supabase Storage`);
  console.log(`3. Update image references to use WebP with JPEG fallback`);
  console.log(`4. Test page load speed: npm run build && npm run preview`);
  console.log(`5. Run Lighthouse audit for performance metrics\n`);
}

main().catch(err => {
  log.error(`Error: ${err.message}`);
  process.exit(1);
});
