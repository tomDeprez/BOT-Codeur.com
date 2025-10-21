





// Mock the fs.promises module


describe('runBotLogic', () => {
    const { runBotLogic } = require('../bot');
    const fetch = require('node-fetch');
    const fs = require('fs');
    const path = require('path');
    // Mock the node-fetch module locally for this describe block
    jest.mock('node-fetch', () => jest.fn());
    let mockAuthFileContent;
    let mockProjectListPageHtml;
    let mockProjectDetailPageHtml;

    beforeEach(() => {
        // Reset mocks before each test
        fetch.mockClear();

        // --- Default Mock Implementations ---
        mockAuthFileContent = JSON.stringify({ sessionCookie: 'valid_cookie' });
        mockProjectListPageHtml = `
            <html>
                <body>
                    <h3 class="mb-0">
                        <a class="no-underline" href="/projects/1-new-project">New Project</a>
                    </h3>
                </body>
            </html>
        `;
        mockProjectDetailPageHtml = `
            <html>
                <body>
                    <h1 class="text-darker">Refonte page produit Shopify orientée conversion</h1>
                    <div class="project-description">
                        <div class="content">
                            <p>Je cherche un freelance Shopify...</p>
                        </div>
                    </div>
                    <section class="pt-0">
                        <p class="flex items-start gap-2 m-0">
                            <span>
                                <span class="...-euro-sign"><svg class="svg-inline--fa fa-w-16 fa-icon-euro-sign"></svg></span>
                            </span>
                            <span class="pt-1">
                                Budget indicatif&nbsp;:
                                <span class="font-semibold">Moins de 500 €</span>
                            </span>
                        </p>
                        <p class="flex items-start gap-2 m-0">
                            <span>...</span>
                            <span class="pt-1">
                                Profils recherchés&nbsp;:
                                <span class="font-semibold">
                                    <a href="/users/c/e-commerce/sc/site-e-commerce">Développeur e-commerce</a>, 
                                    <a href="/users/c/web/sc/shopify">Développeur Shopify</a>
                                </span>
                            </span>
                        </p>
                    </section>
                </body>
            </html>
        `;

        // Mock specific fetch calls
        fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') }); // For /messages
        fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(mockProjectListPageHtml) }); // For /projects
        fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(mockProjectDetailPageHtml) }); // For /projects/1-new-project
        fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ response: 'OUI' }), text: () => Promise.resolve('OUI') }); // For Ollama API
        fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ response: 'This is a proposal' }) });
        fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html><head><meta name="csrf-token" content="test-token"></head></html>') });
        fetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('Success') });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should scrape projects, visit details, analyze, and save them when run for the first time', async () => {
        // Arrange
        // Mock fs.promises.readFile and writeFile locally for this test
        const readFileSpy = jest.spyOn(fs.promises, 'readFile');
        const writeFileSpy = jest.spyOn(fs.promises, 'writeFile');

        // Mock specific readFile calls based on file path
        readFileSpy.mockImplementation((file, encoding) => {
            if (file.includes('auth.json')) return Promise.resolve(mockAuthFileContent);
            if (file.includes('prompts.json')) return Promise.resolve(JSON.stringify({ promptAnalysis: 'Is it good?', promptQuotation: 'Generate a JSON proposal.' }));
            if (file.includes('ollama-config.json')) return Promise.resolve(JSON.stringify({ ollamaModel: 'test-model' }));
            if (file.includes('projects.json')) return Promise.resolve('[]'); // Ensure it returns an empty array string
            return Promise.reject(new Error(`Unknown file: ${file}`));
        });

        // Mock Ollama fetch call
        fetch.mockImplementation(url => {
            if (url.includes('ollama')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ response: 'OUI' }), text: () => Promise.resolve('OUI') });
            }
            if (url.includes('/messages')) {
                return Promise.resolve({ ok: true, text: () => Promise.resolve('<html></html>') });
            }
            if (url.includes('/projects/1-new-project')) {
                const pageWithToken = `<html><head><meta name="csrf-token" content="test-token"></head><body>${mockProjectDetailPageHtml}</body></html>`;
                return Promise.resolve({ ok: true, text: () => Promise.resolve(pageWithToken) });
            }
            if (url.includes('/projects')) {
                return Promise.resolve({ ok: true, text: () => Promise.resolve(mockProjectListPageHtml) });
            }
            if (url.includes('/offers')) {
                return Promise.resolve({ ok: true, text: () => Promise.resolve('Success') });
            }
            // Default for any other URL not explicitly mocked
            return Promise.resolve({ ok: false, statusText: 'Not Found', text: () => Promise.resolve('Not Found') });
        });


        // Act
        const result = await runBotLogic();

        // Assert
        // 1. Check that writeFile was called to save the new state
        expect(writeFileSpy).toHaveBeenCalledTimes(4);
        const savedData = JSON.parse(writeFileSpy.mock.calls[3][1]);
        
        // 2. Verify the content of the saved data
        expect(savedData).toHaveLength(1);
        const project = savedData[0];
        expect(project.statusProjet).toBe('pertinent');
        expect(project.title).toBe('Refonte page produit Shopify orientée conversion');
        expect(project.description).toBe('Je cherche un freelance Shopify...');
        expect(project.budget).toBe('Moins de 500 €');
        expect(project.skills).toEqual(['Développeur e-commerce', 'Développeur Shopify']);

        // 3. Verify the data returned by the function
        expect(result.success).toBe(true);
        expect(result.data.projects).toEqual(savedData);

        // Restore original fs.promises functions
        jest.restoreAllMocks();
    });
});

