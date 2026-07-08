import React, { useState } from 'react';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { CARDS_URL } from '../../app/constants';
import { CardType } from '../../contexts/DecksContext';
import CardIcon from '../../components/CardIcon';
import Header from '../../components/Header';

const Container = styled.div`
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 1rem;
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 1.1rem;
  min-height: 120px;
  resize: vertical;
`;

const Button = styled.button`
  padding: 1rem 2rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ResultContainer = styled.div`
  margin-top: 2rem;
  padding: 1.5rem;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
`;

const GeneratorPage = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [excludedCards, setExcludedCards] = useState<string[]>([]);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  // Poll progress in useEffect
  React.useEffect(() => {
    if (!loading) {
      setSearchStatus(null);
      return;
    }
  }, [loading]);

  // Advanced search filters state
  const [showFilters, setShowFilters] = useState(false);
  const [maxEnergy, setMaxEnergy] = useState('any');
  const [minHP, setMinHP] = useState('any');
  const [maxRetreat, setMaxRetreat] = useState('any');
  const [noEx, setNoEx] = useState(false);
  const [noWeakness, setNoWeakness] = useState(false);
  const [minDamage, setMinDamage] = useState('any');
  const [selectedType, setSelectedType] = useState('any');

  React.useEffect(() => {
    const checkAuth = () => {
      if (window.puter && window.puter.auth) {
        setIsSignedIn(window.puter.auth.isSignedIn());
        setCheckingAuth(false);
        return true;
      }
      return false;
    };

    if (!checkAuth()) {
      const interval = setInterval(() => {
        if (checkAuth()) {
          clearInterval(interval);
        }
      }, 150);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        setCheckingAuth(false);
      }, 6000); // Max 6s wait
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, []);

  const handleSignIn = async () => {
    try {
      if (window.puter && window.puter.auth) {
        await window.puter.auth.signIn();
        setIsSignedIn(window.puter.auth.isSignedIn());
      } else {
        setError("Puter AI is not loaded yet. Please wait a moment or refresh the page.");
      }
    } catch (err: any) {
      console.error("Sign in failed", err);
      setError("Puter sign-in failed. Please try again.");
    }
  };

  const handleSignOut = () => {
    if (window.puter && window.puter.auth) {
      window.puter.auth.signOut();
      setIsSignedIn(false);
    }
  };

  const { data: cards } = useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      const response = await fetch(CARDS_URL);
      return response.json() as Promise<CardType[]>;
    },
  });

  const { data: decksData } = useQuery({
    queryKey: ["decks-data"],
    queryFn: async () => {
      const response = await fetch("/data/best-decks.json");
      return response.json();
    }
  });

  const handleExcludeCard = (cardId: string) => {
    const newExcluded = [...excludedCards, cardId];
    setExcludedCards(newExcluded);
    generateDeck(newExcluded);
  };

  const generateDeck = async (overrideExcluded?: string[] | React.MouseEvent) => {
    const currentExcluded = Array.isArray(overrideExcluded) ? overrideExcluded : excludedCards;
    if (!prompt.trim() || !cards) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    const requestId = Math.random().toString(36).substring(7);

    try {
      // 1. Search
      const searchRes = await fetch("/api/search-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: prompt, requestId })
      });
      const { cards: foundCards } = await searchRes.json();
      let matchedMetaDeck: any = null;
      let metaDeckListFormatted = "";
      if (decksData && Array.isArray(decksData)) {
        const lowercasePrompt = prompt.toLowerCase();
        
        // Find if there's any card ID or card name matching words in the prompt
        const matchingCardsFromPrompt = cards.filter(c => 
          lowercasePrompt.includes(c.name.toLowerCase())
        );
        const matchingCardIds = matchingCardsFromPrompt.map(c => c.id);

        let bestScore = -1;
        
        for (const deck of decksData) {
          let matchScore = 0;
          const deckNameLower = deck.name.toLowerCase();
          
          // 1. Match prompt words against deck name
          const promptWords = lowercasePrompt.split(/[\s,&+._\-]+/);
          for (const word of promptWords) {
            if (word.length > 2 && deckNameLower.includes(word)) {
              matchScore += 12;
            }
          }

          // 2. Check if the deck contains cards mentioned in the prompt
          if (deck.lists && deck.lists.length > 0) {
            const firstList = deck.lists[0];
            for (const cardStr of firstList.cards) {
              const id = cardStr.split(":")[1];
              if (matchingCardIds.includes(id)) {
                matchScore += 18;
              }
            }
          }

          if (matchScore > bestScore && matchScore > 0) {
            bestScore = matchScore;
            matchedMetaDeck = deck;
          }
        }

        if (matchedMetaDeck && matchedMetaDeck.lists && matchedMetaDeck.lists.length > 0) {
          const bestList = matchedMetaDeck.lists[0];
          const parsedMetaCards = bestList.cards.map((cStr: string) => {
            const parts = cStr.split(":");
            const count = parseInt(parts[0]);
            const id = parts[1];
            const cardObj = cards.find(c => c.id === id);
            return {
              id,
              count,
              name: cardObj ? cardObj.name : "Unknown",
              type: cardObj ? cardObj.type : "Unknown",
              hp: cardObj ? cardObj.health : null,
              stage: cardObj ? cardObj.stage : null,
              ex: cardObj ? cardObj.ex : null
            };
          });
          metaDeckListFormatted = JSON.stringify(parsedMetaCards, null, 2);
        }
      }

      // Fetch local card details database containing OCR extracted rules and texts
      let cardDetails: any = {};
      try {
        const detailsRes = await fetch("/data/card-details.json");
        if (detailsRes.ok) {
          cardDetails = await detailsRes.json();
        }
      } catch (err) {
        console.warn("Failed to load local card-details.json", err);
      }

      // Create a simplified card dataset to fit in prompt with full metadata
      const simplifiedCards = cards.map(c => {
        const key = `${c.name}${c.ex === "Yes" ? " ex" : ""}`;
        const detail = cardDetails[c.id] || cardDetails[key] || cardDetails[c.name] || null;
        
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

        return {
          id: c.id,
          name: c.name,
          type: c.type,
          hp: c.health,
          stage: c.stage,
          ex: c.ex,
          set: c.set,
          pack: c.pack,
          rarity: c.rarity,
          text: text || undefined
        };
      });

      const activeFilters: string[] = [];
      if (maxEnergy !== 'any') activeFilters.push(`MAXIMUM attack energy cost requirement for any Pokemon in the deck: ${maxEnergy} energy`);
      if (minHP !== 'any') activeFilters.push(`MINIMUM HP for any Pokemon in the deck: ${minHP} HP (excluding evolving Basics that are required for Stage 1/2 evolution chains)`);
      if (maxRetreat !== 'any') activeFilters.push(`MAXIMUM Retreat Cost for any Pokemon in the deck: ${maxRetreat}`);
      if (noEx) activeFilters.push(`No "ex" cards allowed in the deck under any condition!`);
      if (noWeakness) activeFilters.push(`Pokemon cards in the deck MUST have No Weakness (i.e., blank/empty weakness field, or immune/resistant)`);
      if (minDamage !== 'any') activeFilters.push(`The primary attacker's main attack MUST deal at least ${minDamage} damage`);
      if (selectedType !== 'any') activeFilters.push(`The deck's Pokemon cards MUST be primarily of type: ${selectedType}`);

      const filtersPromptSegment = activeFilters.length > 0 
        ? `\nCRITICAL ENFORCED ADVANCED SEARCH FILTERS (You must strictly adhere to these filters when selecting cards for the deck. Do not violate any of these filters!):\n${activeFilters.map(f => `- ${f}`).join('\n')}\n`
        : '';

      const systemPrompt = `You are an absolute expert Pokemon TCG Pocket deck generator, competitive data analyst, and tournament master.
The user wants a deck based on: "${prompt}".
${filtersPromptSegment}

CRITICAL TOURNAMENT META REFERENCE:
${metaDeckListFormatted ? `We found an exact or highly relevant top-performing tournament deck list matching the prompt in our database:
${metaDeckListFormatted}
You MUST prioritize utilizing this tournament-winning deck layout as your direct baseline! If the user's prompt has custom rules (like "no ex" or "min 130 HP"), adjust this list smartly by replacing the non-essential cards with optimal ones from the Available Cards List below. If the prompt does not have custom constraints, try to match this high-level tournament list exactly!` : `No exact tournament deck found. Create the absolute best, most competitive meta-proven deck layout possible using the cards available.`}

