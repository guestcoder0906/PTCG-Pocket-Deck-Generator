
const fs = require('fs');
const path = require('path');

const decksPath = './public/data/best-decks.json';
const cardsPath = './public/data/card-details.json';

const decks = JSON.parse(fs.readFileSync(decksPath, 'utf8'));
const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

decks.forEach(deck => {
    const filename = deck.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    fs.writeFileSync(`./data/decks/${filename}.json`, JSON.stringify(deck, null, 2));
});

Object.keys(cards).forEach(cardName => {
    const filename = cardName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    fs.writeFileSync(`./data/cards/${filename}.json`, JSON.stringify(cards[cardName], null, 2));
});

console.log('Data organized successfully');
