const request = require('supertest');
const app = require('../index'); // Import the Express app
const fs = require('fs').promises;
const path = require('path');

// Mock the node-fetch module
jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');

// Define paths for our test files
const AUTH_FILE_PATH = path.join(__dirname, '..', 'auth.json');
const PROMPTS_FILE_PATH = path.join(__dirname, '..', 'prompts.json');
const OLLAMA_CONFIG_FILE_PATH = path.join(__dirname, '..', 'ollama-config.json');

describe('API Endpoints', () => {
    beforeEach(() => {
        fetch.mockClear();
        jest.spyOn(fs, 'readFile').mockClear();
        jest.spyOn(fs, 'writeFile').mockClear();
        jest.spyOn(fs, 'unlink').mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('POST /api/config', () => {
        it('should save sessionCookie to auth.json, prompts to prompts.json, and ollamaModel to ollama-config.json', async () => {
            const mockConfig = {
                sessionCookie: 'test_cookie_12345',
                promptPersonality: 'You are a helpful assistant.',
                promptAnalysis: 'Analyze the project.',
                promptQuotation: 'Generate a quote.',
                promptMessage: 'Respond to the message.',
                ollamaModel: 'llama2'
            };

            // Mock fs.writeFile to prevent actual file system writes during test
            jest.spyOn(fs, 'writeFile').mockResolvedValue();

            // Send the request to the app
            const response = await request(app)
                .post('/api/config')
                .send(mockConfig);

            // 1. Check the API response
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({ message: 'Configuration sauvegardée avec succès !' });

            // 2. Check the content of auth.json
            expect(fs.writeFile).toHaveBeenCalledWith(AUTH_FILE_PATH, JSON.stringify({ sessionCookie: 'test_cookie_12345' }, null, 2));

            // 3. Check the content of prompts.json
            expect(fs.writeFile).toHaveBeenCalledWith(PROMPTS_FILE_PATH, JSON.stringify({
                promptPersonality: 'You are a helpful assistant.',
                promptAnalysis: 'Analyze the project.',
                promptQuotation: 'Generate a quote.',
                promptMessage: 'Respond to the message.'
            }, null, 2));

            // 4. Check the content of ollama-config.json
            expect(fs.writeFile).toHaveBeenCalledWith(OLLAMA_CONFIG_FILE_PATH, JSON.stringify({ ollamaModel: 'llama2' }, null, 2));
        });

        it('should return a 500 error if file writing fails', async () => {
            // Mock fs.writeFile to throw an error
            jest.spyOn(fs, 'writeFile').mockRejectedValue(new Error('Disk full'));

            const response = await request(app)
                .post('/api/config')
                .send({});

            expect(response.statusCode).toBe(500);
            expect(response.body).toEqual({ message: 'Erreur lors de la sauvegarde de la configuration.' });
        });
    });

    describe('GET /api/ollama-models', () => {
        it('should return a list of Ollama models', async () => {
            const mockOllamaModels = {
                models: [
                    { name: 'llama2' },
                    { name: 'mistral' }
                ]
            };
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockOllamaModels) });

            const response = await request(app).get('/api/ollama-models');

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({ success: true, models: ['llama2', 'mistral'] });
            expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
        });

        it('should return a 500 error if Ollama API is unreachable', async () => {
            fetch.mockRejectedValueOnce(new Error('Network error'));

            const response = await request(app).get('/api/ollama-models');

            expect(response.statusCode).toBe(500);
            expect(response.body).toEqual({ success: false, message: 'Erreur lors de la récupération des modèles Ollama.' });
        });

        it('should return a 500 error if Ollama API returns a non-ok response', async () => {
            fetch.mockResolvedValueOnce({ ok: false, statusText: 'Service Unavailable' });

            const response = await request(app).get('/api/ollama-models');

            expect(response.statusCode).toBe(500);
            expect(response.body).toEqual({ success: false, message: 'Erreur lors de la récupération des modèles Ollama.' });
        });
    });

    describe('GET /api/config (Ollama model)', () => {
        it('should return the configured Ollama model if ollama-config.json exists', async () => {
            const mockOllamaConfig = { ollamaModel: 'codellama' };
            jest.spyOn(fs, 'readFile')
                .mockResolvedValueOnce(JSON.stringify({ sessionCookie: 'test' })) // auth.json
                .mockResolvedValueOnce(JSON.stringify({ promptPersonality: 'test' })) // prompts.json
                .mockResolvedValueOnce(JSON.stringify(mockOllamaConfig)); // ollama-config.json

            const response = await request(app).get('/api/config');

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({ sessionCookie: 'test', promptPersonality: 'test', ollamaModel: 'codellama' });
        });

        it('should return an empty ollamaModel if ollama-config.json does not exist', async () => {
            jest.spyOn(fs, 'readFile')
                .mockResolvedValueOnce(JSON.stringify({ sessionCookie: 'test' })) // auth.json
                .mockResolvedValueOnce(JSON.stringify({ promptPersonality: 'test' })) // prompts.json
                .mockRejectedValueOnce({ code: 'ENOENT' }); // ollama-config.json does not exist

            const response = await request(app).get('/api/config');

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({ sessionCookie: 'test', promptPersonality: 'test' });
        });
    });
});
