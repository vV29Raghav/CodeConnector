const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('CRITICAL ERROR: GEMINI_API_KEY is not defined in environment variables!');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

exports.executeCode = async (req, res) => {
    const { language, code } = req.body;

    if (!code || !language) {
        return res.status(400).json({ error: 'Code and language are required' });
    }

    if (!genAI) {
        console.error('Code execution failed: Gemini API key is missing.');
        return res.status(500).json({ error: 'Backend configuration error: API Key missing' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
        You are a code execution simulator.
        The user is writing code in ${language}.
        
        CODE:
        ${code}

        Execute this code (or simulate its execution if actual execution is not possible) and return ONLY the standard output and standard error.
        Do not provide any explanation, comments, or formatting like markdown code blocks. Just the raw output of the code.
        If there is a compilation error or runtime error, return the error message.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const outputText = response.text().trim();

        res.json({ output: outputText });
    }
    catch (error) {
        console.error('Error during Gemini API call:', error.message);
        res.status(500).json({
            error: 'Failed to simulate code execution',
            details: error.message
        });
    }
};
