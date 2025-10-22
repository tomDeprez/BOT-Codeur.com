const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

const fetch = require('node-fetch');

const AUTH_FILE = path.join(__dirname, 'auth.json');
const PROMPTS_FILE = path.join(__dirname, 'prompts.json');
const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const OLLAMA_CONFIG_FILE = path.join(__dirname, 'ollama-config.json');
const CODEUR_BASE_URL = 'https://www.codeur.com';
const CODEUR_MESSAGES_URL = `${CODEUR_BASE_URL}/messages`;
const CODEUR_PROJECTS_URL = `${CODEUR_BASE_URL}/projects`;

function runBotLogic() {
    return new Promise(async (resolve, reject) => {
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
                        existingProjects.push({
                            url: projectUrl,
                            statusProjet: 'non analysé',
                            statusTraitement: 'à scraper'
                        });
                        knownUrls.add(projectUrl); // Add to set to avoid duplicates in the same run
                    }
                }
            });

            // --- Phase 1: Scraping projects ---
            const projectsToScrape = existingProjects.filter(p => p.statusTraitement === 'à scraper');
            if (projectsToScrape.length > 0) {
                console.log(`Scraping ${projectsToScrape.length} project(s)...`);
                for (const project of projectsToScrape) {
                    try {
                        console.log(` - Scraping ${project.url}`);
                        const projectPageResponse = await fetch(project.url, { headers });
                        if (!projectPageResponse.ok) {
                            console.warn(`  - Could not fetch ${project.url}, skipping.`);
                            project.statusTraitement = 'erreur scraping';
                            continue;
                        }
                        const projectHtml = await projectPageResponse.text();
                        const $detail = cheerio.load(projectHtml);

                        project.title = $detail('h1.text-darker').text().trim();
                        project.description = $detail('div.project-description div.content').text().trim();
                        project.budget = $detail('p:has(svg.fa-icon-euro-sign) span.font-semibold').text().trim();
                        project.skills = $detail('section.pt-0 a[href*="/users/c/"]').map((i, el) => $detail(el).text().trim()).get();
                        project.statusTraitement = 'à analyser';
                    } catch (error) {
                        console.error(`  - Error scraping project ${project.url}:`, error);
                        project.statusTraitement = 'erreur scraping';
                    }
                }
            }
            await fs.writeFile(PROJECTS_FILE, JSON.stringify(existingProjects, null, 2));
            console.log('Projects data saved after scraping phase.');

            // --- Phase 2: Analyzing projects with Ollama ---
            const projectsToAnalyze = existingProjects.filter(p => p.statusTraitement === 'à analyser');
            if (projectsToAnalyze.length > 0) {
                console.log(`Analyzing ${projectsToAnalyze.length} project(s) with Ollama...`);
                for (const project of projectsToAnalyze) {
                    try {
                        console.log(`  - Analyzing ${project.url}...`);
                        const analysisResult = await analyzeProjectWithOllama(project); // Returns 'pertinent' or 'non pertinent'
                        project.statusProjet = analysisResult;
                        if (analysisResult === 'pertinent') {
                            project.statusTraitement = 'à proposer';
                        } else {
                            project.statusTraitement = 'terminé'; // Non-pertinent projects are done
                        }
                        console.log(`  - Analysis complete. Project status: ${project.statusProjet}, Treatment status: ${project.statusTraitement}`);
                    } catch (error) {
                        console.error(`  - Error analyzing project ${project.url} with Ollama:`, error);
                        project.statusTraitement = 'à analyser';
                    }
                }
            }
            await fs.writeFile(PROJECTS_FILE, JSON.stringify(existingProjects, null, 2));
            console.log('Projects data saved after analysis phase.');

            // --- Phase 3: Generating proposals for pertinent projects ---
            const projectsToPropose = existingProjects.filter(p => p.statusTraitement === 'à proposer');
            if (projectsToPropose.length > 0) {
                console.log(`Generating proposals for ${projectsToPropose.length} pertinent project(s)...`);
                for (const project of projectsToPropose) {
                    try {
                        console.log(`  - Generating proposal for ${project.url}...`);
                        const proposal = await generateProposalWithOllama(project);
                        project.proposal = proposal; // Store the generated proposal
                        project.statusTraitement = 'à envoyer'; // Proposal generated, ready to be sent
                        console.log(`  - Proposal generated for ${project.url}, ready to send.`);
                    } catch (error) {
                        console.error(`  - Error generating proposal for ${project.url}:`, error);
                        project.statusTraitement = 'erreur proposition';
                    }
                }
            }
            await fs.writeFile(PROJECTS_FILE, JSON.stringify(existingProjects, null, 2));
            console.log('Projects data saved after proposal generation phase.');

            // --- Phase 4: Sending proposals ---
            const projectsToSend = existingProjects.filter(p => p.statusTraitement === 'à envoyer');
            if (projectsToSend.length > 0) {
                console.log(`Sending ${projectsToSend.length} proposal(s)...`);
                for (const project of projectsToSend) {
                    try {
                        console.log(`  - Sending proposal for ${project.url}...`);
                        // Extract project ID from URL
                        const projectIdMatch = project.url.match(/\/projects\/(\d+)-/);
                        if (!projectIdMatch) {
                            console.error(`  - Could not extract project ID from URL: ${project.url}`);
                            project.statusTraitement = 'erreur envoi';
                            continue;
                        }
                        const projectId = projectIdMatch[1];

                        // Fetch project page to get CSRF token
                        const projectPageResponse = await fetch(project.url, { headers });
                        if (!projectPageResponse.ok) {
                            console.warn(`  - Could not fetch project page for CSRF token: ${project.url}, skipping.`);
                            project.statusTraitement = 'erreur envoi';
                            continue;
                        }
                        const projectPageHtml = await projectPageResponse.text();
                        const $projectPage = cheerio.load(projectPageHtml);
                        const csrfToken = $projectPage('meta[name="csrf-token"]').attr('content');

                        if (!csrfToken) {
                            console.error(`  - CSRF token not found on page: ${project.url}`);
                            project.statusTraitement = 'erreur envoi';
                            continue;
                        }

                        const sendSuccess = await sendProposal(project, headers, csrfToken, projectId);
                        if (sendSuccess) {
                            project.statusTraitement = 'terminé';
                            console.log(`  - Proposal sent successfully for ${project.url}`);
                        } else {
                            project.statusTraitement = 'erreur envoi';
                            console.log(`  - Failed to send proposal for ${project.url}`);
                        }
                    } catch (error) {
                        console.error(`  - Error sending proposal for ${project.url}:`, error);
                        project.statusTraitement = 'erreur envoi';
                    }
                }
            }
            // Save updated projects to JSON database
            await fs.writeFile(PROJECTS_FILE, JSON.stringify(existingProjects, null, 2));
            console.log('Projects data saved after sending proposals phase.');

            resolve({ success: true, data: { conversations, projects: existingProjects } });
        } catch (error) {
            console.error('Error in bot logic:', error);
            resolve({ success: false, message: error.message });
        }
    });
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

