const fs = require('fs');

async function testOcr() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined in the environment.");
    return;
  }

  const cardsToTest = [
    {
      name: "Lt. Surge",
      image: "https://raw.githubusercontent.com/chase-manning/pokemon-tcg-pocket-cards/refs/heads/main/images/cards/a1-226.png"
    },
    {
      name: "Lisia",
      image: "https://raw.githubusercontent.com/chase-manning/pokemon-tcg-pocket-cards/refs/heads/main/images/cards/b1-226.png"
    }
  ];

  for (const card of cardsToTest) {
    console.log(`\n--- Fetching and OCRing card: ${card.name} ---`);
    try {
      const response = await fetch(card.image);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      console.log(`Successfully converted ${card.name} to Base64 (length: ${base64.length})`);

      const payload = {
        contents: [
          {
            parts: [
              {
                text: "You are a precise Pokemon TCG Pocket card scanner. Analyze the image of this card and extract its exact gameplay details. Do not hallucinate or guess; extract exactly what is printed on the card.\nReturn a JSON object in this exact format:\n{\n  \"name\": \"Card Name\",\n  \"type\": \"Pokemon Type (or Trainer)\",\n  \"subtype\": \"Trainer subtype (e.g., Supporter, Item, Fossil) if applicable, or null\",\n  \"health\": \"HP value as string (e.g. '120') or null\",\n  \"ability\": {\n    \"name\": \"Ability Name\",\n    \"effect\": \"Ability description\"\n  } or null,\n  \"attacks\": [\n    {\n      \"name\": \"Attack Name\",\n      \"cost\": \"Energy requirement (e.g. [L][C] or Lightning, Colorless)\",\n      \"damage\": \"Damage value as string (e.g., '30', '50+', or null)\",\n      \"effect\": \"Attack effect description\"\n    }\n  ],\n  \"rulesOrEffectText\": \"Full effect text printed on the card (especially for Trainer cards, describe their full effect exactly)\"\n}"
              },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        throw new Error(`Gemini API returned error: ${geminiResponse.status} - ${errorText}`);
      }

      const result = await geminiResponse.json();
      const rawText = result.candidates[0].content.parts[0].text;
      console.log("OCR Result JSON:");
      console.log(rawText);
    } catch (err) {
      console.error(`Error processing ${card.name}:`, err);
    }
  }
}

testOcr();
