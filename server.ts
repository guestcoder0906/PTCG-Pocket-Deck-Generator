import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Helper to safely read JSON files
const readJson = (filename: string) => {
  const filePath = path.join(process.cwd(), 'dist', filename);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
  }
  return [];
};

app.get('/api/cards', (req, res) => {
  const cards = readJson('cards.json');
  res.json(cards);
});

app.get('/api/sets', (req, res) => {
  const sets = readJson('sets.json');
  res.json(sets);
});

const isProd = process.env.NODE_ENV === 'production';

async function createServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const clientPath = path.join(process.cwd(), 'dist', 'client');
    if (fs.existsSync(clientPath)) {
      app.use(express.static(clientPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(clientPath, 'index.html'));
      });
    } else {
      app.get('/', (req, res) => {
        res.send(`
          <html>
            <head>
              <title>Pokemon TCG Pocket Database</title>
              <style>
                body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; line-height: 1.6; }
                code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
              </style>
            </head>
            <body>
              <h1>Pokemon TCG Pocket API</h1>
              <p>This is a JSON database API for Pokemon TCG Pocket.</p>
              <p>Note: The React client is not built yet. Run npm run build.</p>
            </body>
          </html>
        `);
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

createServer();
