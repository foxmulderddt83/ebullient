#!/usr/bin/env node

/**
 * Image Optimization Script using Sharp
 * Compresses images and generates WebP versions
 * No external dependencies required
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '../src/assets');
const PUBLIC_BG_DIR = path.join(__dirname, '../public/BG');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.blue}→ ${msg}${colors.reset}\n`)
};

function getFileSize(bytes) {
  const units = ['B', 'KB', 'MB'];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(2)} ${units[i]}`;
}

function getSavings(original, compressed) {
  return (((original - compressed) / original) * 100).toFixed(1);
}

async function optimizeImage(inputPath, outputPath) {
  try {
    const inputStats = fs.statSync(inputPath);
    const inputSize = inputStats.size;

    // Use temporary file first
    const tempPath = outputPath + '.tmp';

    // Detect image format
    const ext = path.extname(inputPath).toLowerCase();

    if (ext === '.jpg' || ext === '.jpeg') {
      await sharp(inputPath)
        .rotate()
        .jpeg({ quality: 75, progressive: true, mozjpeg: true })
        .toFile(tempPath);
    } else if (ext === '.png') {
      await sharp(inputPath)
        .png({ quality: 85, progressive: true, compressionLevel: 9 })
        .toFile(tempPath);
    } else {
      return null;
    }

    // Replace original with optimized version
    if (fs.existsSync(tempPath)) {
      fs.copyFileSync(tempPath, outputPath);
      fs.unlinkSync(tempPath);
    }

    const outputStats = fs.statSync(outputPath);
    const outputSize = outputStats.size;

    return {
      original: inputSize,
      compressed: outputSize,
      saved: inputSize - outputSize,
      percent: getSavings(inputSize, outputSize)
    };
  } catch (error) {
    log.warn(`Failed to optimize ${inputPath}: ${error.message}`);
    return null;
  }
}

async function generateWebP(inputPath, outputPath) {
  try {
    const inputStats = fs.statSync(inputPath);

    await sharp(inputPath)
      .rotate()
      .webp({ quality: 80 })
      .toFile(outputPath);

    const outputStats = fs.statSync(outputPath);

    return {
      inputSize: inputStats.size,
      webpSize: outputStats.size,
      percent: getSavings(inputStats.size, outputStats.size)
    };
  } catch (error) {
    log.warn(`Failed to generate WebP for ${inputPath}: ${error.message}`);
    return null;
  }
}

async function processDirectory(sourceDir, name) {
  if (!fs.existsSync(sourceDir)) {
    log.warn(`${name} directory not found: ${sourceDir}`);
    return { total: 0, processed: 0, totalSaved: 0 };
  }

  log.section(`Processing ${name}`);

  const files = fs.readdirSync(sourceDir)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .sort();

  if (files.length === 0) {
    log.warn(`No images found in ${sourceDir}`);
    return { total: files.length, processed: 0, totalSaved: 0 };
  }

  let totalSaved = 0;
  let processed = 0;

  for (const file of files) {
    const inputPath = path.join(sourceDir, file);

    // Optimize original
    const result = await optimizeImage(inputPath, inputPath);
    if (result) {
      log.success(
        `${file}: ${getFileSize(result.original)} → ${getFileSize(result.compressed)} (${result.percent}% saved)`
      );
      totalSaved += result.saved;
      processed++;

      // Generate WebP
      const webpPath = path.join(sourceDir, `${path.parse(file).name}.webp`);
      const webpResult = await generateWebP(inputPath, webpPath);
      if (webpResult) {
        log.info(`  └─ WebP: ${getFileSize(webpResult.webpSize)} (${webpResult.percent}% smaller than original)`);
      }
    }
  }

  return {
    total: files.length,
    processed,
    totalSaved
  };
}

async function main() {
  console.log(`\n${colors.bright}${colors.blue}🎨 Image Optimization Tool (Sharp)${colors.reset}\n`);

  const assetsStats = await processDirectory(ASSETS_DIR, 'Local Assets (src/assets)');
  const publicStats = await processDirectory(PUBLIC_BG_DIR, 'Public Assets (public/BG)');

  log.section('Summary');
  console.log(`Assets processed: ${assetsStats.processed}/${assetsStats.total}`);
  console.log(`Public processed: ${publicStats.processed}/${publicStats.total}`);
  console.log(`${colors.green}Total saved: ${getFileSize(assetsStats.totalSaved + publicStats.totalSaved)}${colors.reset}`);

  log.section('Next Steps');
  console.log('1. Images optimized in-place');
  console.log('2. WebP versions created alongside originals');
  console.log('3. Update picture elements to use WebP with JPEG fallback:');
  console.log('   <picture>');
  console.log('     <source srcSet="/image.webp" type="image/webp" />');
  console.log('     <img src="/image.jpg" alt="..." />');
  console.log('   </picture>');
  console.log('4. Rebuild: npm run build');
  console.log('5. Check load time improvements\n');
}

main().catch(err => {
  console.error(`${colors.yellow}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
