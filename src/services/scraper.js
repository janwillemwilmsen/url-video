const puppeteer = require('puppeteer');
const { ActionItem } = require('../models');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const request = protocol.get(url, { timeout: 10000 }, (res) => {
            if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(filepath);
                res.pipe(fileStream);

                fileStream.on('error', (err) => {
                    fileStream.close();
                    fs.unlink(filepath, () => { }); // Delete partial file
                    reject(err);
                });

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve(filepath);
                });
            } else {
                res.resume(); // Consume response data to free up memory
                reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
            }
        });

        request.on('error', (err) => {
            fs.unlink(filepath, () => { }); // Delete partial file
            reject(err);
        });

        request.on('timeout', () => {
            request.destroy();
            fs.unlink(filepath, () => { }); // Delete partial file
            reject(new Error('Request timed out'));
        });
    });
};

exports.scrapeImages = async (action) => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    try {
        await page.goto(action.url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Scroll to load lazy images
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const maxScrolls = 100; // Limit scrolls to prevent infinite loops
                let scrolls = 0;

                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    scrolls++;

                    if (totalHeight >= scrollHeight - window.innerHeight || scrolls >= maxScrolls) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        const imageUrls = await page.evaluate(() => {
            return Array.from(document.images)
                .map(img => img.src) // img.src returns absolute URL by default in browsers
                .filter(src => src && (src.startsWith('http') || src.startsWith('https')));
        });

        // Deduplicate URLs
        const uniqueUrls = [...new Set(imageUrls)];

        const rawDir = path.join(action.folderPath, 'raw');

        let count = 0;
        for (const url of uniqueUrls) {
            // Limit to 20 images for demo purposes
            if (count >= 20) break;

            const filename = `image_${Date.now()}_${count}.jpg`;
            const filepath = path.join(rawDir, filename);

            try {
                await downloadImage(url, filepath);

                await ActionItem.create({
                    ActionId: action.id,
                    type: 'image',
                    path: filepath,
                    selected: false
                });
                count++;
            } catch (e) {
                console.error(`Failed to download ${url}:`, e.message);
            }
        }

        action.status = 'scraped';
        await action.save();

    } catch (error) {
        console.error('Scraping error:', error);
        throw error;
    } finally {
        await browser.close();
    }
};
