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

    try {
      setSearchStatus("Querying our organized library index and generating deck with advanced meta intelligence...");
      
      const response = await fetch("/api/generate-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          excludedCards: currentExcluded,
          maxEnergy,
          minHP,
          maxRetreat,
          noEx,
          noWeakness,
          minDamage,
          selectedType
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to generate deck.");
      }

      const parsed = await response.json();

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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <Title style={{ margin: 0 }}>AI Deck Generator</Title>
        </div>
        <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
          Describe the kind of deck you want, and the AI will generate a 20-card list for you.
        </p>

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
