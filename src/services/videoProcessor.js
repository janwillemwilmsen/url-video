const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

exports.joinVideos = (videoPaths, outputPath) => {
    return new Promise((resolve, reject) => {
        if (videoPaths.length === 0) return reject(new Error('No videos to join'));

        const command = ffmpeg();

        videoPaths.forEach(videoPath => {
            command.input(videoPath);
        });

        command
            .on('error', (err) => {
                console.error('An error occurred: ' + err.message);
                reject(err);
            })
            .on('end', () => {
                console.log('Merging finished !');
                resolve(outputPath);
            })
            .mergeToFile(outputPath, path.dirname(outputPath)); // temp folder for merge
    });
};

// Helper to create a video from an image (since VEO 3 is mocked)
exports.createVideoFromImage = (imagePath, outputPath, duration = 3) => {
    return new Promise((resolve, reject) => {
        ffmpeg(imagePath)
            .loop(duration)
            .outputOptions([
                '-c:v libx264',
                '-t ' + duration,
                '-pix_fmt yuv420p',
                '-vf scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2'
            ])
            .save(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err));
    });
};
