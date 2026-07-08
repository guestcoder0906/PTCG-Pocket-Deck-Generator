import fs from "node:fs";
import path from "node:path";

const CARDS_URL = "https://raw.githubusercontent.com/chase-manning/pokemon-tcg-pocket-cards/refs/heads/main/v4.json";
const DECKS_PATH = "./public/data/best-decks.json";

async function main() {
  console.log("Starting full database library builder...");

  // Create directories
  const dirs = [
    "./data",
    "./data/cards",
    "./data/cards/all",
    "./data/cards/by-type",
    "./data/decks",
    "./data/decks/all",
    "./data/decks/by-type",
    "./data/decks/by-pokemon"
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 1. Fetch all cards (3520+ cards)
  console.log(`Fetching all cards from ${CARDS_URL}...`);
  const cardsRes = await fetch(CARDS_URL);
  if (!cardsRes.ok) {
    throw new Error(`Failed to fetch cards: ${cardsRes.statusText}`);
  }
  const allCards = await cardsRes.json() as any[];
  console.log(`Fetched ${allCards.length} cards successfully.`);

  // Load existing card-details if available to enrich the card text
  let cardDetails: any = {};
  try {
    const detailsPath = "./public/data/card-details.json";
    if (fs.existsSync(detailsPath)) {
      cardDetails = JSON.parse(fs.readFileSync(detailsPath, "utf-8"));
    }
  } catch (err) {
    console.warn("Could not load card-details.json for enrichment, continuing with base card data.");
  }

  // Group card variables
  const cardsByType: Record<string, any[]> = {};

  // Save cards individually and group by type
  console.log("Organizing and saving card library...");
  for (const card of allCards) {
    const id = card.id;
    const cleanId = id.replace(/[^a-z0-9-]/gi, "_").toLowerCase();
    
    // Enrich with local OCR/rules text if available
    const key = `${card.name}${card.ex === "Yes" ? " ex" : ""}`;
    const detail = cardDetails[card.id] || cardDetails[key] || cardDetails[card.name] || null;
    let text = "";
    if (detail) {
      if (detail.rulesOrEffectText) {
        text = detail.rulesOrEffectText;
      } else {
        const attacksText = Array.isArray(detail.attacks)
          ? detail.attacks.map((a: any) => `${a.name}: ${a.damage ? a.damage + ' damage' : ''} (${a.effect || ''})`).join('; ')
          : '';
        const abilityText = detail.ability ? `Ability: ${detail.ability.name} (${detail.ability.effect})` : '';
        text = [attacksText, abilityText].filter(Boolean).join('. ');
      }
    }
    
    const enrichedCard = {
      ...card,
      text: text || undefined
    };

    // Save individual card JSON
    fs.writeFileSync(`./data/cards/all/${cleanId}.json`, JSON.stringify(enrichedCard, null, 2));

    // Group by type
    const cardType = (card.type || "Trainer").toLowerCase();
    if (!cardsByType[cardType]) {
      cardsByType[cardType] = [];
    }
    cardsByType[cardType].push(enrichedCard);
  }

  // Save cards by type
  for (const [type, list] of Object.entries(cardsByType)) {
    fs.writeFileSync(`./data/cards/by-type/${type}.json`, JSON.stringify(list, null, 2));
    console.log(`Saved ${list.length} cards under type: ${type}`);
  }

  // 2. Load and organize meta decks
  console.log("Loading and organizing competitive meta decks...");
  let decks: any[] = [];
  if (fs.existsSync(DECKS_PATH)) {
    decks = JSON.parse(fs.readFileSync(DECKS_PATH, "utf-8"));
  } else {
    console.warn("best-decks.json not found!");
  }

  const decksByType: Record<string, any[]> = {};
  const decksByPokemon: Record<string, any[]> = {};

  for (const deck of decks) {
    const deckName = deck.name;
    const cleanDeckName = deckName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    
    // Save full deck list
    fs.writeFileSync(`./data/decks/all/${cleanDeckName}.json`, JSON.stringify(deck, null, 2));

    // Analyze deck to find its primary types and Pokemons
    const deckTypes = new Set<string>();
    const deckPokemons = new Set<string>();

    for (const list of deck.lists) {
      for (const cardEntry of list.cards) {
        // format is "2:a1-125" (count:card_id)
        const parts = cardEntry.split(":");
        const cardId = parts[1];
        if (cardId) {
          const cardData = allCards.find(c => c.id === cardId);
          if (cardData) {
            if (cardData.type) {
              deckTypes.add(cardData.type.toLowerCase());
            }
            if (cardData.name) {
              deckPokemons.add(cardData.name.toLowerCase());
            }
          }
        }
      }
    }

    // Index deck by types
    for (const type of deckTypes) {
      if (!decksByType[type]) {
        decksByType[type] = [];
      }
      decksByType[type].push(deck);
    }

    // Index deck by Pokemon name
    for (const p of deckPokemons) {
      if (!decksByPokemon[p]) {
        decksByPokemon[p] = [];
      }
      decksByPokemon[p].push(deck);
    }
  }

  // Save decks by type indices
  for (const [type, list] of Object.entries(decksByType)) {
    fs.writeFileSync(`./data/decks/by-type/${type}.json`, JSON.stringify(list, null, 2));
    console.log(`Saved ${list.length} meta decks under type index: ${type}`);
  }

  // Save decks by Pokemon indices
  for (const [pokemon, list] of Object.entries(decksByPokemon)) {
    const cleanPokemon = pokemon.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    fs.writeFileSync(`./data/decks/by-pokemon/${cleanPokemon}.json`, JSON.stringify(list, null, 2));
  }

  console.log("Database Library builder completed successfully! 3520+ cards and decks are indexed and ready.");
}

main().catch(err => {
  console.error("Error building library database:", err);
  process.exit(1);
});
