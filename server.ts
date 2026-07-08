import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const DATA_DIR = path.join(process.cwd(), 'data');

function getCard(cardName: string) {
    const filename = cardName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filePath = path.join(DATA_DIR, 'cards', `${filename}.json`);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
}

function getDeck(deckName: string) {
    const filename = deckName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filePath = path.join(DATA_DIR, 'decks', `${filename}.json`);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
}

async function callOpenRouter(prompt: string, image?: { mimeType: string, data: string }) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ais-dev-jeumm4c2k3cnjo65qnxzjy-195196720664.us-west2.run.app",
      "X-Title": "Pokemon TCG Deck Builder"
    },
    body: JSON.stringify({
      model: "google/gemini-3.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...(image ? [{ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } }] : [])
          ]
        }
      ]
    })
  });
  if (!response.ok) {
      throw new Error(`OpenRouter API error: ${await response.text()}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

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

      const jsonText = await callOpenRouter(`Analyze this HTML from a Pokemon TCG card search page. Extract a JSON list of cards found. Each card should have "name" and "imageSrc". Do not hallucinate. Return JSON array.
      HTML: ${html.substring(0, 15000)}`);
      
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

      const jsonText = await callOpenRouter(`Analyze this Pokemon TCG Pocket card image and extract gameplay details: "name", "type", "hp", "effectText". Do not hallucinate.`, { mimeType: "image/png", data: base64 });
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

      const deckLinksText = await callOpenRouter(`Analyze this HTML of competitive Pokemon TCG Pocket decks. Extract the URLs to the top 2 deck lists. Only return a JSON array of strings: ["url1", "url2"].
      HTML: ${html.substring(0, 10000)}`);
      const deckLinks = JSON.parse(deckLinksText.replace(/```json\n?|\n?```/g, ''));
      
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
          
          const analysisText = await callOpenRouter(analyzePrompt);
          analyses.push(JSON.parse(analysisText.replace(/```json\n?|\n?```/g, '')));
      }

      res.json(analyses);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to analyze decks" });
    }
  });

  // API route for generating a customized deck based on a structured query
  app.post("/api/generate-deck", async (req, res) => {
    const { 
      prompt, 
      excludedCards = [], 
      maxEnergy = 'any', 
      minHP = 'any', 
      maxRetreat = 'any', 
      noEx = false, 
      noWeakness = false, 
      minDamage = 'any', 
      selectedType = 'any' 
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    try {
      console.log(`Generating deck for prompt: "${prompt}", selectedType: ${selectedType}`);

      // 1. Identify types from prompt and parameters
      const typesToLoad = new Set<string>();
      if (selectedType !== 'any') {
        typesToLoad.add(selectedType.toLowerCase());
      } else {
        // Detect types from prompt keywords
        const knownTypes = ["grass", "fire", "water", "lightning", "psychic", "fighting", "darkness", "metal", "dragon", "colorless"];
        const lowerPrompt = prompt.toLowerCase();
        for (const type of knownTypes) {
          if (lowerPrompt.includes(type) || (type === "lightning" && lowerPrompt.includes("electric"))) {
            typesToLoad.add(type);
          }
        }
      }

      // Always load trainers as they are universally relevant
      typesToLoad.add("trainer");

      // 2. Fetch cards only from those specific types from our organized database files
      let cardsToConsider: any[] = [];
      const loadedTypes: string[] = [];

      for (const type of typesToLoad) {
        const typeFilePath = path.join(DATA_DIR, 'cards', 'by-type', `${type}.json`);
        if (fs.existsSync(typeFilePath)) {
          const typeCards = JSON.parse(fs.readFileSync(typeFilePath, 'utf8'));
          cardsToConsider = cardsToConsider.concat(typeCards);
          loadedTypes.push(type);
        }
      }

      // 3. Fallback/Enrichment: Scan prompt for specific Pokémon names mentioned
      const words = prompt.split(/[^a-zA-Z]/).map((w: string) => w.toLowerCase()).filter((w: string) => w.length > 2);
      const allCardsDir = path.join(DATA_DIR, 'cards', 'all');
      if (fs.existsSync(allCardsDir)) {
        const allCardFiles = fs.readdirSync(allCardsDir);
        for (const file of allCardFiles) {
          const cardNameBase = file.replace('.json', '');
          if (words.includes(cardNameBase) || words.some(w => cardNameBase.includes(w))) {
            const filePath = path.join(allCardsDir, file);
            try {
              const card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              if (!cardsToConsider.some(c => c.id === card.id)) {
                cardsToConsider.push(card);
              }
            } catch (err) {
              // ignore
            }
          }
        }
      }

      // If cards are extremely sparse, load top tier meta-deck cards as a baseline pool
      if (cardsToConsider.length <= 100) {
        const metaDecksDir = path.join(DATA_DIR, 'decks', 'all');
        if (fs.existsSync(metaDecksDir)) {
          const deckFiles = fs.readdirSync(metaDecksDir);
          const metaCardIds = new Set<string>();
          for (const file of deckFiles.slice(0, 10)) {
            try {
              const deck = JSON.parse(fs.readFileSync(path.join(metaDecksDir, file), 'utf8'));
              for (const list of deck.lists) {
                for (const cEntry of list.cards) {
                  const cardId = cEntry.split(':')[1];
                  if (cardId) metaCardIds.add(cardId.toLowerCase());
                }
              }
            } catch (e) {}
          }
          for (const cardId of metaCardIds) {
            const cleanId = cardId.replace(/[^a-z0-9-]/gi, "_").toLowerCase();
            const filePath = path.join(allCardsDir, `${cleanId}.json`);
            if (fs.existsSync(filePath)) {
              try {
                const card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (!cardsToConsider.some(c => c.id === card.id)) {
                  cardsToConsider.push(card);
                }
              } catch (e) {}
            }
          }
        }
      }

      // 4. Load relevant meta decks
      let relevantDecks: any[] = [];
      const loadedDecksNames = new Set<string>();

      // Load by selected/detected types
      for (const type of typesToLoad) {
        if (type === 'trainer') continue;
        const decksFilePath = path.join(DATA_DIR, 'decks', 'by-type', `${type}.json`);
        if (fs.existsSync(decksFilePath)) {
          const typeDecks = JSON.parse(fs.readFileSync(decksFilePath, 'utf8'));
          for (const d of typeDecks) {
            if (!loadedDecksNames.has(d.name)) {
              relevantDecks.push(d);
              loadedDecksNames.add(d.name);
            }
          }
        }
      }

      // Check specific Pokemon matches
      for (const word of words) {
        const deckPokemonPath = path.join(DATA_DIR, 'decks', 'by-pokemon', `${word}.json`);
        if (fs.existsSync(deckPokemonPath)) {
          const pkmnDecks = JSON.parse(fs.readFileSync(deckPokemonPath, 'utf8'));
          for (const d of pkmnDecks) {
            if (!loadedDecksNames.has(d.name)) {
              relevantDecks.push(d);
              loadedDecksNames.add(d.name);
            }
          }
        }
      }

      // Fallback: load top 2 generic meta-decks
      if (relevantDecks.length === 0) {
        const metaDecksDir = path.join(DATA_DIR, 'decks', 'all');
        if (fs.existsSync(metaDecksDir)) {
          const deckFiles = fs.readdirSync(metaDecksDir);
          for (const file of deckFiles.slice(0, 2)) {
            try {
              const deck = JSON.parse(fs.readFileSync(path.join(metaDecksDir, file), 'utf8'));
              if (!loadedDecksNames.has(deck.name)) {
                relevantDecks.push(deck);
                loadedDecksNames.add(deck.name);
              }
            } catch (e) {}
          }
        }
      }

      // Filter cardsToConsider to apply basic criteria
      let filteredCards = cardsToConsider;
      if (noEx) {
        filteredCards = filteredCards.filter(c => c.ex !== 'Yes');
      }
      if (selectedType !== 'any') {
        filteredCards = filteredCards.filter(c => (c.type || '').toLowerCase() === selectedType.toLowerCase() || (c.type || '').toLowerCase() === 'trainer');
      }

      // Limit filteredCards count to prevent huge prompt sizes
      filteredCards = filteredCards.slice(0, 150);

      const simplifiedCards = filteredCards.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        hp: c.health,
        stage: c.stage,
        ex: c.ex,
        set: c.set,
        pack: c.pack,
        rarity: c.rarity,
        text: c.text
      }));

      const formattedMetaDecks = relevantDecks.slice(0, 2).map(d => {
        return {
          name: d.name,
          lists: d.lists.slice(0, 1).map((l: any) => l.cards)
        };
      });

      console.log(`Sending query with ${simplifiedCards.length} matching cards and ${relevantDecks.length} relevant meta-decks to OpenRouter.`);

      const systemPrompt = `You are an absolute expert Pokemon TCG Pocket deck generator, competitive data analyst, and tournament master.
The user wants a deck based on: "${prompt}".

CRITICAL TOURNAMENT META REFERENCE:
We found these highly relevant top-performing tournament deck lists in our database:
${JSON.stringify(formattedMetaDecks, null, 2)}
You MUST prioritize utilizing these tournament-winning deck layouts as your direct baseline! If the user's prompt has custom rules (like "no ex" or "min 130 HP"), adjust this list smartly by replacing the non-essential cards with optimal ones from the Available Cards List below.

CRITICAL CARD KNOWLEDGE & ACCURACY INSTRUCTIONS:
- You MUST prioritize using the exact text and effects provided in the "text" field of the cards inside the "Available Cards List" below. This represents real, verified, OCR-scanned rules from the game.
- You MUST NOT hallucinate or guess any card details, effects, or abilities. If a card has an associated "text" property, that is its official active effect (for example, "Lt. Surge" moves energy from benched Pokemon of specific names to Pikachu/Pikachu ex, and "Lisia" searches for up to 2 Basic Lightning-type Pokémon with 50 HP or less). Use these precise rules in your deck composition, selection, and "details" descriptions!
- Every card in the "cards" list you return must have highly detailed explanations inside "details" describing its actual mechanical purpose, stage, and role in Pokemon TCG Pocket. For example:
  * Dratini is a Basic Pokemon (NOT Stage 1), and belongs to the Dragonite evolution line (Dratini -> Dragonair -> Dragonite).
  * Axew is a Basic Pokemon, Fraxure is Stage 1, and Haxorus is Stage 2. (Axew -> Fraxure -> Haxorus).
  * Misty is a Supporter card that flips coins to attach Water Energy to Water Pokemon, and Sabrina is a Supporter card that forces the opponent to switch their Active Pokemon.
  * Poke Ball is a Trainer card that searches for a Basic Pokemon.
  * Rare Candy is a Trainer card that allows you to evolve a Basic Pokemon directly to a Stage 2 Pokemon, which is a key speed engine for any Stage 2 deck.

CRITICAL EVOLUTIONARY LINE INTEGRITY RULES:
- You must always respect proper, exact evolutionary chains as they exist in the Pokemon franchise.
- DO NOT mix up different evolution families! For example:
  * Dratini (Basic) -> Dragonair (Stage 1) -> Dragonite (Stage 2). [Never Haxorus]
  * Axew (Basic) -> Fraxure (Stage 1) -> Haxorus (Stage 2). [Never Dragonite]
  * Charmander (Basic) -> Charmeleon (Stage 1) -> Charizard (Stage 2).
- If you include a Stage 2 Pokemon, you do not always need a full equal evolution line (like 2-2-2) if you run Rare Candy. A competitive meta ratio for a Stage 2 deck running Rare Candy is: 2 Basics, 1 Stage 1, and 2 Stage 2s (with 2 Rare Candies), or direct skip lines like 2 Basics and 2 Stage 2s (with 2 Rare Candies). Always make sure you include the proper Basic (and optional Stage 1 if utilizing Rare Candy) pre-evolution belonging to the same exact evolution family. Mismatching family lines is a critical failure. If a Stage 2 Pokemon is featured, ensure you also include 2 copies of "Rare Candy" to enable these accelerated transitions!

CRITICAL ENERGY AND TYPE CONSISTENCY RULES:
- You MUST ensure the deck has strict energy type alignment and compatibility. In Pokemon TCG Pocket, decks do not typically run more than 1 or 2 different energy types.
- Under NO circumstance should you throw in a lone Pokemon of a different type that requires its own distinct energy type to attack (e.g., adding a single Water Pokemon requiring Water Energy in a deck full of Psychic Pokemon requiring Psychic Energy), unless:
  1. It is a Colorless Pokemon (which can use any energy type for its attacks).
  2. Its role is purely non-attacking and its Poke-Power/Ability is useful and does not require active energy attachment of its own type.
- Always verify that the energy required for every Pokemon's attacks matches the energy type(s) that the deck will generate. A deck with incompatible energy types (e.g. running Venusaur and Charizard together without any shared energy or logical engine) is a critical failure.

CRITICAL CARD DETAIL REQUIREMENTS:
For EACH card in your returned JSON list, you MUST provide an extremely comprehensive, exact, and detailed explanation in the "details" field.
This explanation MUST include:
1. The EXACT name of the card's primary Attack(s) and/or Poke-Power/Abilities as they exist in Pokemon TCG Pocket (NOT standard TCG, specifically TCG Pocket!).
2. The exact Energy requirements and exact damage output (e.g., "Psydrive: 150 damage for 2 Psychic and 1 Colorless energy").
3. The exact gameplay mechanics, synergy, or effect of the attack/ability (e.g., "Gardevoir's 'Psy Shadow' Poke-Power allows you to attach a Psychic energy from your discard pile to your active Psychic Pokemon once per turn").
4. How this card's specific attack/ability synergizes perfectly with the rest of the deck and tournament-level meta strategies.

CRITICAL DUPLICATE CARD NAME RULES:
- Under NO circumstance should a card name appear more than twice (2 copies max) in the deck, even if they have different card IDs, different sets, or different art styles (e.g. you cannot have 2 copies of Poké Ball from set A and 1 copy of Poké Ball from set B. The absolute maximum total count of cards named "Poké Ball" in the deck is 2).
- Ensure that you sum the 'count' fields of all cards with the SAME name to be at most 2.

CRITICAL DECK-BUILDING PRINCIPLES:
- Deep Meta Analysis: Automatically filter out cards that are statistically unviable or a waste of deck space in competitive play, unless the user explicitly asks for them.
- Synergistic Adaptability: Every single trainer, supporter, and item chosen must make logical sense for the specific Pokemon lineup you've selected.
- Flexible Optimization: Adapt dynamically to the user's prompt to find the absolute best 20-card combination possible based on advanced meta intelligence.

${excludedCards.length > 0 ? `CRITICAL INSTRUCTION: You MUST NOT use any of the following card IDs in the deck. The user does not have them or explicitly excluded them:\n[${excludedCards.join(', ')}]\nYou must find the next best competitive alternative cards to fill their spots.\n` : ''}

Available Cards List (use this to get the exact "id" for each card you choose):
${JSON.stringify(simplifiedCards)}

Return ONLY a valid JSON object in this exact format:
{
  "deckName": "Name of the Deck",
  "description": "Short explanation of how the deck works and why these cards were chosen, mentioning how they fit the advanced search criteria and competitive tournament data.",
  "cards": [
    { "id": "card-id", "count": 2, "details": "The complete attack/ability details (including exact name, energy cost, damage, effects, and tournament synergy)" },
    ...
  ]
}
A valid Pokemon TCG Pocket deck MUST have exactly 20 cards. CRITICAL RULE: A deck MUST NOT contain more than 2 copies of any card with the same name, even if they have different IDs. You must set the "count" field to 1 or 2. Never 3 or more. Return an array of exactly 20 cards by sum of counts. Do not use Markdown formatting in the output, just raw JSON.`;

      const aiResponse = await callOpenRouter(systemPrompt);
      let parsed = null;
      try {
        let text = aiResponse.toString().trim();
        text = text.replace(/^```json\n?/i, '');
        text = text.replace(/^```\n?/i, '');
        text = text.replace(/```$/i, '');
        parsed = JSON.parse(text.trim());
      } catch (err) {
        console.error("Failed to parse response from OpenRouter", aiResponse);
        return res.status(500).json({ error: "Failed to parse the AI generated response." });
      }

      res.json(parsed);
    } catch (error) {
      console.error("Error in generate-deck:", error);
      res.status(500).json({ error: "An error occurred during deck generation." });
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