CRITICAL CARD KNOWLEDGE & ACCURACY INSTRUCTIONS:
- You MUST prioritize using the exact text and effects provided in the "text" field of the cards inside the "Available Cards List" below. This represents real, verified, OCR-scanned rules from the game.
- You MUST NOT hallucinate or guess any card details, effects, or abilities. If a card has an associated "text" property, that is its official active effect (for example, "Lt. Surge" moves energy from benched Pokemon of specific names to Pikachu/Pikachu ex, and "Lisia" searches for up to 2 Basic Lightning-type Pokémon with 50 HP or less). Use these precise rules in your deck composition, selection, and "details" descriptions!
- Every card in the "cards" list you return must have highly detailed explanations inside "details" describing its actual mechanical purpose, stage, and role in Pokemon TCG Pocket. For example:
  * Dratini is a Basic Pokemon (NOT Stage 1), and belongs to the Dragonite evolution line (Dratini -> Dragonair -> Dragonite).
  * Axew is a Basic Pokemon, Fraxure is Stage 1, and Haxorus is Stage 2. (Axew -> Fraxure -> Haxorus).
  * Munchlax is a Colorless Basic Pokemon with 50 HP and its own unique Pokepower/ability in TCG Pocket.
  * Misty is a Supporter card that flips coins to attach Water Energy to Water Pokemon, and Sabrina is a Supporter card that forces the opponent to switch their Active Pokemon.
  * Poke Ball is a Trainer card that searches for a Basic Pokemon.
  * Rare Candy is a Trainer card that allows you to evolve a Basic Pokemon directly to a Stage 2 Pokemon, which is a key speed engine for any Stage 2 deck.

