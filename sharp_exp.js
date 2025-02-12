import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import { createObjectCsvWriter as csv } from 'csv-writer';

async function processImages(inputFolder, outputFolder, metricsPath) {
    try {
        await fs.mkdir(outputFolder, { recursive: true });

        const csvWriter = csv({
            path: metricsPath,
            header: [
                { id: 'filename', title: 'Filename' },
                { id: 'originalSize', title: 'Original Size (KB)' },
                { id: 'compressedSize', title: 'Compressed Size (KB)' },
                { id: 'compressionRatio', title: 'Compression Ratio (%)' },
                { id: 'originalFormat', title: 'Original Format' },
                { id: 'processingTime', title: 'Processing Time (ms)' }
            ]
        });

        const files = await fs.readdir(inputFolder);
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));

        const metrics = [];

        console.log(`Found ${imageFiles.length} images to process\n`);

        for (const file of imageFiles) {
            const startTime = Date.now();
            const inputPath = path.join(inputFolder, file);
            const fileExt = path.extname(file).toLowerCase();
            const fileName = path.basename(file, fileExt);
            const outputPath = path.join(outputFolder, `${fileName}${fileExt}`); // Keep original format

            try {
                // Get original file info
                const originalStats = await fs.stat(inputPath);
                const originalImage = sharp(inputPath);
                const originalInfo = await originalImage.metadata();

                // Preserve original format and apply lossless compression
                let optimizedImage;
                if (originalInfo.format === 'jpeg' || originalInfo.format === 'jpg') {
                    optimizedImage = originalImage.jpeg({
                        quality: 70, // No quality loss
                        progressive: true,
                        mozjpeg: true
                    });
                } else if (originalInfo.format === 'png') {
                    optimizedImage = originalImage.png({
                        compressionLevel: 3, // Maximum lossless compression
                        palette: true // Optimize palette-based PNGs
                    });
                } else if (originalInfo.format === 'webp') {
                    optimizedImage = originalImage.webp({
                        quality: 80,
                        lossless: true
                    });
                } else {
                    // If it's an unsupported format, just copy the file
                    await fs.copyFile(inputPath, outputPath);
                    console.log(`✓ Copied without modification: ${file}`);
                    continue;
                }

                // Save the optimized image
                await optimizedImage.toFile(outputPath);

                // Get compressed file stats
                const compressedStats = await fs.stat(outputPath);
                const processingTime = Date.now() - startTime;
                const originalSizeKB = originalStats.size / 1024;
                const compressedSizeKB = compressedStats.size / 1024;
                const compressionRatio = (compressedStats.size / originalStats.size) * 100;

                metrics.push({
                    filename: file,
                    originalSize: originalSizeKB.toFixed(2),
                    compressedSize: compressedSizeKB.toFixed(2),
                    compressionRatio: compressionRatio.toFixed(1),
                    originalFormat: originalInfo.format,
                    processingTime: processingTime
                });

                console.log(`✓ Processed: ${file}`);
                console.log(`  Original: ${originalSizeKB.toFixed(2)} KB`);
                console.log(`  Compressed: ${compressedSizeKB.toFixed(2)} KB`);
                console.log(`  Ratio: ${compressionRatio.toFixed(1)}%\n`);

            } catch (error) {
                console.error(`Error processing ${file}:`, error.message);
                metrics.push({
                    filename: file,
                    originalSize: 0,
                    compressedSize: 0,
                    compressionRatio: 0,
                    originalFormat: 'error',
                    processingTime: 0
                });
            }
        }

        await csvWriter.writeRecords(metrics);

        // Print summary
        const totalOriginal = metrics.reduce((sum, m) => sum + parseFloat(m.originalSize), 0);
        const totalCompressed = metrics.reduce((sum, m) => sum + parseFloat(m.compressedSize), 0);

        console.log('\nSummary:');
        console.log(`Total images processed: ${metrics.length}`);
        console.log(`Total original size: ${totalOriginal.toFixed(2)} KB`);
        console.log(`Total compressed size: ${totalCompressed.toFixed(2)} KB`);
        console.log(`Overall compression ratio: ${((totalCompressed / totalOriginal) * 100).toFixed(1)}%`);
        console.log(`Metrics saved to: ${metricsPath}`);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Configuration
const inputFolder = './image_for_metrics';
const outputFolder = './sharp_effort0_nonPixelPerfect_compression3ForPng_quality70';
const metricsPath = './sharp_effort0_nonPixelPerfect_compression3ForPng_quality70.csv';

processImages(inputFolder, outputFolder, metricsPath);
