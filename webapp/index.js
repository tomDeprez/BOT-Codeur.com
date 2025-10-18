const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// API endpoint to save configuration
app.post('/api/config', (req, res) => {
    const config = {
        sessionCookie: req.body.sessionCookie,
        offerPrompt: req.body.offerPrompt,
        messagePrompt: req.body.messagePrompt
    };

    fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), (err) => {
        if (err) {
            console.error('Error saving config:', err);
            return res.status(500).json({ message: 'Erreur lors de la sauvegarde de la configuration.' });
        }
        console.log('Configuration saved successfully.');
        res.json({ message: 'Configuration sauvegardée avec succès !' });
    });
});

const { runBotLogic } = require('./bot.js');

app.listen(port, () => {
  console.log(`Web app listening at http://localhost:${port}`);

  // Run the bot logic once, 5 seconds after startup, for testing.
  console.log('Bot will run in 5 seconds...');
  setTimeout(() => {
    runBotLogic();
  }, 5000);
});