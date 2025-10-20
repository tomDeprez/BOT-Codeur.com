const fs = require('fs').promises;
const path = require('path');
const { runBotLogic } = require('../bot');
const fetch = require('node-fetch');

// Mock the node-fetch module
jest.mock('node-fetch', () => jest.fn());

// Mock the fs.promises module
jest.mock('fs', () => ({
    ...jest.requireActual('fs'), // import and retain default behavior
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
    },
}));

describe('runBotLogic', () => {
    let mockAuthFileContent;
    let mockProjectListPageHtml;
    let mockProjectDetailPageHtml;

    beforeEach(() => {
        // Reset mocks before each test
        fetch.mockClear();
        fs.readFile.mockClear();
        fs.writeFile.mockClear();

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

        // Default fetch mock
        fetch.mockImplementation((url) => {
            if (url.includes('/messages')) {
                return Promise.resolve({ ok: true, text: () => Promise.resolve('<html></html>') });
            }
            if (url.includes('/projects/1-new-project')) {
                return Promise.resolve({ ok: true, text: () => Promise.resolve(mockProjectDetailPageHtml) });
            }
            if (url.includes('/projects')) {
                return Promise.resolve({ ok: true, text: () => Promise.resolve(mockProjectListPageHtml) });
            }
            return Promise.resolve({ ok: false, statusText: 'Not Found' });
        });
    });

    test('should scrape projects, visit details, and save them when run for the first time', async () => {
        // Arrange
        // 1. Simulate auth file exists
        fs.readFile.mockResolvedValueOnce(mockAuthFileContent);
        // 2. Simulate projects.json does not exist
        fs.readFile.mockRejectedValueOnce(new Error('File not found'));

        // Act
        const result = await runBotLogic();

        // Assert
        // 1. Check that writeFile was called to save the new state
        expect(fs.writeFile).toHaveBeenCalledTimes(1);
        const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
        
        // 2. Verify the content of the saved data
        expect(savedData).toHaveLength(1);
        const project = savedData[0];
        expect(project.status).toBe('visité');
        expect(project.title).toBe('Refonte page produit Shopify orientée conversion');
        expect(project.description).toBe('Je cherche un freelance Shopify...');
        expect(project.budget).toBe('Moins de 500 €');
        expect(project.skills).toEqual(['Développeur e-commerce', 'Développeur Shopify']);

        // 3. Verify the data returned by the function
        expect(result.success).toBe(true);
        expect(result.data.projects).toEqual(savedData);
    });
});