describe('analyzeProjectWithOllama', () => {
    const { analyzeProjectWithOllama } = require('../bot');
    const fetch = require('node-fetch');
    const fs = require('fs');
    const path = require('path');
    // Mock the node-fetch module locally for this describe block
    jest.mock('node-fetch', () => jest.fn());




    beforeEach(() => {
        fetch.mockClear();
        // Mock fs.promises.readFile locally for these tests
        jest.spyOn(require('fs').promises, 'readFile').mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should return "analysé - pertinent" when Ollama responds with OUI', async () => {
        // Arrange
        const project = { title: 'Test Project', description: 'Test Desc', budget: '100' };
        const mockPrompts = { promptAnalysis: 'Is this a good project?' };
        const mockReadFileSpy = jest.spyOn(fs.promises, 'readFile')
            .mockResolvedValueOnce(JSON.stringify({ ollamaModel: 'test-model' })) // For ollama-config.json
            .mockResolvedValueOnce(JSON.stringify(mockPrompts)); // For prompts.json
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ response: 'OUI' }),
        });

        // Act
        const result = await analyzeProjectWithOllama(project);

        // Assert
        expect(result).toBe('pertinent');
        expect(mockReadFileSpy).toHaveBeenCalledWith(path.join(__dirname, '..', 'prompts.json'), 'utf8');
        expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.any(Object));
    });

    test('should return "analysé - non pertinent" when Ollama responds with NON', async () => {
        // Arrange
        const project = { title: 'Test Project', description: 'Test Desc', budget: '100' };
        const mockPrompts = { promptAnalysis: 'Is this a good project?' };
        const mockReadFileSpy = jest.spyOn(fs.promises, 'readFile')
            .mockResolvedValueOnce(JSON.stringify({ ollamaModel: 'test-model' })) // For ollama-config.json
            .mockResolvedValueOnce(JSON.stringify(mockPrompts)); // For prompts.json
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ response: 'NON' }),
        });

        // Act
        const result = await analyzeProjectWithOllama(project);

        // Assert
        expect(result).toBe('non pertinent');
        expect(mockReadFileSpy).toHaveBeenCalledWith(path.join(__dirname, '..', 'prompts.json'), 'utf8');
        expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.any(Object));
    });

    test('should throw an error if the Ollama API request fails', async () => {
        // Arrange
        const project = { title: 'Test Project', description: 'Test Desc', budget: '100' };
        const mockPrompts = { promptAnalysis: 'Is this a good project?' };
        const mockReadFileSpy = jest.spyOn(fs.promises, 'readFile')
            .mockResolvedValueOnce(JSON.stringify({ ollamaModel: 'test-model' })) // For ollama-config.json
            .mockResolvedValueOnce(JSON.stringify(mockPrompts)); // For prompts.json
        fetch.mockRejectedValueOnce(new Error('Ollama API request failed'));

        // Act & Assert
        await expect(analyzeProjectWithOllama(project)).rejects.toThrow('Ollama API request failed');
        expect(mockReadFileSpy).toHaveBeenCalledWith(path.join(__dirname, '..', 'prompts.json'), 'utf8');
        expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.any(Object));
    });

    test('should throw an error if promptAnalysis is not in prompts.json', async () => {
        // Arrange
        const project = { title: 'Test Project', description: 'Test Desc', budget: '100' };
        const mockPrompts = {}; // Missing promptAnalysis
        const mockReadFileSpy = jest.spyOn(fs.promises, 'readFile')
            .mockResolvedValueOnce(JSON.stringify({ ollamaModel: 'test-model' })) // For ollama-config.json
            .mockResolvedValueOnce(JSON.stringify(mockPrompts)); // For prompts.json

        // Act & Assert
        await expect(analyzeProjectWithOllama(project)).rejects.toThrow('promptAnalysis not found in prompts.json');
        expect(mockReadFileSpy).toHaveBeenCalledWith(path.join(__dirname, '..', 'prompts.json'), 'utf8');
        expect(mockReadFileSpy).toHaveBeenCalledWith(path.join(__dirname, '..', 'prompts.json'), 'utf8');
    });
});

