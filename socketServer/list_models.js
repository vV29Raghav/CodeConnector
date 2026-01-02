const https = require('https');
require('dotenv').config();
const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
https.get(url, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
        try {
            const p = JSON.parse(data);
            const names = p.models
                .filter(m => m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name.replace('models/', ''));
            console.log('--- MODELS ---');
            console.log(names.join(', '));
        } catch (e) {
            console.log(e);
        }
    });
});
