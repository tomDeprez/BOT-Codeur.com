const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

const fetch = require('node-fetch');

const AUTH_FILE = path.join(__dirname, 'auth.json');
const PROMPTS_FILE = path.join(__dirname, 'prompts.json');
const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const CODEUR_BASE_URL = 'https://www.codeur.com';
const CODEUR_MESSAGES_URL = `${CODEUR_BASE_URL}/messages`;
const CODEUR_PROJECTS_URL = `${CODEUR_BASE_URL}/projects`;

async function runBotLogic() {
    console.log('Running bot logic...');

    try {
        // 1. Read configuration and prepare headers
        const authData = await fs.readFile(AUTH_FILE, 'utf8').catch(() => null);
        if (!authData) throw new Error('auth.json not found. Please save configuration first.');
        
        const config = JSON.parse(authData);
        if (!config.sessionCookie) throw new Error('Session cookie not found in auth.json.');

        const headers = {
            'Cookie': `__codeur_session_production=${config.sessionCookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
        };

        // == PART 1: MESSAGES ==
        const conversations = await scrapeConversations(headers);

        // == PART 2: PROJECTS ==
        // Load existing projects from our JSON database
        let existingProjects = await fs.readFile(PROJECTS_FILE, 'utf8').then(JSON.parse).catch(() => []);
        const knownUrls = new Set(existingProjects.map(p => p.url));

        // Scrape the main project list page to find current projects
        console.log(`Fetching ${CODEUR_PROJECTS_URL}...`);
        const projectsPageResponse = await fetch(CODEUR_PROJECTS_URL, { headers });
        if (!projectsPageResponse.ok) throw new Error(`Error fetching projects page: ${projectsPageResponse.statusText}`);
        
        const projectsPageHtml = await projectsPageResponse.text();
        const $projectList = cheerio.load(projectsPageHtml);

        // Add new projects to our list
        $projectList('h3.mb-0 > a.no-underline').each((i, el) => {
            const href = $projectList(el).attr('href');
            if (href) {
                const projectUrl = `${CODEUR_BASE_URL}${href}`;
                if (!knownUrls.has(projectUrl)) {
                    console.log(`New project found: ${projectUrl}`);
                    existingProjects.push({ url: projectUrl, status: 'pas visité' });
                    knownUrls.add(projectUrl); // Add to set to avoid duplicates in the same run
                }
            }
        });

        // Process all projects that haven't been visited yet
        const projectsToVisit = existingProjects.filter(p => p.status === 'pas visité');
        if (projectsToVisit.length > 0) {
            console.log(`Visiting ${projectsToVisit.length} new project page(s)...`);
            for (const project of projectsToVisit) {
                try {
                    console.log(` - Scraping ${project.url}`)
                    const projectPageResponse = await fetch(project.url, { headers });
                    if (!projectPageResponse.ok) {
                        console.warn(`  - Could not fetch ${project.url}, skipping.`);
                        continue; // Skip to the next project
                    }
                    const projectHtml = await projectPageResponse.text();
                    const $detail = cheerio.load(projectHtml);

                    // Scrape details with correct selectors
                    project.title = $detail('h1.text-darker').text().trim();
                    project.description = $detail('div.project-description div.content').text().trim();
                    // Find the p tag containing the euro icon, then find the specific span for the budget
                    project.budget = $detail('p:has(svg.fa-icon-euro-sign) span.font-semibold').text().trim();
                    project.skills = $detail('section.pt-0 a[href*="/users/c/"]').map((i, el) => $detail(el).text().trim()).get();
                    project.status = 'visité'; // Update status

                } catch (pageError) {
                    console.error(`  - Error scraping page ${project.url}:`, pageError);
                }
            }
        }

        // Save the updated list back to our JSON database
        await fs.writeFile(PROJECTS_FILE, JSON.stringify(existingProjects, null, 2));
        console.log(`Project database updated in ${PROJECTS_FILE}`);

        return { 
            success: true, 
            data: { 
                conversations: conversations,
                projects: existingProjects
            } 
        };

    } catch (error) {
        console.error('An error occurred in the bot logic:', error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}

async function scrapeConversations(headers) {
    console.log(`Fetching ${CODEUR_MESSAGES_URL}...`);
    const messagesResponse = await fetch(CODEUR_MESSAGES_URL, { headers });
    if (!messagesResponse.ok) {
        console.warn(`Could not fetch messages: ${messagesResponse.statusText}`);
        return []; // Return empty array on failure
    }
    const messagesHtml = await messagesResponse.text();
    const $messages = cheerio.load(messagesHtml);
    const conversations = [];
    $messages('a.card-conversation').each((i, el) => {
        const card = $messages(el);
        conversations.push({
            isUnread: card.hasClass('unread'),
            userName: card.find('h3.card-title').text().trim(),
            messageSnippet: card.find('p.card-text').text().trim(),
            conversationUrl: `${CODEUR_BASE_URL}${card.attr('href')}`
        });
    });
    console.log(`Extracted ${conversations.length} conversations.`);
    return conversations;
}

module.exports = { runBotLogic };