describe('generateProposalWithOllama', () => {
    const { generateProposalWithOllama } = require('../bot');
    const fetch = require('node-fetch');
    const fs = require('fs');
    const path = require('path');

    beforeEach(() => {
        fetch.mockClear();
        jest.spyOn(fs.promises, 'readFile').mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should generate a proposal successfully', async () => {
        // Arrange
        const project = { title: 'Test Project', description: 'Test Desc', budget: '100' };
        const mockPrompts = { promptQuotation: 'Generate a proposal.' };
        const mockOllamaMessage = 'This is a test proposal message.';
        jest.spyOn(fs.promises, 'readFile')
            .mockResolvedValueOnce(JSON.stringify({ ollamaModel: 'test-model' })) // For ollama-config.json
            .mockResolvedValueOnce(JSON.stringify(mockPrompts)); // For prompts.json
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ response: mockOllamaMessage }),
        });

        // Act
        const proposal = await generateProposalWithOllama(project);

        // Assert
        expect(proposal).toEqual({
            amount: 100,
            deadline: 7,
            message: mockOllamaMessage
        });
        expect(proposal.messageSuite).toBeUndefined();
        expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.any(Object));
    });

    test('should throw an error if Ollama API request fails', async () => {
        // Arrange
        const project = { title: 'Test Project', description: 'Test Desc', budget: '100' };
        const mockPrompts = { promptQuotation: 'Generate a proposal.' };
        jest.spyOn(fs.promises, 'readFile')
            .mockResolvedValueOnce(JSON.stringify({ ollamaModel: 'test-model' })) // For ollama-config.json
            .mockResolvedValueOnce(JSON.stringify(mockPrompts)); // For prompts.json
        fetch.mockRejectedValueOnce(new Error('Ollama API request failed'));

        // Act & Assert
        await expect(generateProposalWithOllama(project)).rejects.toThrow('Ollama API request failed');
    });

    test('should throw an error if promptQuotation is not in prompts.json', async () => {
        // Arrange
        const project = { title: 'Test Project', description: 'Test Desc', budget: '100' };
        const mockPrompts = {}; // Missing promptQuotation
        jest.spyOn(fs.promises, 'readFile')
            .mockResolvedValueOnce(JSON.stringify({ ollamaModel: 'test-model' })) // For ollama-config.json
            .mockResolvedValueOnce(JSON.stringify(mockPrompts)); // For prompts.json

        // Act & Assert
        await expect(generateProposalWithOllama(project)).rejects.toThrow('promptQuotation not found in prompts.json');
    });

    test('should split message if it is longer than 1000 characters', async () => {
        // Arrange
        const project = { title: 'Test Project', description: 'Test Desc', budget: '100' };
        const mockPrompts = { promptQuotation: 'Generate a proposal.' };
        const longMessage = 'a'.repeat(1500);
        jest.spyOn(fs.promises, 'readFile')
            .mockResolvedValueOnce(JSON.stringify({ ollamaModel: 'test-model' })) // For ollama-config.json
            .mockResolvedValueOnce(JSON.stringify(mockPrompts)); // For prompts.json
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ response: longMessage }),
        });

        // Act
        const proposal = await generateProposalWithOllama(project);

        // Assert
        expect(proposal.message.length).toBe(1000);
        expect(proposal.message).toBe(longMessage.substring(0, 1000));
        expect(proposal.messageSuite).toBe(longMessage.substring(1000));
        expect(proposal.amount).toBe(100);
        expect(proposal.deadline).toBe(7);
    });
});