async function analyzeProjectWithOllama(project) {
    const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
    let ollamaModel = '';

    try {
        const ollamaConfigData = await fs.readFile(OLLAMA_CONFIG_FILE, 'utf8');
        const ollamaConfig = JSON.parse(ollamaConfigData);
        if (ollamaConfig.ollamaModel) {
            ollamaModel = ollamaConfig.ollamaModel;
        }
    } catch (err) {
        console.warn('ollama-config.json not found or invalid, using default Ollama model.', err);
    }

    // 1. Read the analysis prompt
    const promptsData = await fs.readFile(PROMPTS_FILE, 'utf8');
    const prompts = JSON.parse(promptsData);
    const analysisPrompt = prompts.promptAnalysis;

    if (!analysisPrompt) {
        throw new Error('promptAnalysis not found in prompts.json');
    }

    // 2. Construct the full prompt for Ollama
    const fullPrompt = `

            Voici les détails du projet :
            - Titre : ${project.title}
            - Description : ${project.description}
            - Budget : ${project.budget}

            Répondez uniquement par "OUI" ou "NON" si le projet respecte un des critères suivants : ${analysisPrompt}.
            `;

    // 3. Call Ollama API
    const response = await fetch(OLLAMA_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: ollamaModel,
            prompt: fullPrompt,
            stream: false, // We want the full response at once
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Ollama API request failed: ${response.statusText} - ${errorBody}`);
    }

    const result = await response.json();
    const ollamaResponse = result.response.trim().toUpperCase();

    // 4. Interpret the response
    if (ollamaResponse.includes('OUI')) {
        return 'pertinent';
    } else {
        return 'non pertinent';
    }
}

async function generateProposalWithOllama(project) {
    const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
    let ollamaModel = '';

    try {
        const ollamaConfigData = await fs.readFile(OLLAMA_CONFIG_FILE, 'utf8');
        const ollamaConfig = JSON.parse(ollamaConfigData);
        if (ollamaConfig.ollamaModel) {
            ollamaModel = ollamaConfig.ollamaModel;
        }
    } catch (err) {
        console.warn('ollama-config.json not found or invalid, using default Ollama model.', err);
    }

    // 1. Read the quotation prompt
    const promptsData = await fs.readFile(PROMPTS_FILE, 'utf8');
    const prompts = JSON.parse(promptsData);
    const quotationPrompt = prompts.promptQuotation;
    const promptPersonality = prompts.promptPersonality;

    if (!quotationPrompt) {
        throw new Error('promptQuotation not found in prompts.json');
    }

    // 2. Construct the full prompt for Ollama
    const fullPrompt = `
            Pour le message, commence toujours par "Bonjour". Je ne veux pas de titre, ni d'étoiles que tu texte brute. Fais un message humain de proposition pour le projet ; tu dois te faire passer pour...${promptPersonality}, et respecter cette logique ${quotationPrompt}
            Voici le projet :
            - Titre : ${project.title}
            - Description : ${project.description}
            - Budget : ${project.budget}
            `;

    // 3. Call Ollama API
    const response = await fetch(OLLAMA_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: ollamaModel,
            prompt: fullPrompt,
            stream: false, // We want the full response at once
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Ollama API request failed: ${response.statusText} - ${errorBody}`);
    }

    const result = await response.json();
    const ollamaResponse = result.response.trim().replace(/\*/g, '');


    const proposal = {
        amount: 100, // Default budget
        deadline: 7, // Default deadline in days
    };

    if (ollamaResponse.length > 1000) {
        proposal.message = ollamaResponse.substring(0, 1000);
        proposal.messageSuite = ollamaResponse.substring(1000);
    } else {
        proposal.message = ollamaResponse;
    }

    return proposal;
}