CRITICAL EVOLUTIONARY LINE INTEGRITY RULES:
- You must always respect proper, exact evolutionary chains as they exist in the Pokemon franchise.
- DO NOT mix up different evolution families! For example:
  * Dratini (Basic) -> Dragonair (Stage 1) -> Dragonite (Stage 2). [Never Haxorus]
  * Axew (Basic) -> Fraxure (Stage 1) -> Haxorus (Stage 2). [Never Dragonite]
  * Charmander (Basic) -> Charmeleon (Stage 1) -> Charizard (Stage 2).
  * Squirtle (Basic) -> Wartortle (Stage 1) -> Blastoise (Stage 2).
  * Bulbasaur (Basic) -> Ivysaur (Stage 1) -> Venusaur (Stage 2).
  * Ralts (Basic) -> Kirlia (Stage 1) -> Gardevoir (Stage 2).
  * Gastly (Basic) -> Haunter (Stage 1) -> Gengar (Stage 2).
  * Machop (Basic) -> Machoke (Stage 1) -> Machamp (Stage 2).
  * Pidgey (Basic) -> Pidgeotto (Stage 1) -> Pidgeot (Stage 2).
- If you include a Stage 2 Pokemon, you do not always need a full equal evolution line (like 2-2-2) if you run Rare Candy. A competitive meta ratio for a Stage 2 deck running Rare Candy is: 2 Basics, 1 Stage 1, and 2 Stage 2s (with 2 Rare Candies), or direct skip lines like 2 Basics and 2 Stage 2s (with 2 Rare Candies). Always make sure you include the proper Basic (and optional Stage 1 if utilizing Rare Candy) pre-evolution belonging to the same exact evolution family. Mismatching family lines (e.g. Dratini and Haxorus) is a critical failure. If a Stage 2 Pokemon is featured, ensure you also include 2 copies of "Rare Candy" to enable these accelerated transitions!
- Ensure all Pokemon of an evolution line are accurately selected from the Available Cards List.

CRITICAL ENERGY AND TYPE CONSISTENCY RULES:
- You MUST ensure the deck has strict energy type alignment and compatibility. In Pokemon TCG Pocket, decks do not typically run more than 1 or 2 different energy types.
- Under NO circumstance should you throw in a lone Pokemon of a different type that requires its own distinct energy type to attack (e.g., adding a single Water Pokemon requiring Water Energy in a deck full of Psychic Pokemon requiring Psychic Energy), unless:
  1. It is a Colorless Pokemon (which can use any energy type for its attacks).
  2. Its role is purely non-attacking and its Poke-Power/Ability is useful and does not require active energy attachment of its own type (and even then, only if highly viable).
  3. The deck is a proven multi-energy archetype that uses a specific energy accelerator or shared trainer cards (e.g., Misty + Articuno in a Water-Psychic deck, or Dragon types which naturally require dual energy types).
