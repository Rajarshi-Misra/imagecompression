import path from 'path';
import fs from 'fs/promises';
import imagemin from 'imagemin';
import imageminWebp from 'imagemin-webp';
import imageminPngquant from 'imagemin-pngquant';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminGifsicle from 'imagemin-gifsicle';
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
                { id: 'finalFormat', title: 'Final Format' },
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
            
            try {
                const originalStats = await fs.stat(inputPath);
                const originalSizeKB = originalStats.size / 1024;
                
                // Determine optimal plugins based on input format
                let plugins = [];
                let outputFormat = fileExt;
                
                switch (fileExt) {
                    case '.jpg':
                    case '.jpeg':
                        plugins = [
                            imageminMozjpeg({
                                quality: 100,
                                progressive: true,
                                arithmetic: false
                            })
                        ];
                        break;
                    case '.png':
                        plugins = [
                            imageminPngquant({
                                quality: [1, 1], // Force 100% quality
                                speed: 1, // Highest quality setting
                                strip: false, // Preserve metadata
                                dithering: false // Prevent color artifacts
                            })
                        ];
                        break;
                    case '.gif':
                        plugins = [
                            imageminGifsicle({
                                optimizationLevel: 3,
                                colors: 256
                            })
                        ];
                        break;
                    case '.webp':
                        plugins = [
                            imageminWebp({
                                quality: 100,
                                method: 6, // Highest quality encoding
                                exact: true, // Preserve exact colors
                                lossless: true
                            })
                        ];
                        break;
                }

                const outputPath = path.join(outputFolder, `${fileName}${outputFormat}`);
                
                // Process the image
                const processedBuffer = await imagemin([inputPath], {
                    destination: outputFolder,
                    plugins: plugins
                });

                // Compare sizes and keep original if processed is larger
                const compressedStats = await fs.stat(outputPath);
                if (compressedStats.size > originalStats.size) {
                    await fs.copyFile(inputPath, outputPath);
                    console.log(`ℹ Kept original for ${file} (optimization would increase size)`);
                }

                const finalStats = await fs.stat(outputPath);
                const compressedSizeKB = finalStats.size / 1024;
                const compressionRatio = (compressedSizeKB / originalSizeKB) * 100;
                const processingTime = Date.now() - startTime;
                
                metrics.push({
                    filename: file,
                    originalSize: originalSizeKB.toFixed(2),
                    compressedSize: compressedSizeKB.toFixed(2),
                    compressionRatio: compressionRatio.toFixed(1),
                    originalFormat: fileExt.slice(1),
                    finalFormat: outputFormat.slice(1),
                    processingTime: processingTime
                });

                console.log(`✓ Processed: ${file}`);
                console.log(`  Original: ${originalSizeKB.toFixed(2)} KB`);
                console.log(`  Compressed: ${compressedSizeKB.toFixed(2)} KB`);
                console.log(`  Ratio: ${compressionRatio.toFixed(1)}%`);
                console.log(`  Format: ${fileExt.slice(1)} → ${outputFormat.slice(1)}\n`);
            } catch (error) {
                console.error(`Error processing ${file}:`, error.message);
                metrics.push({
                    filename: file,
                    originalSize: 0,
                    compressedSize: 0,
                    compressionRatio: 0,
                    originalFormat: 'error',
                    finalFormat: 'error',
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
const outputFolder = './image_min_forced';
const metricsPath = './image_min_forced.csv';

processImages(inputFolder, outputFolder, metricsPath);