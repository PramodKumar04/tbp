const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const OptimizationData = require('../models/OptimizationData');
const auth = require('../middleware/auth');
const { getPortName, getPlantName, getRouteAlternatives } = require('../utils/locationService');

// 📁 Upload directory setup
const uploadDir = path.join(process.cwd(), 'backend', 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 📦 Multer config
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 🚀 Upload Route (Protected)
router.post('/upload', auth, upload.single('file'), async (req, res) => {
    console.log("🔥 Upload route hit");

    try {
        const { type } = req.body;

        if (!type) {
            return cleanupAndRespond(res, req.file, 400, 'Type is required');
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log(`📄 File received: ${req.file.originalname}`);
        console.log(`👤 User: ${req.userId}`);

        const ext = path.extname(req.file.originalname).toLowerCase();
        let results = [];

        // 📊 Handle CSV
        if (ext === '.csv') {
            results = await parseCSV(req.file.path);
        }

        // 📊 Handle Excel
        else if (ext === '.xlsx' || ext === '.xls') {
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            results = xlsx.utils.sheet_to_json(worksheet);
        }

        else {
            return cleanupAndRespond(res, req.file, 400, 'Unsupported file format');
        }

        // 💾 Save to DB
        const newData = new OptimizationData({
            userId: req.userId,
            type,
            data: results,
            fileName: req.file.originalname
        });

        await newData.save();

        // 🧹 Cleanup file
        cleanupFile(req.file.path);

        return res.status(200).json({
            message: '✅ Data saved successfully',
            count: results.length,
            data: newData
        });

    } catch (error) {
        console.error("❌ Upload error:", error.message);
        return cleanupAndRespond(res, req.file, 500, error.message);
    }
});


// 📊 CSV Parser (Promise-based)
function parseCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
}


// 🧹 Cleanup helpers
function cleanupFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function cleanupAndRespond(res, file, status, message) {
    if (file && file.path) cleanupFile(file.path);
    return res.status(status).json({ error: message });
}


// 📥 Get Data by Type (Protected)
router.get('/:type', auth, async (req, res) => {
    try {
        const { type } = req.params;

        const data = await OptimizationData.find({
            type,
            userId: req.userId
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            count: data.length,
            data
        });

    } catch (error) {
        console.error("❌ Fetch error:", error.message);
        return res.status(500).json({ error: error.message });
    }
});


// ── What-If: Rail Cancellation (enriched) ───────────────────
// Accepts { rakeId } and returns human-readable source/destination and alternatives
router.post('/whatif/rail-cancel', auth, async (req, res) => {
    try {
        const { rakeId } = req.body;
        if (!rakeId) return res.status(400).json({ error: 'rakeId required' });

        // Find latest uploaded rake data for the user
        const doc = await OptimizationData.findOne({ userId: req.userId, type: 'demand_rakes' }).sort({ uploadedAt: -1 });
        if (!doc) return res.status(404).json({ error: 'No rake data found' });

        const rake = (doc.data || []).find(r => String(r.id) === String(rakeId) || String(r.rakeNumber) === String(rakeId));
        if (!rake) return res.status(404).json({ error: 'Rake not found' });

        // Try to extract port/plant ids from rake, fallback to raw fields
        const fromId = rake.from || rake.fromPort || rake.fromPortId || rake.fromPortName?.toLowerCase?.().split(' ')?.[0] || rake.fromPortName;
        const toId = rake.to || rake.toPlant || rake.toPlantId || rake.toPlantName?.toLowerCase?.().split(' ')?.[0] || rake.toPlantName;

        const source = getPortName(fromId);
        const destination = getPlantName(toId);

        const alternativeRoutes = getRouteAlternatives(fromId);

        return res.json({ source, destination, alternativeRoutes, rake });
    } catch (err) {
        console.error('[WhatIf] error', err);
        return res.status(500).json({ error: err.message });
    }
});


module.exports = router;