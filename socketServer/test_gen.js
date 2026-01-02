const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

async function testModels() {
    const modelsToTest = [
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-pro'
    ];

    for (const modelName of modelsToTest) {
        try {
            console.log(`Testing ${modelName}...`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: 'user', parts: [{ text: 'Say hi' }] }],
            });
            const text = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log(`SUCCESS with ${modelName}: ${text ? text.substring(0, 10) : 'No text'}`);
            process.exit(0); // Exit on first success
        } catch (error) {
            console.log(`FAILED with ${modelName}: ${error.message}`);
        }
    }
}

testModels();
