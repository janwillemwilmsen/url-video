const express = require('express');
const router = express.Router();
const { Action, ActionItem } = require('../models');
const scraper = require('../services/scraper');
const veo3 = require('../services/veo3');
const videoProcessor = require('../services/videoProcessor');
const path = require('path');
const fs = require('fs');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
};

router.use(isAuthenticated);

// Create new action
router.post('/', async (req, res) => {
    try {
        const { name, url } = req.body;
        const action = await Action.create({
            name,
            url,
            UserId: req.user.id,
            status: 'created'
        });

        // Create folder
        const folderPath = path.join(__dirname, '../../storage/actions', action.id.toString());
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            fs.mkdirSync(path.join(folderPath, 'raw'));
            fs.mkdirSync(path.join(folderPath, 'videos'));
        }

        action.folderPath = folderPath;
        await action.save();

        res.redirect(`/actions/${action.id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating action');
    }
});

// Get specific action (The main workspace)
router.get('/:id', async (req, res) => {
    try {
        const action = await Action.findOne({
            where: { id: req.params.id, UserId: req.user.id },
            include: [ActionItem]
        });

        if (!action) return res.status(404).send('Action not found');

        res.render('action_steps', { action, user: req.user });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching action');
    }
});

// Trigger Scrape (Step 1)
router.post('/:id/scrape', async (req, res) => {
    try {
        const action = await Action.findByPk(req.params.id);
        // Async scraping
        scraper.scrapeImages(action).then(() => {
            console.log(`Scraping completed for action ${action.id}`);
        }).catch(err => console.error(err));

        action.status = 'scraping';
        await action.save();

        res.json({ success: true, message: 'Scraping started' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get Action Items (for polling or initial load)
router.get('/:id/items', async (req, res) => {
    try {
        const items = await ActionItem.findAll({ where: { ActionId: req.params.id } });
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle Selection (Step 2)
router.post('/:id/items/:itemId/toggle', async (req, res) => {
    try {
        const item = await ActionItem.findOne({
            where: { id: req.params.itemId, ActionId: req.params.id }
        });
        item.selected = !item.selected;
        await item.save();
        res.json({ success: true, selected: item.selected });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Convert Selected Images (Step 3)
router.post('/:id/convert', async (req, res) => {
    try {
        const action = await Action.findByPk(req.params.id);
        const items = await ActionItem.findAll({
            where: { ActionId: action.id, selected: true, type: 'image' }
        });

        if (items.length === 0) return res.status(400).json({ error: 'No images selected' });

        action.status = 'processing';
        await action.save();

        // Process in background
        (async () => {
            for (const item of items) {
                try {
                    const videoPath = await veo3.generateVideo(item, 'Default prompt');
                    await ActionItem.create({
                        ActionId: action.id,
                        type: 'video',
                        path: videoPath,
                        metadata: { sourceImageId: item.id }
                    });
                } catch (e) {
                    console.error('Conversion failed for item', item.id, e);
                }
            }
            action.status = 'completed'; // or 'ready_to_join'
            await action.save();
        })();

        res.json({ success: true, message: 'Conversion started' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Join Videos (Step 5)
router.post('/:id/join', async (req, res) => {
    try {
        const action = await Action.findByPk(req.params.id);
        const videos = await ActionItem.findAll({
            where: { ActionId: action.id, type: 'video' }
        });

        if (videos.length === 0) return res.status(400).json({ error: 'No videos to join' });

        const outputPath = path.join(action.folderPath, `final_${Date.now()}.mp4`);
        const videoPaths = videos.map(v => v.path);

        await videoProcessor.joinVideos(videoPaths, outputPath);

        res.json({ success: true, videoPath: `/storage/actions/${action.id}/${path.basename(outputPath)}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
