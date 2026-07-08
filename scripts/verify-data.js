const fs = require('fs');
const path = require('path');

const originalDecksPath = './public/data/best-decks.json';
const originalCardsPath = './public/data/card-details.json';
const newDecksDir = './data/decks';
const newCardsDir = './data/cards';

const originalDecks = JSON.parse(fs.readFileSync(originalDecksPath, 'utf8'));
const originalCards = JSON.parse(fs.readFileSync(originalCardsPath, 'utf8'));

const newDeckFiles = fs.readdirSync(newDecksDir);
const newCardFiles = fs.readdirSync(newCardsDir);

console.log(`Original Decks count: ${originalDecks.length}`);
console.log(`New Deck files count: ${newDeckFiles.length}`);

console.log(`Original Cards count: ${Object.keys(originalCards).length}`);
console.log(`New Card files count: ${newCardFiles.length}`);

if (originalDecks.length === newDeckFiles.length && Object.keys(originalCards).length === newCardFiles.length) {
    console.log('Data organization verified: Counts match.');
} else {
    console.log('Data organization verification FAILED: Counts do not match.');
}
