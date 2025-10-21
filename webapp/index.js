const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const fs_sync = require('fs');
const path = require('path');

const fetch = require('node-fetch');

const app = express();
const port = 3000;
const AUTH_FILE = path.join(__dirname, 'auth.json');
const PROMPTS_FILE = path.join(__dirname, 'prompts.json');
const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const OLLAMA_CONFIG_FILE = path.join(__dirname, 'ollama-config.json');
const AUTO_RUN_CONFIG_FILE = path.join(__dirname, 'auto-run.json');
const LOG_FILE = path.join(__dirname, 'bot.log');
const OLLAMA_API_BASE_URL = 'http://localhost:11434';

// --- Log Override ---
const logStream = fs_sync.createWriteStream(LOG_FILE, { flags: 'a' });
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const logAndWrite = (level, originalFunc, ...args) => {
    const message = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return 'Unserializable Object';
            }
        }
        return String(arg);
    }).join(' ');

    const timestamp = new Date().toISOString();
    logStream.write(`[${level}] ${timestamp}: ${message}\n`);
    originalFunc.apply(console, args);
};

console.log = (...args) => logAndWrite('LOG', originalConsoleLog, ...args);
console.error = (...args) => logAndWrite('ERROR', originalConsoleError, ...args);
console.warn = (...args) => logAndWrite('WARN', originalConsoleWarn, ...args);

const { runBotLogic } = require('./bot.js');
let botInterval;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// --- Auto-run Functions ---
function startBotInterval(intervalMinutes) {
    if (botInterval) {
        clearInterval(botInterval);
    }
    if (intervalMinutes > 0) {
        console.log(`Starting bot to run every ${intervalMinutes} minutes.`);
        botInterval = setInterval(runBotLogic, intervalMinutes * 60 * 1000);
    }
}

app.get('/api/interval-config', async (req, res) => {
    try {
        const configData = await fs.readFile(AUTO_RUN_CONFIG_FILE, 'utf8');
        res.json(JSON.parse(configData));
    } catch (error) {
        res.json({ interval: 10, enabled: false });
    }
});

app.post('/api/interval-config', async (req, res) => {
    const { interval, enabled } = req.body;
    try {
        const config = {
            interval: parseInt(interval, 10),
            enabled: enabled
        };
        await fs.writeFile(AUTO_RUN_CONFIG_FILE, JSON.stringify(config, null, 2));

        if (config.enabled) {
            startBotInterval(config.interval);
        } else {
            if (botInterval) {
                clearInterval(botInterval);
                botInterval = null;
                console.log('Stopped automatic bot execution.');
            }
        }
        res.json({ message: 'Configuration de l\'intervalle sauvegardée.' });
    } catch (error) {
        console.error('Error saving interval config:', error);
        res.status(500).json({ message: 'Erreur lors de la sauvegarde.' });
    }
});

// --- Log Endpoint ---
app.get('/api/logs', async (req, res) => {
    try {
        const logData = await fs.readFile(LOG_FILE, 'utf8');
        const lines = logData.split('\n').filter(line => line.trim() !== '');
        const last30Lines = lines.slice(-30).join('\n');
        res.type('text/plain').send(last30Lines);
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.type('text/plain').send('Le fichier de log est encore vide.');
        } else {
            originalConsoleError('Error reading log file:', error);
            res.status(500).send('Erreur lors de la lecture des logs.');
        }
    }
});

// --- Other API Endpoints ---

// API endpoint to get current configuration
app.get('/api/config', async (req, res) => {
    try {
        const [authData, promptsData, ollamaConfigData] = await Promise.all([
            fs.readFile(AUTH_FILE, 'utf8').catch(() => 'null'),
            fs.readFile(PROMPTS_FILE, 'utf8').catch(() => 'null'),
            fs.readFile(OLLAMA_CONFIG_FILE, 'utf8').catch(() => 'null')
        ]);

        const authConfig = JSON.parse(authData) || {};
        const promptsConfig = JSON.parse(promptsData) || {};
        const ollamaConfig = JSON.parse(ollamaConfigData) || {};

        res.json({ ...authConfig, ...promptsConfig, ...ollamaConfig });
    } catch (err) {
        console.error('Error reading config:', err);
        res.status(500).json({ message: 'Erreur lors de la lecture de la configuration.' });
    }
});