- Always verify that the energy required for every Pokemon's attacks matches the energy type(s) that the deck will generate. A deck with incompatible energy types (e.g. running Venusaur and Charizard together without any shared energy or logical engine) is a critical failure.

CRITICAL CARD DETAIL REQUIREMENTS:
For EACH card in your returned JSON list, you MUST provide an extremely comprehensive, exact, and detailed explanation in the "details" field.
This explanation MUST include:
1. The EXACT name of the card's primary Attack(s) and/or Poke-Power/Abilities as they exist in Pokemon TCG Pocket (NOT standard TCG, specifically TCG Pocket!).
2. The exact Energy requirements and exact damage output (e.g., "Psydrive: 150 damage for 2 Psychic and 1 Colorless energy").
3. The exact gameplay mechanics, synergy, or effect of the attack/ability (e.g., "Gardevoir's 'Psy Shadow' Poke-Power allows you to attach a Psychic energy from your discard pile to your active Psychic Pokemon once per turn").
4. How this card's specific attack/ability synergizes perfectly with the rest of the deck and tournament-level meta strategies.

Example details format:
- "Stage 2 • 150 HP • Poke-Power: 'Psy Shadow' attaches 1 benched Psychic Energy per turn. Essential energy acceleration for Mewtwo ex's 'Psydrive' attack."
- "Basic ex • 190 HP • Attack: 'Psydrive' deals 150 damage for [P][P][C], discarding 2 energy. Paired with Gardevoir for rapid recharge."
- "Trainer Supporter • Misty: Flip coins until you get tails. For each heads, attach 1 Water Energy to 1 of your Active or Benched Water Pokemon. High-roll energy acceleration for Articuno ex."

CRITICAL DUPLICATE CARD NAME RULES:
- Under NO circumstance should a card name appear more than twice (2 copies max) in the deck, even if they have different card IDs, different sets, or different art styles (e.g. you cannot have 2 copies of Poké Ball from set A and 1 copy of Poké Ball from set B. The absolute maximum total count of cards named "Poké Ball" in the deck is 2).
- Ensure that you sum the 'count' fields of all cards with the SAME name to be at most 2.

CRITICAL DECK-BUILDING PRINCIPLES:
- Deep Meta Analysis: Automatically filter out cards that are statistically unviable or a waste of deck space in competitive play, unless the user explicitly asks for them.
- Synergistic Adaptability: Every single trainer, supporter, and item chosen must make logical sense for the specific Pokemon lineup you've selected. Dynamically search for the most optimal acceleration, search, and support cards tailored exactly for the specific Pokemon stages, energy types, and mechanics in the deck.
- Flexible Optimization: You must anticipate interactions and be extremely smart in your card selection. Adapt dynamically to the user's prompt to find the absolute best 20-card combination possible based on advanced meta intelligence.

You must be able to perform advanced searches dynamically, accurately, and specifically based on the user's prompt. For example:
- If they ask for "min hp", filter cards based on that HP threshold.
- If they ask for "no retreat cost", only include cards with 0 retreat cost.
- If they ask for "is only electric type", ensure the deck focuses on Electric types.
- If they ask for "has no weaknesses", find cards with no weakness.
- If they ask for "base attack is more than 130" or "total attack after all conditions met is 130+", calculate and find cards meeting this.
- If they ask for specific names like "Walking Wake", use those.
- If they ask for "more damage with damage on it", find cards whose attacks scale with damage counters.
(These are just examples; handle any advanced condition the user requests while keeping the deck highly competitive).

