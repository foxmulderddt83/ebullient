#!/usr/bin/env node

/**
 * Compress and optimize images in Supabase storage
 * Reduces file sizes and improves Lighthouse performance scores
 */

const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function compressImage(buffer, format = 'jpeg') {
  try {
    let pipeline = sharp(buffer);

    // Get metadata to check current size
    const metadata = await sharp(buffer).metadata();

    // Resize if too large
    if (metadata.width > 1920) {
      pipeline = pipeline.resize(1920, 1080, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Compress based on format
    if (format === 'jpeg' || format === 'jpg') {
      pipeline = pipeline.jpeg({ quality: 80, progressive: true });
    } else if (format === 'png') {
      pipeline = pipeline.png({ compressionLevel: 9 });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality: 80 });
    }

    return await pipeline.toBuffer();
  } catch (error) {
    log.error(`Failed to compress image: ${error.message}`);
    return null;
  }
}

async function getFilesFromBucket(bucket) {
  try {
    const { data, error } = await supabase.storage.from(bucket).list('', {
      limit: 1000,
      offset: 0
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    log.error(`Failed to list files from ${bucket}: ${error.message}`);
    return [];
  }
}

async function compressSupabaseImages() {
  log.section('Supabase Image Compression');

  const buckets = ['media', 'public', 'video-shoot', 'scenic-tour'];
  let totalSavings = 0;
  let filesProcessed = 0;

  for (const bucket of buckets) {
    try {
      log.info(`Scanning bucket: ${bucket}`);
      const files = await getFilesFromBucket(bucket);

      if (files.length === 0) {
        log.warn(`No files found in bucket: ${bucket}`);
        continue;
      }

      for (const file of files) {
        // Skip non-image files
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const fileExt = path.extname(file.name).toLowerCase();
        if (!imageExtensions.includes(fileExt)) continue;

        try {
          // Download file
          const { data, error: downloadError } = await supabase.storage
            .from(bucket)
            .download(file.name);

          if (downloadError) {
            log.warn(`Failed to download ${file.name}: ${downloadError.message}`);
            continue;
          }

          const buffer = await data.arrayBuffer();
          const originalSize = buffer.byteLength;

          // Compress
          const compressedBuffer = await compressImage(buffer, fileExt.slice(1));
          if (!compressedBuffer) continue;

          const compressedSize = compressedBuffer.length;
          const savings = originalSize - compressedSize;

          if (savings > 0) {
            // Upload compressed version
            const { error: uploadError } = await supabase.storage
              .from(bucket)
              .update(file.name, compressedBuffer, {
                cacheControl: '31536000',
                upsert: true,
                contentType: `image/${fileExt.slice(1)}`
              });

            if (uploadError) {
              log.warn(`Failed to upload compressed ${file.name}: ${uploadError.message}`);
              continue;
            }

            const savingsKb = (savings / 1024).toFixed(2);
            const originalKb = (originalSize / 1024).toFixed(2);
            const compressedKb = (compressedSize / 1024).toFixed(2);

            log.success(`${file.name}: ${originalKb}KB → ${compressedKb}KB (saved ${savingsKb}KB)`);
            totalSavings += savings;
            filesProcessed++;
          } else {
            log.info(`${file.name}: Already optimized`);
          }
        } catch (error) {
          log.error(`Error processing ${file.name}: ${error.message}`);
        }
      }
    } catch (error) {
      log.error(`Error processing bucket ${bucket}: ${error.message}`);
    }
  }

  log.section('Compression Summary');
  log.success(`Files processed: ${filesProcessed}`);
  log.success(`Total savings: ${(totalSavings / 1024 / 1024).toFixed(2)}MB`);
}

// Run compression
compressSupabaseImages().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