// API endpoint for checking the connection
app.post('/api/check-connection', async (req, res) => {
    const { sessionCookie } = req.body;

    if (!fetch) {
        return res.status(500).json({ success: false, message: 'Le service de requête n\'est pas encore prêt.' });
    }
    if (!sessionCookie) {
        return res.status(400).json({ success: false, message: 'Le cookie de session est manquant.' });
    }

    try {
        const headers = {
            'Cookie': `__codeur_session_production=${sessionCookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
        };

        const response = await fetch('https://www.codeur.com/projects', { headers });
        const html = await response.text();

        if (response.ok && html.includes('Tous les projets')) {
            res.json({ success: true, message: 'Connexion réussie !' });
        } else {
            res.json({ success: false, message: 'Cookie invalide ou expiré.' });
        }
    } catch (error) {
        console.error('Connection check error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la tentative de connexion à Codeur.com.' });
    }
});

// API endpoint to save configuration
app.post('/api/config', async (req, res) => {
    const { sessionCookie, promptPersonality, promptAnalysis, promptQuotation, promptMessage, ollamaModel } = req.body;

    try {
        // Read existing configs
        const [authData, promptsData, ollamaConfigData] = await Promise.all([
            fs.readFile(AUTH_FILE, 'utf8').catch(() => '{}'),
            fs.readFile(PROMPTS_FILE, 'utf8').catch(() => '{}'),
            fs.readFile(OLLAMA_CONFIG_FILE, 'utf8').catch(() => '{}')
        ]);

        const authConfig = JSON.parse(authData);
        const promptsConfig = JSON.parse(promptsData);
        const ollamaConfig = JSON.parse(ollamaConfigData);

        // Merge new values
        if (sessionCookie) authConfig.sessionCookie = sessionCookie;
        if (promptPersonality) promptsConfig.promptPersonality = promptPersonality;
        if (promptAnalysis) promptsConfig.promptAnalysis = promptAnalysis;
        if (promptQuotation) promptsConfig.promptQuotation = promptQuotation;
        if (promptMessage) promptsConfig.promptMessage = promptMessage;
        if (ollamaModel) ollamaConfig.ollamaModel = ollamaModel;

        // Write updated configs
        await Promise.all([
            fs.writeFile(AUTH_FILE, JSON.stringify(authConfig, null, 2)),
            fs.writeFile(PROMPTS_FILE, JSON.stringify(promptsConfig, null, 2)),
            fs.writeFile(OLLAMA_CONFIG_FILE, JSON.stringify(ollamaConfig, null, 2))
        ]);

        console.log('Configuration saved successfully.');
        res.json({ message: 'Configuration sauvegardée avec succès !' });
    } catch (err) {
        console.error('Error saving config:', err);
        res.status(500).json({ message: 'Erreur lors de la sauvegarde de la configuration.' });
    }
});

// API endpoint to get Ollama models
app.get('/api/ollama-models', async (req, res) => {
    try {
        const response = await fetch(`${OLLAMA_API_BASE_URL}/api/tags`);
        if (!response.ok) {
            throw new Error(`Ollama API request failed: ${response.statusText}`);
        }
        const data = await response.json();
        const models = data.models.map(model => model.name);
        res.json({ success: true, models });
    } catch (error) {
        console.error('Error fetching Ollama models:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération des modèles Ollama.' });
    }
});

// API endpoint to manually run the bot logic
app.post('/api/run-bot', async (req, res) => {
    console.log('Manual bot run triggered.');
    const result = await runBotLogic();
    res.json(result);
});

// API endpoint to clear the projects cache
app.post('/api/clear-projects', async (req, res) => {
    try {
        await fs.unlink(PROJECTS_FILE);
        console.log('projects.json deleted successfully.');
        res.json({ message: 'Le cache des projets a été vidé avec succès !' });
    } catch (err) {
        if (err.code === 'ENOENT') {
            // File doesn't exist, which is fine.
            console.log('projects.json did not exist, nothing to clear.');
            res.json({ message: 'Le cache des projets était déjà vide.' });
        } else {
            console.error('Error deleting projects.json:', err);
            res.status(500).json({ message: 'Erreur lors de la suppression du cache.' });
        }
    }
});

// API endpoint to manually update project status
app.post('/api/project-status', async (req, res) => {
    const { url, status } = req.body;

    if (!url || !status) {
        return res.status(400).json({ success: false, message: 'URL and status are required.' });
    }

    try {
        const projectsData = await fs.readFile(PROJECTS_FILE, 'utf8');
        const projects = JSON.parse(projectsData);

        const projectIndex = projects.findIndex(p => p.url === url);

        if (projectIndex === -1) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        projects[projectIndex].status = status;

        await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2));

        res.json({ success: true, message: 'Project status updated successfully.' });
    } catch (err) {
        console.error('Error updating project status:', err);
        res.status(500).json({ success: false, message: 'Error updating project status.' });
    }
});

// Only start the server if this file is run directly
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Web app listening at http://localhost:${port}`);
        // Initialize auto-run
        fs.readFile(AUTO_RUN_CONFIG_FILE, 'utf8')
            .then(JSON.parse)
            .then(config => {
                if (config.enabled && config.interval > 0) {
                    console.log('Initial auto-run is enabled.');
                    runBotLogic(); // Run once on start
                    startBotInterval(config.interval);
                }
            })
            .catch(() => {
                console.log('No auto-run configuration found or it is disabled.');
            });
    });
}

module.exports = app;