${currentExcluded.length > 0 ? `CRITICAL INSTRUCTION: You MUST NOT use any of the following card IDs in the deck. The user does not have them or explicitly excluded them:\n[${currentExcluded.join(', ')}]\nYou must find the next best competitive alternative cards to fill their spots while keeping the deck optimal and adhering to the user's prompt as best as possible.\n` : ''}
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
A valid Pokemon TCG Pocket deck MUST have exactly 20 cards. CRITICAL RULE: A deck MUST NOT contain more than 2 copies of any card with the same name, even if they have different IDs (e.g. you cannot have 2 Pikachu from pack A and 1 Pikachu from pack B, the max total is 2 "Pikachu"). You must set the "count" field to 1 or 2. Never 3 or more. Return an array of exactly 20 cards by sum of counts. Do not use Markdown formatting in the output, just raw JSON.`;

      const response = await window.puter.ai.chat(systemPrompt, { model: 'gemini-3.1-flash-lite' });
      
      let parsed = null;
      try {
        let text = response.toString().trim();
        // clean up markdown block if present
        text = text.replace(/^```json\n?/i, '');
        text = text.replace(/^```\n?/i, '');
        text = text.replace(/```$/i, '');
        parsed = JSON.parse(text.trim());
      } catch (err) {
        throw new Error("Failed to parse the AI response: " + response);
      }

      // --- Robust Post-Processing Sanitization to Prevent Duplicates and Enforce Rules ---
      if (parsed && Array.isArray(parsed.cards)) {
        const uniqueCardsMap = new Map<string, { id: string; count: number; details?: string }>();
        
        for (const item of parsed.cards) {
          if (!item || !item.id) continue;
          
          // Find actual card from local dataset to check its name
          const cardData = cards.find(c => c.id === item.id);
          if (!cardData) continue;
          
          const cleanName = cardData.name.trim();
          const count = Math.min(Math.max(Number(item.count) || 1, 1), 2);
          
          if (uniqueCardsMap.has(cleanName)) {
            const existing = uniqueCardsMap.get(cleanName)!;
            existing.count = Math.min(existing.count + count, 2);
            if (item.details && !existing.details?.includes(item.details)) {
              existing.details = (existing.details ? existing.details + " " : "") + item.details;
            }
          } else {
            uniqueCardsMap.set(cleanName, {
              id: item.id,
              count: count,
              details: item.details
            });
          }
        }
        
        let sanitizedCards = Array.from(uniqueCardsMap.values());
        let totalCount = sanitizedCards.reduce((sum, c) => sum + c.count, 0);
        
        // If greater than 20, truncate down
        if (totalCount > 20) {
          for (let i = sanitizedCards.length - 1; i >= 0 && totalCount > 20; i--) {
            if (sanitizedCards[i].count === 2) {
              sanitizedCards[i].count = 1;
              totalCount--;
            }
          }
          while (totalCount > 20 && sanitizedCards.length > 0) {
            const popped = sanitizedCards.pop();
            if (popped) {
              totalCount -= popped.count;
            }
          }
        } 
        // If less than 20, fill up with smart staples
        else if (totalCount < 20) {
          // Check if there is any Stage 2 card or if the user/AI mentioned "Stage 2" or "Stage-2" or "Rare Candy"
          const hasStage2 = prompt.toLowerCase().includes("stage 2") || 
                            prompt.toLowerCase().includes("stage2") || 
                            sanitizedCards.some(c => {
                              const cd = cards.find(x => x.id === c.id);
                              return cd && (
                                cd.name.toLowerCase().includes("haxorus") || 
                                cd.name.toLowerCase().includes("dragonite") || 
                                cd.name.toLowerCase().includes("charizard") || 
                                cd.name.toLowerCase().includes("venusaur") || 
                                cd.name.toLowerCase().includes("blastoise") || 
                                cd.name.toLowerCase().includes("gardevoir") || 
                                cd.name.toLowerCase().includes("gengar") || 
                                cd.name.toLowerCase().includes("machamp") || 
                                cd.name.toLowerCase().includes("pidgeot")
                              );
                            }) ||
                            sanitizedCards.some(c => c.details?.toLowerCase().includes("stage 2") || c.details?.toLowerCase().includes("stage-2"));

          const fillStaples = [
            { id: 'pa-007', name: "Professor's Research" },
            { id: 'pa-005', name: "Poké Ball" },
            { id: 'pa-002', name: "X Speed" },
            { id: 'pa-001', name: "Potion" }
          ];
          
          if (hasStage2) {
            // Rare Candy is standard/essential for fast Stage 2 decks!
            fillStaples.unshift({ id: 'a3-144', name: "Rare Candy" });
          }
          
          for (const staple of fillStaples) {
            if (totalCount >= 20) break;
            
            const existingIndex = sanitizedCards.findIndex(c => {
              const cData = cards.find(x => x.id === c.id);
              return cData?.name === staple.name;
            });
            
            if (existingIndex !== -1) {
              if (sanitizedCards[existingIndex].count < 2) {
                const diff = Math.min(2 - sanitizedCards[existingIndex].count, 20 - totalCount);
                sanitizedCards[existingIndex].count += diff;
                totalCount += diff;
              }
            } else {
              const addCount = Math.min(2, 20 - totalCount);
              sanitizedCards.push({
                id: staple.id,
                count: addCount,
                details: "Staple support card added dynamically to optimize deck synergy and consistency."
              });
              totalCount += addCount;
            }
          }
        }
        
        parsed.cards = sanitizedCards;
      }

      setResult(parsed);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <Container>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <Title style={{ margin: 0 }}>AI Deck Generator</Title>
          {isSignedIn && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
                Connected to Puter
              </span>
              <button 
                onClick={handleSignOut}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  padding: '0.25rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  transition: 'all 0.2s',
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
        <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
          Describe the kind of deck you want, and Puter AI will generate a 20-card list for you.
        </p>

        {checkingAuth ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <p>Checking Puter Authentication...</p>
          </div>
        ) : !isSignedIn ? (
          <div style={{ textAlign: 'center', padding: '3rem 2rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: '550px', margin: '2rem auto', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text)' }}>Sign In with Puter</h2>
            <p style={{ marginBottom: '2rem', fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Puter AI requires you to be logged into your Puter account. Click the button below to sign in or sign up with Puter securely.
            </p>
            <Button onClick={handleSignIn} style={{ minWidth: '200px' }}>
              Sign In with Puter
            </Button>
          </div>
        ) : (
          <>
            <Textarea 
              placeholder="e.g. A deck that has min 130 hp, no weakness, no retreat cost..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={loading}
            />

            {/* Advanced Search Filters Toggle & Reset */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0',
                  transition: 'opacity 0.2s',
                }}
              >
                <span>{showFilters ? '▲ Hide Advanced Search Filters' : '▼ Show Advanced Search Filters'}</span>
                {(maxEnergy !== 'any' || minHP !== 'any' || maxRetreat !== 'any' || noEx || noWeakness || minDamage !== 'any' || selectedType !== 'any') && (
                  <span style={{ fontSize: '0.75rem', background: 'var(--primary)', color: 'white', padding: '0.15rem 0.4rem', borderRadius: '10px', marginLeft: '0.25rem' }}>Active</span>
                )}
              </button>
              {(maxEnergy !== 'any' || minHP !== 'any' || maxRetreat !== 'any' || noEx || noWeakness || minDamage !== 'any' || selectedType !== 'any') && (
                <button
                  type="button"
                  onClick={() => {
                    setMaxEnergy('any');
                    setMinHP('any');
                    setMaxRetreat('any');
                    setNoEx(false);
                    setNoWeakness(false);
                    setMinDamage('any');
                    setSelectedType('any');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    textDecoration: 'underline',
                    padding: '0.25rem 0'
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Advanced Search Filters Panel */}
            {showFilters && (
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem'
                }}>
                  {/* Pokemon Type */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Primary Type</label>
                    <select
                      value={selectedType}
                      onChange={e => setSelectedType(e.target.value)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="any">Any / Multicolored</option>
                      <option value="Grass">Grass</option>
                      <option value="Fire">Fire</option>
                      <option value="Water">Water</option>
                      <option value="Lightning">Lightning</option>
                      <option value="Psychic">Psychic</option>
                      <option value="Fighting">Fighting</option>
                      <option value="Darkness">Darkness</option>
                      <option value="Metal">Metal</option>
                      <option value="Dragon">Dragon</option>
                      <option value="Colorless">Colorless</option>
                    </select>
                  </div>

                  {/* Max Attack Energy Requirement */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Max Attack Energy</label>
                    <select
                      value={maxEnergy}
                      onChange={e => setMaxEnergy(e.target.value)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="any">Any Energy Cost</option>
                      <option value="1">Max 1 Energy</option>
                      <option value="2">Max 2 Energy</option>
                      <option value="3">Max 3 Energy</option>
                      <option value="4">Max 4 Energy</option>
                    </select>
                  </div>

                  {/* Min HP */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Minimum HP</label>
                    <select
                      value={minHP}
                      onChange={e => setMinHP(e.target.value)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="any">Any HP</option>
                      <option value="50">50+ HP</option>
                      <option value="70">70+ HP</option>
                      <option value="90">90+ HP</option>
                      <option value="110">110+ HP</option>
                      <option value="130">130+ HP</option>
                      <option value="150">150+ HP</option>
                    </select>
                  </div>

                  {/* Max Retreat Cost */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Max Retreat Cost</label>
                    <select
                      value={maxRetreat}
                      onChange={e => setMaxRetreat(e.target.value)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="any">Any Retreat Cost</option>
                      <option value="0">0 Energy (Free retreat)</option>
                      <option value="1">1 Energy or less</option>
                      <option value="2">2 Energy or less</option>
                      <option value="3">3 Energy or less</option>
                    </select>
                  </div>

                  {/* Min Attack Damage */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Min Attack Damage</label>
                    <select
                      value={minDamage}
                      onChange={e => setMinDamage(e.target.value)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="any">Any Damage</option>
                      <option value="30">30+ Damage</option>
                      <option value="50">50+ Damage</option>
                      <option value="80">80+ Damage</option>
                      <option value="100">100+ Damage</option>
                      <option value="125">125+ Damage</option>
                      <option value="150">150+ Damage</option>
                    </select>
                  </div>
                </div>

                {/* Checkboxes Row */}
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text)' }}>
                    <input
                      type="checkbox"
                      checked={noEx}
                      onChange={e => setNoEx(e.target.checked)}
                      style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                    />
                    <span>Exclude "ex" Cards (No ex Rule)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text)' }}>
                    <input
                      type="checkbox"
                      checked={noWeakness}
                      onChange={e => setNoWeakness(e.target.checked)}
                      style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                    />
                    <span>Strictly No Weakness</span>
                  </label>
                </div>
              </div>
            )}
            
            <Button onClick={() => generateDeck()} disabled={loading || !prompt.trim() || !cards}>
              {loading ? (searchStatus || 'Generating...') : 'Generate Deck'}
            </Button>
            {loading && searchStatus && <p style={{ textAlign: 'center', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>{searchStatus}</p>}

            {excludedCards.length > 0 && (
              <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <strong>Excluded Cards ({excludedCards.length}):</strong> {excludedCards.map(id => cards?.find(c => c.id === id)?.name || id).join(', ')}
                <Button 
                  style={{ 
                    marginLeft: '1rem', 
                    padding: '0.25rem 0.75rem', 
                    fontSize: '0.8rem', 
                    background: 'transparent', 
                    border: '1px solid var(--border)', 
                    color: 'var(--text)' 
                  }} 
                  onClick={() => { setExcludedCards([]); }}
                >
                  Clear Excluded
                </Button>
              </div>
            )}
          </>
        )}

      {error && <div style={{ color: 'red', marginTop: '1rem', textAlign: 'center' }}>{error}</div>}

      {result && (
        <ResultContainer>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>{result.deckName}</h2>
          <p style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>{result.description}</p>
          
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Deck List ({result.cards.reduce((sum: number, c: any) => sum + (c.count || 0), 0)} cards)</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Click on a card you don't have to replace it with the next best alternative.
          </p>
          <CardGrid>
            {result.cards.map((item: any, i: number) => {
              const cardData = cards?.find(c => c.id === item.id);
              if (!cardData) return null;
              return (
                <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleExcludeCard(item.id)}>
                   <CardIcon card={cardData as any} />
                   <div style={{ position: 'absolute', top: -10, right: -10, background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', zIndex: 10 }}>
                     x{item.count}
                   </div>
                   <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', fontWeight: 500, textAlign: 'center' }}>
                     {cardData.name}
                     <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                       {cardData.pack} • {cardData.rarity}
                       <br />
                       {cardData.type} • {cardData.health ? `${cardData.health} HP` : 'Trainer'}
                     </div>
                     {item.details && (
                       <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.4rem', fontStyle: 'italic', width: '100%', lineHeight: '1.4' }}>
                         {item.details}
                       </div>
                     )}
                   </div>
                </div>
              );
            })}
          </CardGrid>
        </ResultContainer>
      )}
      </Container>
    </>
  );
};

export default GeneratorPage;