async function sendProposalContinuation(offerId, message, headers, csrfToken, projectId) {
    const commentUrl = `${CODEUR_BASE_URL}/offer/${offerId}/comments`;
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;

    const body = `------${boundary}\r\n` +
        `Content-Disposition: form-data; name="comment[file]"; filename=""\r\nContent-Type: application/octet-stream\r\n\r\n\r\n` +
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name="comment[content]"\r\n\r\n${message}\r\n` +
        `------${boundary}--\r\n`;

    const sendHeaders = {
        ...headers,
        'Accept': 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01',
        'Content-Type': `multipart/form-data; boundary=----${boundary}`,
        'Origin': CODEUR_BASE_URL,
        'Referer': `${CODEUR_BASE_URL}/projects/${projectId}/offers/${offerId}`,
        'X-CSRF-Token': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
    };

    const response = await fetch(commentUrl, {
        method: 'POST',
        headers: sendHeaders,
        body: body,
    });

    if (response.ok) {
        console.log(`  - Successfully sent proposal continuation for offer ${offerId}`);
        return true;
    } else {
        const errorBody = await response.text();
        console.error(`Failed to send proposal continuation for offer ${offerId}. Status: ${response.status}, Body: ${errorBody}`);
        return false;
    }
}

async function sendProposal(project, headers, csrfToken, projectId) {
    const offerUrl = `${CODEUR_BASE_URL}/projects/${projectId}/offers`;
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;

    const body = `------${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"offer[level]\"\r\n\r\nstandard\r\n` +
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"offer[amount]\"\r\n\r\n${project.proposal.amount}\r\n` +
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"offer[pricing_mode]\"\r\n\r\nflat_rate\r\n` +
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"offer[duration]\"\r\n\r\n${project.proposal.deadline}\r\n` +
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"offer[comments_attributes][0][content]\"\r\n\r\n${project.proposal.message}\r\n` +
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"offer[comments_attributes][0][file]\"; filename=\"\"\r\nContent-Type: application/octet-stream\r\n\r\n\r\n` +
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"offer[cta_type]\"\r\n\r\nvisit_profile\r\n` +
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"offer[cta_website_url]\"\r\n\r\n\r\n` +
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"offer[cta_appointment_url]\"\r\n\r\n\r\n` +
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"offer[raw_cta_phone]\"\r\n\r\n\r\n` +
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"offer[cta_phone]\"\r\n\r\n\r\n` +
        `------${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"commit\"\r\n\r\nPublier mon offre\r\n` +
        `------${boundary}--\r\n`;

    const sendHeaders = {
        ...headers,
        'Accept': 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Content-Type': `multipart/form-data; boundary=----${boundary}`,
        'Origin': 'https://www.codeur.com',
        'Referer': project.url,
        'X-CSRF-Token': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
    };

    const response = await fetch(offerUrl, {
        method: 'POST',
        headers: sendHeaders,
        body: body,
    });

    if (response.ok) {
        const responseText = await response.text();
        const offerIdMatch = responseText.match(/#offer_(\d+)/);

        if (offerIdMatch && project.proposal.messageSuite) {
            const offerId = offerIdMatch[1];
            console.log(`  - Extracted offer ID: ${offerId}. Sending proposal continuation...`);
            const continuationSuccess = await sendProposalContinuation(offerId, project.proposal.messageSuite, headers, csrfToken, projectId);
            return continuationSuccess;
        }
        return true;
    } else {
        const errorBody = await response.text();
        console.error(`Failed to send proposal. Status: ${response.status}, Body: ${errorBody}`);
        return false;
    }
}


module.exports = { runBotLogic, analyzeProjectWithOllama, generateProposalWithOllama, sendProposal, sendProposalContinuation };
