const fs = require('fs/promises');
const path = require('path');

// Use dynamic import for node-fetch
let fetch;
import('node-fetch').then(nodeFetch => {
    fetch = nodeFetch.default;
});

const CONFIG_FILE = path.join(__dirname, 'config.json');
const CODEUR_MESSAGES_URL = 'https://www.codeur.com/messages';

async function runBotLogic() {
    console.log('Running bot logic...');

    if (!fetch) {
        console.error('Fetch is not initialized yet.');
        return;
    }

    try {
        // 1. Read configuration
        const configData = await fs.readFile(CONFIG_FILE, 'utf8');
        const config = JSON.parse(configData);

        if (!config.sessionCookie) {
            console.log('Session cookie not found in config.json. Please save configuration first.');
            return;
        }

        // 2. Prepare request headers
        const headers = {
            'Cookie': `__codeur_session_production=${config.sessionCookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
        };

        // 3. Fetch the page
        console.log(`Fetching ${CODEUR_MESSAGES_URL}...`);
        const response = await fetch(CODEUR_MESSAGES_URL, { headers });

        if (!response.ok) {
            console.error(`Error fetching page: ${response.status} ${response.statusText}`);
            return;
        }

        // 4. Log the HTML structure
        const html = await response.text();
        console.log('Successfully fetched page. HTML content is logged below:');
        console.log('--------------------------------------------------------');
        console.log(html);
        console.log('--------------------------------------------------------');

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('config.json not found. Please save configuration via the web interface first.');
        } else {
            console.error('An error occurred in the bot logic:', error);
        }
    }
}

module.exports = { runBotLogic };
