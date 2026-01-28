const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

app.post('/api/extract', (req, res) => {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ error: 'Invalid input. Expected array of URLs.' });
    }

    const EmailExtractor = require('./email-extractor');
    const extractor = new EmailExtractor();

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log('Starting scrape for', urls.length, 'URLs');

    (async () => {
        try {
            // Batch size for browser restart
            const BATCH_SIZE = 10;
            const CONCURRENCY = 2;

            for (let i = 0; i < urls.length; i += BATCH_SIZE) {
                const batch = urls.slice(i, i + BATCH_SIZE);
                console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(urls.length / BATCH_SIZE)}`);
                
                // Restart browser for each batch
                await extractor.init();
                
                for (let j = 0; j < batch.length; j += CONCURRENCY) {
                    const chunk = batch.slice(j, j + CONCURRENCY);
                    const promises = chunk.map(url => extractor.extractEmailsFromUrl(url));
                    
                    const results = await Promise.all(promises);
                    
                    results.forEach(result => {
                        res.write(`data: ${JSON.stringify(result)}\n\n`);
                    });
                }
                
                await extractor.close();
            }
            
            res.write('event: end\n');
            res.write('data: "done"\n\n');
            res.end();
            
        } catch (error) {
            console.error('Global Scraping error:', error);
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
            // Ensure browser is closed even on error
            try { await extractor.close(); } catch(e) {}
        }
    })();
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
