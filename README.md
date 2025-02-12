## Understanding the naming of files

`sharp` contains scripts for image compression using sharp library
`image_min` contains scripts for image compression using imagemin library
`metrics` contains csv files with data on the compressed image size and quality
`compressed_images` contains the compressed 
The naming of the files are as per the various parameters used in the files
## Extra notes and observations

1. The size of sharp library is larger than image_min library
2. A lot of images are quite well compressed today from phones(check the highly detailed night sky image), so the image compression algorithms don't work well
3. Other alternatives include libraries that make thid-party API calls.