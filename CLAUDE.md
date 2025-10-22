# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BOT-Codeur.com is an intelligent automation bot for the French freelance platform Codeur.com. The bot automates prospect outreach by scraping project listings, analyzing them with local AI (Ollama), and automatically responding to relevant opportunities. It features a web-based configuration interface for controlling the bot behavior.

## Tech Stack

- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript with Bootstrap 5.3.3
- **HTML Parsing**: Cheerio
- **AI Integration**: Ollama (local LLM via HTTP API)
- **Testing**: Jest with Supertest
- **Containerization**: Docker and Docker Compose

## Development Commands

### Starting the Application
```bash
docker-compose up -d --build
```
Access the web interface at http://localhost:3000

### Running Tests
```bash
cd webapp
npm test
```

### Working with Docker Services
```bash
# View logs
docker-compose logs -f webapp
docker-compose logs -f ollama

# Restart services
docker-compose restart

# Stop services
docker-compose down
```

## Architecture

### Service Architecture
The application consists of two Docker services defined in `docker-compose.yml`:

1. **ollama**: Ollama LLM service (port 11434)
   - Provides local AI capabilities for project analysis and proposal generation
   - Data persisted in `ollama_data` volume

2. **webapp**: Node.js application (port 3000)
   - Express server serving both the web UI and API endpoints
   - Bot automation logic
   - Depends on the Ollama service

### Core Components

**webapp/index.js** - Express server and API endpoints
- Serves static files from `webapp/public/`
- Provides REST API for configuration, bot execution, and monitoring
- Implements auto-run scheduler with intelligent loop management
- Overrides console logging to write to `bot.log` for real-time monitoring
- Key endpoints:
  - `/api/config` - Configuration management
  - `/api/run-bot` - Manual bot execution
  - `/api/logs` - Real-time log streaming
  - `/api/interval-config` - Auto-run scheduler configuration
  - `/api/check-connection` - Cookie validation
  - `/api/ollama-models` - Fetch available Ollama models
  - `/api/clear-projects` - Reset project cache
  - `/api/project-status` - Manual project status updates

**webapp/bot.js** - Core bot automation logic
- Main function: `runBotLogic()` - orchestrates the entire bot workflow
- Multi-phase execution pipeline:
  1. **Scraping**: Discovers new projects from Codeur.com project listings
  2. **Detail Extraction**: Fetches full project details (title, description, budget, skills)
  3. **AI Analysis**: Uses Ollama to determine project relevance based on configured criteria
  4. **Proposal Generation**: Generates customized proposals for relevant projects using AI
  5. **Submission**: Posts proposals to Codeur.com (handles messages >1000 chars via comments)
- Implements state machine with statuses:
  - `statusProjet`: 'non analysé', 'pertinent', 'non pertinent'
  - `statusTraitement`: 'à scraper', 'à analyser', 'à proposer', 'à envoyer', 'terminé', 'erreur scraping', 'erreur analyse', 'erreur proposition', 'erreur envoi'
- State persistence: Saves to `projects.json` after each phase for resilience
- Includes conversation scraping from messages page

**webapp/public/index.html** - Single-page web interface
- Bootstrap-based dark theme UI
- Real-time features:
  - Live log streaming (updates every 3 seconds)
  - Auto-run status display
  - Project and conversation lists with badges
- Configuration sections:
  - Session cookie management with connection testing
  - AI prompt configuration (personality, analysis logic, quotation format, message responses)
  - Ollama model selection
  - Auto-run scheduler settings
- Project management:
  - View project details in modal
  - Manually override project status via dropdown actions
  - Status badges showing analysis and treatment progress

### Data Files

All configuration and state files are stored in `webapp/`:

- **auth.json** - Session cookie for Codeur.com authentication
- **prompts.json** - AI prompts (personality, analysis, quotation, messages)
- **ollama-config.json** - Selected Ollama model name
- **auto-run.json** - Scheduler configuration (interval, enabled flag)
- **projects.json** - Project database with state tracking (NOT version controlled)
- **bot.log** - Timestamped execution logs

### Bot Workflow State Machine

Projects progress through these states:

1. **Discovery**: New project URL detected → `statusTraitement: 'à scraper'`
2. **Scraping**: Details fetched → `statusTraitement: 'à analyser'`
3. **Analysis**: AI evaluates relevance
   - If relevant: `statusProjet: 'pertinent'`, `statusTraitement: 'à proposer'`
   - If not relevant: `statusProjet: 'non pertinent'`, `statusTraitement: 'terminé'`
4. **Proposal**: AI generates response → `statusTraitement: 'à envoyer'`
5. **Submission**: Posted to Codeur.com → `statusTraitement: 'terminé'`

Error states: `'erreur scraping'`, `'erreur analyse'`, `'erreur proposition'`, `'erreur envoi'`

### Ollama Integration

The bot communicates with Ollama via HTTP API at `http://localhost:11434`:

- **Model discovery**: `GET /api/tags` - Lists available models
- **Project analysis**: `POST /api/generate` - Returns "OUI" or "NON" for relevance
- **Proposal generation**: `POST /api/generate` - Creates formatted proposals as JSON

The Ollama API expects:
```json
{
  "model": "model-name",
  "prompt": "...",
  "stream": false
}
```

### Auto-Run Scheduler

The scheduler in `index.js` implements intelligent loop management:
- Waits for current bot cycle to complete before scheduling next run
- Adjusts delay to maintain consistent interval (accounts for execution time)
- Can be enabled/disabled via web UI without restarting the service
- State persists across container restarts via `auto-run.json`

## Key Implementation Details

### Web Scraping
- Uses Cheerio for HTML parsing
- Requires valid `__codeur_session_production` cookie
- User-Agent spoofing for browser simulation
- CSRF token extraction for form submissions

### Message Splitting
When proposals exceed 1000 characters, the bot automatically:
1. Posts first 1000 chars as main proposal
2. Submits remainder as follow-up comment

### Testing
Test files located in `webapp/__tests__/`:
- `api.test.js` - Express API endpoint tests
- `bot.test.js` - Bot logic unit tests

Jest is configured in `package.json` with scripts:
```json
{
  "scripts": {
    "start": "node index.js",
    "test": "jest"
  }
}
```

## Important Notes

- **Authentication**: The bot relies on cookie-based authentication. Cookies expire periodically and must be refreshed via the web UI.
- **Rate Limiting**: No built-in rate limiting—use auto-run intervals responsibly to avoid being blocked by Codeur.com.
- **Error Handling**: Errors in one phase don't block other projects. Each project's state is independent.
- **Resilience**: State saves after each phase, so interrupted executions can resume without data loss.
- **Terms of Service**: The README includes a warning that automation may violate Codeur.com's terms of service.

## Common Debugging Patterns

1. **Check logs first**: The web UI displays last 30 log lines, refreshed every 3 seconds
2. **Inspect projects.json**: Contains full state of all discovered projects
3. **Verify Ollama connectivity**: Use "Actualiser" button in Ollama config section
4. **Test cookie validity**: Use "Vérifier" button in connection settings
5. **Manual status override**: Use dropdown actions on projects to force state transitions
