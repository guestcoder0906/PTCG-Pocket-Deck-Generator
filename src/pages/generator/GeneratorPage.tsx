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
        stage: c.stage
      }));

      const systemPrompt = `You are an absolute expert Pokemon TCG Pocket deck generator, competitive data analyst, and tournament master.
The user wants a deck based on: "${prompt}".

You have extensive internal knowledge of Pokemon TCG Pocket, including ALL tournament data, the absolute best decks from all databases, tier lists, and intricate details of every card (such as retreat cost, weaknesses, attacks, base damage, conditional damage multipliers, abilities, and HP).
You MUST use your knowledge of tournament data, best cards, and best decks to generate the absolute best deck possible. 
For example, you know that "Hand Scope" is usually a complete waste of deck space in competitive play based on tournament data, so you won't include it unless it's a very specific meme deck request. You will include staples like Professor's Research, Poke Ball, X Speed where optimal.

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
    { "id": "card-id", "count": 2 },
    ...
  ]
}
A valid Pokemon TCG Pocket deck MUST have exactly 20 cards. CRITICAL RULE: A deck MUST NOT contain more than 2 copies of any card with the same name. You must set the "count" field to 1 or 2. Never 3 or more. Return an array of exactly 20 cards by sum of counts. Do not use Markdown formatting in the output, just raw JSON.`;

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
          
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Deck List (20 cards)</h3>
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
                     <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                       {cardData.pack} • {cardData.rarity}
                       <br />
                       {cardData.type} • {cardData.health ? `${cardData.health} HP` : 'Trainer'}
                     </div>
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
