// Mock the node-fetch module
jest.mock('node-fetch', () => jest.fn());





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
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should scrape projects, visit details, analyze, and save them when run for the first time', async () => {
        // Arrange
        // Mock fs.promises.readFile and writeFile locally for this test
        const readFileSpy = jest.spyOn(fs.promises, 'readFile');
        const writeFileSpy = jest.spyOn(fs.promises, 'writeFile');

        // 1. Simulate auth file exists (for Promise.all)
        readFileSpy.mockResolvedValueOnce(mockAuthFileContent);
        // 2. Simulate prompts.json exists (for Promise.all)
        readFileSpy.mockResolvedValueOnce(JSON.stringify({ promptAnalysis: 'Is it good?' }));
        // 3. Simulate ollama-config.json exists (for Promise.all)
        readFileSpy.mockResolvedValueOnce(JSON.stringify({ ollamaModel: 'test-model' }));
        // 4. Simulate projects.json is empty
        readFileSpy.mockResolvedValueOnce('[]');
        // 5. Simulate ollama-config.json exists (inside analyzeProjectWithOllama)
        readFileSpy.mockResolvedValueOnce(JSON.stringify({ ollamaModel: 'test-model' }));
        // 6. Simulate prompts.json exists (inside analyzeProjectWithOllama)
        readFileSpy.mockResolvedValueOnce(JSON.stringify({ promptAnalysis: 'Is it good?' }));

        // Mock Ollama fetch call
        fetch.mockImplementation(url => {
            if (url.includes('ollama')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ response: 'OUI' }), text: () => Promise.resolve('OUI') });
            }
            if (url.includes('/messages')) {
                return Promise.resolve({ ok: true, text: () => Promise.resolve('<html></html>') });
            }
            if (url.includes('/projects/1-new-project')) {
                return Promise.resolve({ ok: true, text: () => Promise.resolve(mockProjectDetailPageHtml) });
            }
            if (url.includes('/projects')) {
                return Promise.resolve({ ok: true, text: () => Promise.resolve(mockProjectListPageHtml) });
            }
            // Default for any other URL not explicitly mocked
            return Promise.resolve({ ok: false, statusText: 'Not Found', text: () => Promise.resolve('Not Found') });
        });


        // Act
        const result = await runBotLogic();

        // Assert
        // 1. Check that writeFile was called to save the new state
        expect(writeFileSpy).toHaveBeenCalledTimes(1);
        const savedData = JSON.parse(writeFileSpy.mock.calls[0][1]);
        
        // 2. Verify the content of the saved data
        expect(savedData).toHaveLength(1);
        const project = savedData[0];
        expect(project.status).toBe('analysé - pertinent');
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
        expect(result).toBe('analysé - pertinent');
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
        expect(result).toBe('analysé - non pertinent');
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
        await expect(analyzeProjectWithOllama(project)).rejects.toThrow('Ollama API request failed: Internal Server Error - Error details');
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