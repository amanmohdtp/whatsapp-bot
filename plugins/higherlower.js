const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("hilo");

// --- Game State Management ---
// Key: Player JID | Value: Game Object
const activeHiloGames = new Map();

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const rankValues = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };

function getRandomCard() {
    const rank = ranks[Math.floor(Math.random() * ranks.length)];
    return { rank, value: rankValues[rank] };
}

// Main command to start the game
Asena.addCommand(
    { pattern: "hilo", fromMe: false, desc: Lang.HILO_DESC },
    async (message, match) => {
        const playerId = message.from;
        if (activeHiloGames.has(playerId)) {
            return await message.sendMessage(Lang.HILO_IN_PROGRESS);
        }

        const initialCard = getRandomCard();
        const newGame = {
            currentCard: initialCard,
            streak: 0,
        };
        activeHiloGames.set(playerId, newGame);

        let msg = `🃏 *Higher or Lower Game Started!* 🃏\n\n`;
        msg += `The current card is: *${initialCard.rank}*\n\n`;
        msg += `Will the next card be *higher* or *lower*?\n`;
        msg += `Type *!high* or *!low*. (Aces are low (1), Kings are high (13))`;

        await message.sendMessage(msg);
    }
);

// Listener for 'High' command
Asena.addCommand(
    { pattern: "high", fromMe: false, deleteCommand: false },
    async (message, match) => {
        await processGuess(message, 'high');
    }
);

// Listener for 'Low' command
Asena.addCommand(
    { pattern: "low", fromMe: false, deleteCommand: false },
    async (message, match) => {
        await processGuess(message, 'low');
    }
);

async function processGuess(message, guessType) {
    const playerId = message.from;
    const game = activeHiloGames.get(playerId);

    if (!game) return;

    const nextCard = getRandomCard();
    const currentCard = game.currentCard;

    let isCorrect = false;

    if (nextCard.value > currentCard.value && guessType === 'high') {
        isCorrect = true;
    } else if (nextCard.value < currentCard.value && guessType === 'low') {
        isCorrect = true;
    }

    let msg = `*Current Card:* ${currentCard.rank} (Value: ${currentCard.value})\n`;
    msg += `*Next Card:* ${nextCard.rank} (Value: ${nextCard.value})\n\n`;

    if (nextCard.value === currentCard.value) {
        // Draw is always a win for the player to keep streaks alive
        game.currentCard = nextCard;
        game.streak++;
        msg += `🤝 *DRAW!* The cards matched. Streak: *${game.streak}*`;
        msg += `\nGuess again: *!high* or *!low*?`;
    } else if (isCorrect) {
        // Correct Guess
        game.currentCard = nextCard;
        game.streak++;
        msg += `✅ *CORRECT!* You guessed ${guessType}. Streak: *${game.streak}*`;
        msg += `\nGuess again: *!high* or *!low*?`;
    } else {
        // Incorrect Guess
        msg += `❌ *INCORRECT!* You guessed ${guessType}. Game Over.`;
        msg += `\nYour final streak was: *${game.streak}*`;
        activeHiloGames.delete(playerId);
    }

    await message.sendMessage(msg);
}
