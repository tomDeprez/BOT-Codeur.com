const request = require('supertest');
const app = require('../index'); // Import the Express app
const fs = require('fs').promises;
const path = require('path');

// Define paths for our test files
const AUTH_FILE_PATH = path.join(__dirname, '..', 'auth.json');
const PROMPTS_FILE_PATH = path.join(__dirname, '..', 'prompts.json');

describe('API Endpoints', () => {



    describe('POST /api/config', () => {
        it('should save sessionCookie to auth.json and prompts to prompts.json', async () => {
            const mockConfig = {
                sessionCookie: 'test_cookie_12345',
                promptPersonality: 'You are a helpful assistant.',
                promptAnalysis: 'Analyze the project.',
                promptQuotation: 'Generate a quote.',
                promptMessage: 'Respond to the message.'
            };

            // Send the request to the app
            const response = await request(app)
                .post('/api/config')
                .send(mockConfig);

            // 1. Check the API response
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({ message: 'Configuration sauvegardée avec succès !' });

            // 2. Check the content of auth.json
            const authContent = await fs.readFile(AUTH_FILE_PATH, 'utf8');
            const authJson = JSON.parse(authContent);
            expect(authJson).toEqual({ sessionCookie: 'test_cookie_12345' });

            // 3. Check the content of prompts.json
            const promptsContent = await fs.readFile(PROMPTS_FILE_PATH, 'utf8');
            const promptsJson = JSON.parse(promptsContent);
            expect(promptsJson).toEqual({
                promptPersonality: 'You are a helpful assistant.',
                promptAnalysis: 'Analyze the project.',
                promptQuotation: 'Generate a quote.',
                promptMessage: 'Respond to the message.'
            });
        });

        it('should return a 500 error if file writing fails', async () => {
            // Mock fs.writeFile to throw an error
            jest.spyOn(fs, 'writeFile').mockRejectedValue(new Error('Disk full'));

            const response = await request(app)
                .post('/api/config')
                .send({});

            expect(response.statusCode).toBe(500);
            expect(response.body).toEqual({ message: 'Erreur lors de la sauvegarde de la configuration.' });

            // Restore the original function
            jest.restoreAllMocks();
        });
    });
});
