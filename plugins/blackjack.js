const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("blackjack");

// --- Game State Management ---
// Key: Player JID | Value: Game Object
const activeBlackjackGames = new Map();

// Card Values
const cardValues = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11 // Ace starts at 11
};

// Function to generate and shuffle a deck
function createDeck() {
    const suits = ['♠️', '♥️', '♦️', '♣️'];
    const ranks = Object.keys(cardValues);
    let deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ rank, suit, value: cardValues[rank] });
        }
    }
    // Simple shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Function to calculate hand total (handles Aces)
function getHandValue(hand) {
    let value = hand.reduce((sum, card) => sum + card.value, 0);
    let aceCount = hand.filter(card => card.rank === 'A').length;

    while (value > 21 && aceCount > 0) {
        value -= 10; // Change Ace value from 11 to 1
        aceCount--;
    }
    return value;
}

// Function to format cards for display
function formatHand(hand, hideFirst = false) {
    if (hideFirst) {
        const hiddenCard = { rank: '??', suit: '??', value: 0 };
        return `[${hiddenCard.rank}${hiddenCard.suit}] ` + hand.slice(1).map(c => `[${c.rank}${c.suit}]`).join(' ');
    }
    return hand.map(c => `[${c.rank}${c.suit}]`).join(' ');
}

// Main command to start the game
Asena.addCommand(
    { pattern: "blackjack", fromMe: true, desc: Lang.BJ_DESC },
    async (message, match) => {
        const playerId = message.from;
        if (activeBlackjackGames.has(playerId)) {
            return await message.sendMessage(Lang.BJ_IN_PROGRESS);
        }

        const deck = createDeck();
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];

        const newGame = {
            deck,
            playerHand,
            dealerHand,
            playerValue: getHandValue(playerHand),
            dealerValue: getHandValue(dealerHand),
            turn: 'player'
        };

        activeBlackjackGames.set(playerId, newGame);

        let msg = `♠️ *Blackjack Game Started* ♥️\n\n`;
        msg += `*Your Hand* (${newGame.playerValue}): ${formatHand(playerHand)}\n`;
        msg += `*Dealer Hand* (??): ${formatHand(dealerHand, true)}\n\n`;
        
        if (newGame.playerValue === 21) {
            msg += "🃏 BLACKJACK! Waiting for dealer's turn...";
            newGame.turn = 'dealer';
        } else {
            msg += `Type *!hit* to take another card or *!stand* to end your turn.`;
        }
        
        await message.sendMessage(msg);

        // If player has 21, immediately run dealer's turn
        if (newGame.turn === 'dealer') {
            await dealerTurn(message, playerId, newGame);
        }
    }
);

// Handler for the 'Hit' command
Asena.addCommand(
    { pattern: "hit", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const playerId = message.from;
        const game = activeBlackjackGames.get(playerId);

        if (!game || game.turn !== 'player') return;

        const newCard = game.deck.pop();
        game.playerHand.push(newCard);
        game.playerValue = getHandValue(game.playerHand);

        let msg = `*You Drew:* [${newCard.rank}${newCard.suit}]\n`;
        msg += `*Your Hand* (${game.playerValue}): ${formatHand(game.playerHand)}\n`;
        msg += `*Dealer Hand* (??): ${formatHand(game.dealerHand, true)}\n\n`;
        
        if (game.playerValue > 21) {
            activeBlackjackGames.delete(playerId);
            msg += "💥 *BUST!* Your hand is over 21. You lose!";
        } else if (game.playerValue === 21) {
            game.turn = 'dealer';
            msg += "👍 21! Standing automatically. Now dealer's turn...";
            await message.sendMessage(msg);
            return await dealerTurn(message, playerId, game);
        } else {
            msg += `Type *!hit* or *!stand*.`;
        }

        await message.sendMessage(msg);

        if (!activeBlackjackGames.has(playerId)) {
            // Game ended on bust
        }
    }
);

// Handler for the 'Stand' command
Asena.addCommand(
    { pattern: "stand", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const playerId = message.from;
        const game = activeBlackjackGames.get(playerId);

        if (!game || game.turn !== 'player') return;

        game.turn = 'dealer';
        await message.sendMessage(`✋ Player stands at ${game.playerValue}. Dealer's turn!`);
        await dealerTurn(message, playerId, game);
    }
);

// Dealer AI Logic
async function dealerTurn(message, playerId, game) {
    const botThreshold = 17;
    let resultMsg = `*Dealer's Turn*\n\n`;
    resultMsg += `*Dealer Hand* (${game.dealerValue}): ${formatHand(game.dealerHand)}\n`;

    while (game.dealerValue < botThreshold) {
        const newCard = game.deck.pop();
        game.dealerHand.push(newCard);
        game.dealerValue = getHandValue(game.dealerHand);
        resultMsg += `Dealer hits and draws: [${newCard.rank}${newCard.suit}]\n`;
    }

    resultMsg += `\n*Dealer Hand Final* (${game.dealerValue}): ${formatHand(game.dealerHand)}\n`;
    resultMsg += `*Player Hand Final* (${game.playerValue}): ${formatHand(game.playerHand)}\n\n`;

    let winnerMsg = "";
    if (game.dealerValue > 21) {
        winnerMsg = "🥳 *DEALER BUSTS!* You win!";
    } else if (game.playerValue > game.dealerValue) {
        winnerMsg = "🎉 *YOU WIN!* Your score is higher than the dealer's.";
    } else if (game.playerValue < game.dealerValue) {
        winnerMsg = "😭 *DEALER WINS!* The dealer's score is higher.";
    } else {
        winnerMsg = "🤝 *PUSH!* It's a tie.";
    }

    activeBlackjackGames.delete(playerId);
    await message.sendMessage(resultMsg + winnerMsg);
}
