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
                { id: 'dimensions', title: 'Dimensions' },
                { id: 'quality', title: 'Quality Used' },
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
            const outputPath = path.join(outputFolder, `${fileName}${fileExt}`);

            try {
                const originalStats = await fs.stat(inputPath);
                const originalImage = sharp(inputPath);
                const originalInfo = await originalImage.metadata();

                const width = originalInfo.width;
                const height = originalInfo.height;

                // Initialize quality settings
                let quality = 80; // Start with 80% quality
                let compressionRatio = 100;
                let optimizedBuffer;
                let attempts = 0;
                const maxAttempts = 5;

                // Try different quality settings until we achieve desired compression
                while (compressionRatio > 80 && attempts < maxAttempts) {
                    let optimizedImage = originalImage
                        .withMetadata()
                        .resize(width, height, {
                            fit: 'fill',
                            withoutEnlargement: true
                        });

                    switch (originalInfo.format) {
                        case 'jpeg':
                        case 'jpg':
                            optimizedImage = optimizedImage.jpeg({
                                quality: quality,
                                progressive: true,
                                mozjpeg: true,
                                chromaSubsampling: '4:2:0', // Reduced color quality for better compression
                                force: true
                            });
                            break;
                        case 'png':
                            optimizedImage = optimizedImage.png({
                                compressionLevel: 9,
                                palette: true,
                                quality: quality,
                                colors: 128 // Reduced colors for better compression
                            });
                            break;
                        case 'webp':
                            optimizedImage = optimizedImage.webp({
                                quality: quality,
                                lossless: false,
                                nearLossless: false,
                                smartSubsample: true,
                                force: true
                            });
                            break;
                        default:
                            await fs.copyFile(inputPath, outputPath);
                            console.log(`✓ Copied without modification: ${file}`);
                            continue;
                    }

                    optimizedBuffer = await optimizedImage.toBuffer();
                    compressionRatio = (optimizedBuffer.length / originalStats.size) * 100;

                    if (compressionRatio > 80) {
                        quality = Math.max(quality - 10, 30); // Reduce quality but not below 30
                        attempts++;
                    }
                }

                // Save the final result
                await fs.writeFile(outputPath, optimizedBuffer);

                const compressedStats = await fs.stat(outputPath);
                const processingTime = Date.now() - startTime;
                const originalSizeKB = originalStats.size / 1024;
                const compressedSizeKB = compressedStats.size / 1024;
                const finalCompressionRatio = (compressedStats.size / originalStats.size) * 100;

                metrics.push({
                    filename: file,
                    originalSize: originalSizeKB.toFixed(2),
                    compressedSize: compressedSizeKB.toFixed(2),
                    compressionRatio: finalCompressionRatio.toFixed(1),
                    originalFormat: originalInfo.format,
                    dimensions: `${width}x${height}`,
                    quality: quality,
                    processingTime: processingTime
                });

                console.log(`✓ Processed: ${file}`);
                console.log(`  Original: ${originalSizeKB.toFixed(2)} KB`);
                console.log(`  Compressed: ${compressedSizeKB.toFixed(2)} KB`);
                console.log(`  Ratio: ${finalCompressionRatio.toFixed(1)}%`);
                console.log(`  Quality: ${quality}%`);
                console.log(`  Dimensions: ${width}x${height}\n`);

            } catch (error) {
                console.error(`Error processing ${file}:`, error.message);
                metrics.push({
                    filename: file,
                    originalSize: 0,
                    compressedSize: 0,
                    compressionRatio: 0,
                    originalFormat: 'error',
                    dimensions: 'unknown',
                    quality: 0,
                    processingTime: 0
                });
            }
        }

        await csvWriter.writeRecords(metrics);

        const totalOriginal = metrics.reduce((sum, m) => sum + parseFloat(m.originalSize), 0);
        const totalCompressed = metrics.reduce((sum, m) => sum + parseFloat(m.compressedSize), 0);
        const successfulProcesses = metrics.filter(m => m.originalFormat !== 'error').length;

        console.log('\nSummary:');
        console.log(`Total images processed: ${metrics.length}`);
        console.log(`Successful processes: ${successfulProcesses}`);
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
const outputFolder = './compressed_images_compression80';
const metricsPath = './compression_metrics_compression80.csv';

processImages(inputFolder, outputFolder, metricsPath);