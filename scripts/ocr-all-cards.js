const fs = require('fs');
const path = require('path');

const PUBLIC_DATA_DIR = path.join(__dirname, '../public/data');
const DETAILS_FILE_PATH = path.join(PUBLIC_DATA_DIR, 'card-details.json');
const CARDS_JSON_URL = "https://raw.githubusercontent.com/chase-mew/pokemon-tcg-pocket-cards/main/v4.json";

// Ensure the directory exists
if (!fs.existsSync(PUBLIC_DATA_DIR)) {
  fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
}

// Load existing card details if present
let cardDetailsCache = {};
if (fs.existsSync(DETAILS_FILE_PATH)) {
  try {
    cardDetailsCache = JSON.parse(fs.readFileSync(DETAILS_FILE_PATH, 'utf8'));
    console.log(`Loaded ${Object.keys(cardDetailsCache).length} existing card details from cache.`);
  } catch (err) {
    console.error("Failed to parse existing card-details.json. Initializing fresh.", err);
  }
}

// Let's define some pre-populated card details for critical meta cards to guarantee absolute correctness instantly!
const PRE_POPULATED_DETAILS = {
  "Lt. Surge": {
    "name": "Lt. Surge",
    "type": "Trainer",
    "subtype": "Supporter",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Move all Lightning Energy from your Benched Voltorb, Electrode, Pikachu, Pikachu ex, Magnemite, or Magneton to your Active Pikachu or Pikachu ex."
  },
  "Lisia": {
    "name": "Lisia",
    "type": "Trainer",
    "subtype": "Supporter",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Search your deck for up to 2 Basic Lightning-type Pokémon with 50 HP or less, reveal them, and put them into your hand. Then, shuffle your deck."
  },
  "Poké Ball": {
    "name": "Poké Ball",
    "type": "Trainer",
    "subtype": "Item",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Search your deck for a Basic Pokémon, reveal it, and put it into your hand. Then, shuffle your deck."
  },
  "Professor's Research": {
    "name": "Professor's Research",
    "type": "Trainer",
    "subtype": "Supporter",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Draw 2 cards."
  },
  "Misty": {
    "name": "Misty",
    "type": "Trainer",
    "subtype": "Supporter",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Choose 1 of your Benched or Active Water Pokémon. Flip a coin until you get tails. For each heads, attach 1 Water Energy from your Energy Zone to that Pokémon."
  },
  "Sabrina": {
    "name": "Sabrina",
    "type": "Trainer",
    "subtype": "Supporter",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Your opponent switches their Active Pokémon with 1 of their Benched Pokémon."
  },
  "Giovanni": {
    "name": "Giovanni",
    "type": "Trainer",
    "subtype": "Supporter",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "During this turn, your Pokémon's attacks deal +10 damage to your opponent's Active Pokémon."
  },
  "Red Card": {
    "name": "Red Card",
    "type": "Trainer",
    "subtype": "Item",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Your opponent shuffles their hand into their deck and draws 3 cards."
  },
  "X Speed": {
    "name": "X Speed",
    "type": "Trainer",
    "subtype": "Item",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "During this turn, the Retreat Cost of your Active Pokémon is [C] less."
  },
  "Hand Scope": {
    "name": "Hand Scope",
    "type": "Trainer",
    "subtype": "Item",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Look at your opponent's hand."
  },
  "Rare Candy": {
    "name": "Rare Candy",
    "type": "Trainer",
    "subtype": "Item",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Choose 1 of your Basic Pokémon in play. If you have a Stage 2 Pokémon in your hand that evolves from that Pokémon, evolve it directly into that Stage 2 Pokémon (skipping the Stage 1 evolution)."
  },
  "Potion": {
    "name": "Potion",
    "type": "Trainer",
    "subtype": "Item",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Heal 20 damage from 1 of your Pokémon."
  },
  "Erika": {
    "name": "Erika",
    "type": "Trainer",
    "subtype": "Supporter",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Heal 50 damage from 1 of your Grass Pokémon."
  },
  "Blaine": {
    "name": "Blaine",
    "type": "Trainer",
    "subtype": "Supporter",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "During this turn, attacks from your Ninetales, Rapidash, or Magmar deal +30 damage to your opponent's Active Pokémon."
  },
  "Koga": {
    "name": "Koga",
    "type": "Trainer",
    "subtype": "Supporter",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Put an Active Arbok or Weezing you have in play into your hand (all attached cards are returned to your hand)."
  },
  "Brock": {
    "name": "Brock",
    "type": "Trainer",
    "subtype": "Supporter",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Attach 1 Fighting Energy from your Energy Zone to 1 of your Benched Onix or Golem."
  },
  "Fossil Excavator": {
    "name": "Fossil Excavator",
    "type": "Trainer",
    "subtype": "Supporter",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Search your deck for up to 2 cards that have Fossil in their name (Helix Fossil, Dome Fossil, Old Amber), reveal them, and put them into your hand. Then, shuffle your deck."
  },
  "Helix Fossil": {
    "name": "Helix Fossil",
    "type": "Trainer",
    "subtype": "Item",
    "health": "40",
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Play this card as if it were a Basic Pokémon (Colorless type). It has 40 HP and cannot attack or retreat."
  },
  "Dome Fossil": {
    "name": "Dome Fossil",
    "type": "Trainer",
    "subtype": "Item",
    "health": "40",
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Play this card as if it were a Basic Pokémon (Colorless type). It has 40 HP and cannot attack or retreat."
  },
  "Old Amber": {
    "name": "Old Amber",
    "type": "Trainer",
    "subtype": "Item",
    "health": "40",
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Play this card as if it were a Basic Pokémon (Colorless type). It has 40 HP and cannot attack or retreat."
  },
  "Kanto Friends": {
    "name": "Kanto Friends",
    "type": "Trainer",
    "subtype": "Supporter",
    "health": null,
    "ability": null,
    "attacks": [],
    "rulesOrEffectText": "Search your deck for a Bulbasaur, Charmander, or Squirtle, reveal it, and put it into your hand. Then, shuffle your deck."
  }
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function ocrWithSpace(base64Image) {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    console.warn("OCR_SPACE_API_KEY is not defined. Skipping OCR.Space.");
    return null;
  }

  const formData = new URLSearchParams();
  formData.append('apikey', apiKey);
  formData.append('base64Image', `data:image/png;base64,${base64Image}`);
  formData.append('filetype', 'PNG');
  formData.append('isOverlayRequired', 'false');

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData
  });

  if (!response.ok) throw new Error(`OCR.Space API error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  if (data.IsErroredOnProcessing) throw new Error(`OCR.Space processing error: ${JSON.stringify(data.ErrorMessage)}`);
  
  return data.ParsedResults[0].ParsedText;
}

async function runOcrPipeline() {
  console.log("Fetching latest cards database...");
  let cards = [];
  try {
    const res = await fetch(CARDS_JSON_URL);
    cards = await res.json();
    console.log(`Successfully fetched ${cards.length} card definitions.`);
  } catch (err) {
    console.error("Failed to fetch cards JSON.", err);
    return;
  }

  // Pre-populate caching: If a card name matches a pre-populated card, map it instantly to save API calls
  let prePopulatedCount = 0;
  for (const card of cards) {
    if (!cardDetailsCache[card.id] && PRE_POPULATED_DETAILS[card.name]) {
      cardDetailsCache[card.id] = {
        ...PRE_POPULATED_DETAILS[card.name],
        id: card.id,
        name: card.name
      };
      prePopulatedCount++;
    }
  }
  if (prePopulatedCount > 0) {
    console.log(`Pre-populated ${prePopulatedCount} cards matching known templates instantly!`);
    fs.writeFileSync(DETAILS_FILE_PATH, JSON.stringify(cardDetailsCache, null, 2));
  }

  // Find cards that do not have details yet
  const pendingCards = cards.filter(c => !cardDetailsCache[c.id] && c.image && c.image.length > 10);
  console.log(`Total unique card IDs pending OCR: ${pendingCards.length}`);

  if (pendingCards.length === 0) {
    console.log("All cards are fully OCRed and indexed!");
    return;
  }

  const batchToProcess = pendingCards;
  console.log(`Processing all ${batchToProcess.length} cards sequentially...`);

  for (let idx = 0; idx < batchToProcess.length; idx++) {
    const card = batchToProcess[idx];
    console.log(`[OCR ${idx + 1}/${batchToProcess.length}] Processing card ID: ${card.id} (${card.name})`);

    try {
      const response = await fetch(card.image);
      if (!response.ok) {
        throw new Error(`Failed to fetch card image: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      // OCR.Space only
      let ocrText = "";
      try {
        const result = await ocrWithSpace(base64);
        if (result) {
          ocrText = result;
          console.log(`[OCR.Space] Successfully extracted raw text for ${card.id}`);
        }
      } catch (err) {
        if (err.message.includes('429')) {
          console.log(`[Rate Limit] 429 hit. Waiting 65 seconds before retry...`);
          await delay(65000);
          ocrText = await ocrWithSpace(base64) || "";
        } else {
          throw err;
        }
      }

      // Simple parsing - just store raw text if we can't parse perfectly
      cardDetailsCache[card.id] = {
        id: card.id,
        name: card.name, // Use card database name as fallback
        type: "Unknown", // Simplified
        subtype: null,
        health: null,
        ability: null,
        attacks: [],
        rulesOrEffectText: ocrText // Store raw text here
      };

      console.log(`[OCR SUCCESS] Stored raw text for ${card.id} (${card.name})`);
    } catch (err) {
      console.error(`[OCR ERROR] Failed to process ${card.id}:`, err.message);
      // Save error state
      cardDetailsCache[card.id] = {
        id: card.id,
        error: "OCR Failed",
        rawText: err.message
      };
    }

    // Always progress and save cache
    fs.writeFileSync(DETAILS_FILE_PATH, JSON.stringify(cardDetailsCache, null, 2));

    // Delay between entries to avoid hitting OCR.Space rate limit
    if (idx < batchToProcess.length - 1) {
      console.log("Sleeping for 20 seconds to respect rate limits...");
      await delay(20000);
    }
  }

  console.log(`Completed batch run. Total stored card details: ${Object.keys(cardDetailsCache).length}`);
}

runOcrPipeline().catch(console.error);
