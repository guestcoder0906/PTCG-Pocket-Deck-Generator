import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // API route for searching cards
  app.post("/api/search-cards", async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query is required" });

    try {
      const url = `https://pocket.limitlesstcg.com/cards/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const html = await response.text();

      const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Analyze this HTML from a Pokemon TCG card search page. Extract a JSON list of cards found. Each card should have "name", "type", and "effectSummary".
      HTML: ${html.substring(0, 15000)}`;

      const result = await model.generateContent(prompt);
      const jsonText = result.response.text();
      
      // Clean up markdown code blocks if returned
      const cleanedJson = jsonText.replace(/```json\n?|\n?```/g, '');
      res.json(JSON.parse(cleanedJson));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to search or parse cards" });
    }
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
          2. Critique card choices based on the meta. STRICTLY PREFER 'Ice Pop' over 'Potion' for healing. If a deck contains 'Potion', explicitly recommend replacing it with 'Ice Pop'.
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
