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
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
`;

const GeneratorPage = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [excludedCards, setExcludedCards] = useState<string[]>([]);

  React.useEffect(() => {
    if (window.puter && window.puter.auth) {
      setIsSignedIn(window.puter.auth.isSignedIn());
    }
  }, []);

  const handleSignIn = async () => {
    try {
      if (window.puter && window.puter.auth) {
        await window.puter.auth.signIn();
        setIsSignedIn(window.puter.auth.isSignedIn());
      }
    } catch (err) {
      console.error("Sign in failed", err);
    }
  };

  const { data: cards } = useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      const response = await fetch(CARDS_URL);
      return response.json() as Promise<CardType[]>;
    },
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

    try {
      // Create a simplified card dataset to fit in prompt
      const simplifiedCards = cards.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        hp: c.health,
        pack: c.pack,
        rarity: c.rarity
      }));

      const systemPrompt = `You are an absolute expert Pokemon TCG Pocket deck generator, competitive data analyst, and tournament master.
The user wants a deck based on: "${prompt}".

CRITICAL CARD KNOWLEDGE & ACCURACY INSTRUCTIONS:
- You have access to your complete, accurate internal database containing all the real rules, texts, exact attacks, stages, HP, abilities, and effects of Pokemon TCG Pocket cards. You MUST NOT hallucinate or mix up any card details.
- Every card in the "cards" list you return must have accurate details explaining its actual mechanical purpose, stage, and role in Pokemon TCG Pocket. For example:
  * Dratini is a Basic Pokemon (NOT Stage 1), and belongs to the Dragonite evolution line (Dratini -> Dragonair -> Dragonite).
  * Axew is a Basic Pokemon, Fraxure is Stage 1, and Haxorus is Stage 2. (Axew -> Fraxure -> Haxorus).
  * Munchlax is a Colorless Basic Pokemon with 50 HP and its own unique Pokepower/ability in TCG Pocket.
  * Misty is a Supporter card that flips coins to attach Water Energy to Water Pokemon, and Sabrina is a Supporter card that forces the opponent to switch their Active Pokemon.
  * Poke Ball is a Trainer card that searches for a Basic Pokemon.
  * Rare Candy is a Trainer card that allows you to evolve a Basic Pokemon directly to a Stage 2 Pokemon, which is a key speed engine for any Stage 2 deck.
- Always write precise, correct statements in the card "details" fields.

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
    { "id": "card-id", "count": 2, "details": "Stage 2 • 150 HP • Explain why this card is perfect here..." },
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
        <Title>AI Deck Generator</Title>
      <p style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
        Describe the kind of deck you want, and Puter AI will generate a 20-card list for you.
      </p>

      {!isSignedIn ? (
        <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>
            You need to be signed in to Puter to use the AI Deck Generator.
          </p>
          <Button onClick={handleSignIn}>Sign In with Puter</Button>
        </div>
      ) : (
        <>
          <Textarea 
            placeholder="e.g. A deck that has min 130 hp, no weakness, no retreat cost..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
          
          <Button onClick={generateDeck} disabled={loading || !prompt.trim() || !cards}>
            {loading ? 'Generating...' : 'Generate Deck'}
          </Button>

          {excludedCards.length > 0 && (
            <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <strong>Excluded Cards ({excludedCards.length}):</strong> {excludedCards.map(id => cards?.find(c => c.id === id)?.name || id).join(', ')}
              <Button variant="outline" size="sm" style={{ marginLeft: '1rem' }} onClick={() => { setExcludedCards([]); }}>
                Clear Excluded
              </Button>
            </div>
          )}
        </>
      )}

      {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}

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
                       <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.4rem', fontStyle: 'italic', maxWidth: '140px' }}>
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
