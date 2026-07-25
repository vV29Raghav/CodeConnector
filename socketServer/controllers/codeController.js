const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');
require('dotenv').config();

// ─── Gemini (fallback) ───────────────────────────────────────────────────────
const genAI = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

// ─── Wandbox compiler names (free, no API key, real compilation) ──────────────
const WANDBOX_COMPILER_MAP = {
    'Java':       'openjdk-jdk-22+36',
    'Python':     'cpython-3.10.15',
    'JavaScript': 'nodejs-20.17.0',
    'C++':        'gcc-13.2.0',
    'C':          'gcc-13.2.0-c',
    'TypeScript': 'typescript-5.6.2',
    'Go':         'go-1.23.2',
    'Rust':       'rust-1.82.0',
    'PHP':        'php-8.3.12',
    'Ruby':       'ruby-3.4.9',
    'Swift':      'swift-6.0.1',
    'C#':         'dotnetcore-8.0.402',
    'Bash':       'bash',
};

// Judge0 language IDs (optional - only used if JUDGE0 key is configured)
const JUDGE0_LANG_MAP = {
    'Java':       62,
    'Python':     71,
    'JavaScript': 63,
    'C++':        54,
    'C':          50,
    'TypeScript': 74,
    'Go':         60,
    'Rust':       73,
    'PHP':        68,
    'Ruby':       72,
    'Swift':      83,
    'C#':         51,
    'Bash':       46,
};

// ─── Engine 1: Wandbox (free, no API key required) ────────────────────────────
async function runWithWandbox(language, code, input) {
    const compiler = WANDBOX_COMPILER_MAP[language];
    if (!compiler) throw new Error(`Wandbox: language "${language}" not supported`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7-second timeout for execution

    try {
        const res = await fetch('https://wandbox.org/api/compile.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ compiler, code, stdin: input || '' }),
            signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Wandbox HTTP ${res.status}`);

        const data = await res.json();

        // Check for compilation errors first
        if (data.compiler_error) return data.compiler_error;

        const output = [data.program_output, data.program_error].filter(Boolean).join('');
        if (output) return output;

        // If no output produced, check exit status / signal
        if (data.status && data.status !== '0') {
            if (data.status === '137') return 'Runtime Error: Time Limit Exceeded (Process Killed)';
            if (data.status === '139') return 'Runtime Error: Segmentation Fault (Exit code 139)';
            return `Runtime Error: Process exited with status code ${data.status}`;
        }

        return '(no output)';
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Wandbox: Execution timed out after 7s');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ─── Engine 2: Judge0 (optional — only active if API key is set) ──────────────
async function runWithJudge0(language, code, input) {
    const langId = JUDGE0_LANG_MAP[language];
    if (!langId) throw new Error(`Judge0: language "${language}" not supported`);

    const baseUrl = process.env.JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com';
    const rapidApiKey = process.env.JUDGE0_RAPIDAPI_KEY;
    const apiKey = process.env.JUDGE0_API_KEY;

    const headers = {
        'Content-Type': 'application/json',
        'X-Auth-Token': apiKey || '',
        ...(rapidApiKey && {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
        }),
    };

    const submitRes = await fetch(`${baseUrl}/submissions?base64_encoded=false&wait=false`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ language_id: langId, source_code: code, stdin: input || '' }),
    });
    if (!submitRes.ok) throw new Error(`Judge0 submit HTTP ${submitRes.status}`);
    const { token } = await submitRes.json();

    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pollRes = await fetch(`${baseUrl}/submissions/${token}?base64_encoded=false`, { headers });
        if (!pollRes.ok) throw new Error(`Judge0 poll HTTP ${pollRes.status}`);
        const result = await pollRes.json();
        if (result.status?.id < 3) continue;
        const output = [result.stdout, result.stderr, result.compile_output, result.message].filter(Boolean).join('');
        return output || '(no output)';
    }
    throw new Error('Judge0: timed out');
}

// ─── Engine 3: Gemini (Resilient Fallback) ────────────────────────────────────
async function runWithGemini(language, code, input) {
    if (!genAI) throw new Error('Gemini API key not configured');

    const prompt = `
        You are a code execution simulator.
        The user is writing code in ${language}.
        
        CODE:
        ${code}
        
${input ? `The program requires STANDARD INPUT (STDIN). The user provided the following input:\n${input}\n` : ''}
        Execute this code using the provided inputs (or simulate its execution if actual execution is not possible) and return ONLY the standard output and standard error.
        Do not provide any explanation, comments, or formatting like markdown code blocks. Just the raw output of the code.
        If there is a compilation error or runtime error, return the error message.
        `;

    // Try available flash models sequentially for maximum resilience
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } catch (err) {
            console.warn(`[CodeExec] Gemini model ${modelName} failed: ${err.message}`);
            lastError = err;
        }
    }

    throw new Error(`Gemini engine failed: ${lastError ? lastError.message : 'Unknown error'}`);
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
exports.executeCode = async (req, res) => {
    const { language, code, input } = req.body;

    if (!code || typeof code !== 'string' || !code.trim() || !language) {
        return res.status(400).json({ error: 'Code cannot be empty' });
    }

    const hasJudge0 = process.env.JUDGE0_RAPIDAPI_KEY || process.env.JUDGE0_API_KEY || process.env.JUDGE0_URL;

    // Engine priority: Wandbox (real compiler) → Judge0 (if key set) → Gemini (fallback)
    const engines = [
        { name: 'Wandbox', fn: () => runWithWandbox(language, code, input) },
        ...(hasJudge0 ? [{ name: 'Judge0', fn: () => runWithJudge0(language, code, input) }] : []),
        { name: 'Gemini', fn: () => runWithGemini(language, code, input) },
    ];

    for (const engine of engines) {
        try {
            console.log(`[CodeExec] Trying ${engine.name} for ${language}...`);
            const output = await engine.fn();
            console.log(`[CodeExec] ${engine.name} succeeded.`);
            return res.json({ output, engine: engine.name });
        } catch (err) {
            console.warn(`[CodeExec] ${engine.name} failed: ${err.message}. Trying next engine...`);
        }
    }

    return res.status(500).json({ error: 'All execution engines failed. Please try again.' });
};

