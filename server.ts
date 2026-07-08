import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Shared state for search progress
  const searchProgress: { [key: string]: { status: string; progress: number } } = {};

  // API route for searching cards
  app.post("/api/search-cards", async (req, res) => {
    const { query, requestId } = req.body;
    if (!query) return res.status(400).json({ error: "Query is required" });
    
    searchProgress[requestId] = { status: "Searching...", progress: 0 };

    try {
      // For simplicity, handle just page 1 for now, but design it to be expandable
      const url = `https://pocket.limitlesstcg.com/cards/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const html = await response.text();

      const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Analyze this HTML from a Pokemon TCG card search page. Extract a JSON list of cards found. Each card should have "name" and "imageSrc". Do not hallucinate. Return JSON array.
      HTML: ${html.substring(0, 15000)}`;

      const result = await model.generateContent(prompt);
      const jsonText = result.response.text();
      
      const cards = JSON.parse(jsonText.replace(/```json\n?|\n?```/g, ''));
      searchProgress[requestId] = { status: "Analysis starting...", progress: 10 };
      
      res.json({ cards });
    } catch (error) {
      console.error(error);
      searchProgress[requestId] = { status: "Error", progress: 0 };
      res.status(500).json({ error: "Failed to search" });
    }
  });

  // API route for analyzing a specific card
  app.post("/api/analyze-card", async (req, res) => {
    const { imageUrl, requestId, index, total } = req.body;

    try {
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Analyze this Pokemon TCG Pocket card image and extract gameplay details: "name", "type", "hp", "effectText". Do not hallucinate.`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType: "image/png", data: base64 } }
      ]);
      
      const jsonText = result.response.text();
      const cardDetails = JSON.parse(jsonText.replace(/```json\n?|\n?```/g, ''));
      
      const newProgress = Math.round(10 + (index / total) * 90);
      searchProgress[requestId] = { status: `Analyzing card ${index + 1}/${total}`, progress: newProgress };
      
      res.json(cardDetails);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to analyze" });
    }
  });

  // API route for progress
  app.get("/api/search-progress/:requestId", (req, res) => {
    const { requestId } = req.params;
    res.json(searchProgress[requestId] || { status: "Not started", progress: 0 });
  });

  // API route for analyzing top decks
  app.post("/api/analyze-decks", async (req, res) => {
    try {
      const url = "https://play.limitlesstcg.com/decks?game=pocket";
      const response = await fetch(url);
      const html = await response.text();

      const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // First step: get top deck links
      const prompt = `Analyze this HTML of competitive Pokemon TCG Pocket decks. Extract the URLs to the top 2 deck lists. Only return a JSON array of strings: ["url1", "url2"].
      HTML: ${html.substring(0, 10000)}`;
      
      const result = await model.generateContent(prompt);
      const deckLinks = JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''));
      
      // Second step: analyze decks
      const analyses = [];
      for (const deckUrl of deckLinks) {
          const deckResponse = await fetch(deckUrl.startsWith('http') ? deckUrl : `https://play.limitlesstcg.com${deckUrl}`);
          const deckHtml = await deckResponse.text();
          
          const analyzePrompt = `You are a Pokemon TCG Pocket deck analyzer. Analyze the provided HTML from this deck page: ${deckUrl}.
          Refer to this tier list for meta-relevance: https://github.com/chase-mew/pokemon-tcg-pocket-tier-list.
          Extract the deck name, the list of Pokemon and Energy cards.
          Perform a consistency analysis:
          1. Check if the Energy types present in the deck match the requirements of the Pokemon in the deck. Are there conflicting energy types?
          2. Critique card choices based on the meta. Prioritize superior meta cards (e.g., use 'Ice Pop' instead of 'Potion').
          3. Evaluate energy efficiency: If the deck uses 2+ energy types, flag high-energy-cost Pokemon as inefficient unless energy acceleration/booster cards are present.
          Provide a brief meta-relevance comment based on the tier list.
          Return a JSON object: {"name": "...", "cards": [...], "consistencyAnalysis": "...", "metaRelevance": "..."}
          HTML: ${deckHtml.substring(0, 15000)}`;
          
          const analysisResult = await model.generateContent(analyzePrompt);
          analyses.push(JSON.parse(analysisResult.response.text().replace(/```json\n?|\n?```/g, '')));
      }

      res.json(analyses);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to analyze decks" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
