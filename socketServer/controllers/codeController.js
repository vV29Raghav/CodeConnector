const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

exports.executeCode = async (req, res) => {
    const { language, code } = req.body;
    if (!code || !language) {
        return res.status(400).json({ error: 'Code and language are required' });
    }

    try {
        const prompt = `
    You are a code execution simulator.
    The user is writing code in ${language}.
    
    CODE:
    ${code}

    Execute this code (or simulate its execution if actual execution is not possible) and return ONLY the standard output and standard error.
    Do not provide any explanation, comments, or formatting like markdown code blocks. Just the raw output of the code.
    If there is a compilation error or runtime error, return the error message.
    `;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const outputText = (response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

        res.json({ output: outputText });
    }
    catch (error) {
        console.error('Error during code execution:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
