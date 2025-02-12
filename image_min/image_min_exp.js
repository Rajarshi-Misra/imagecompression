import path from 'path';
import fs from 'fs/promises';
import imagemin from 'imagemin';
import imageminWebp from 'imagemin-webp';
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
            const fileExt = path.extname(file);
            const fileName = path.basename(file, fileExt);
            const outputPath = path.join(outputFolder, `${fileName}_compressed.webp`);

            try {
                const originalStats = await fs.stat(inputPath);
                const originalSizeKB = originalStats.size / 1024;
                
                // Compress image using imagemin
                await imagemin([inputPath], {
                    destination: outputFolder,
                    plugins: [
                        imageminWebp({ quality: 100 })
                    ]
                });
                
                const compressedStats = await fs.stat(outputPath);
                const compressedSizeKB = compressedStats.size / 1024;
                const compressionRatio = (compressedSizeKB / originalSizeKB) * 100;
                const processingTime = Date.now() - startTime;
                
                metrics.push({
                    filename: file,
                    originalSize: originalSizeKB.toFixed(2),
                    compressedSize: compressedSizeKB.toFixed(2),
                    compressionRatio: compressionRatio.toFixed(1),
                    originalFormat: fileExt.slice(1),
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
const inputFolder = './image_for_metrics';    // Your input folder
const outputFolder = './compressed_images';     // Where compressed images will be saved
const metricsPath = './nonpixelperfectmetrics6imagemin.csv';     // Where the CSV will be saved

// Run the script
processImages(inputFolder, outputFolder, metricsPath);
