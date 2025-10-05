const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("hangman");

// --- Game State Management ---
// Key: Player JID | Value: Game Object
const activeHangmanGames = new Map();

// Simplified Word List
const wordList = [
    "KEYBOARD", "SERVER", "TERMINAL", "LANGUAGE", "VARIABLE",
    "FUNCTION", "OBJECT", "NETWORK", "PROTOCOL", "DATABASE"
];

// Function to mask the word
function maskWord(word, guessedLetters) {
    return word.split('').map(letter => guessedLetters.includes(letter) ? letter : '_').join(' ');
}

// Function to draw the Hangman figure (simplified text drawing)
function drawHangman(fails) {
    switch(fails) {
        case 0: return '  \n  \n  \n / \\';
        case 1: return '  O\n  \n  \n / \\';
        case 2: return '  O\n  |\n  \n / \\';
        case 3: return '  O\n /|\n  \n / \\';
        case 4: return '  O\n /|\\\n  \n / \\';
        case 5: return '  O\n /|\\\n /\n / \\';
        case 6: return '  O\n /|\\\n / \\\n / \\'; // Max fails
        default: return '';
    }
}

// Main command to start the game
Asena.addCommand(
    { pattern: "hangman", fromMe: true, desc: Lang.HM_DESC },
    async (message, match) => {
        const playerId = message.from;
        if (activeHangmanGames.has(playerId)) {
            return await message.sendMessage(Lang.HM_IN_PROGRESS);
        }

        // Select a random word
        const word = wordList[Math.floor(Math.random() * wordList.length)];

        const newGame = {
            word: word.toUpperCase(),
            guessedLetters: [],
            fails: 0,
            maxFails: 6
        };

        activeHangmanGames.set(playerId, newGame);

        let msg = `🔪 *Hangman Game Started!* 🔪\n\n`;
        msg += `Word: ${maskWord(newGame.word, newGame.guessedLetters)}\n\n`;
        msg += `Fails: 0/${newGame.maxFails}\n`;
        msg += `Guess a letter or the whole word! Example: *!guess A* or *!guess ${word}*`;
        msg += `\n\n${drawHangman(newGame.fails)}`;

        await message.sendMessage(msg);
    }
);

// Listener for the guess command
Asena.addCommand(
    { pattern: "guess ?(.*)", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const playerId = message.from;
        const game = activeHangmanGames.get(playerId);

        if (!game) return; // No active game

        const guess = match[1].toUpperCase().trim();
        let msg = '';
        let gameEnded = false;

        if (guess.length === 1 && /^[A-Z]$/.test(guess)) {
            // --- Letter Guess ---
            if (game.guessedLetters.includes(guess)) {
                msg = `You already guessed the letter *${guess}*.\n`;
            } else {
                game.guessedLetters.push(guess);

                if (game.word.includes(guess)) {
                    msg = `✅ Correct! Letter *${guess}* is in the word.\n`;
                } else {
                    game.fails++;
                    msg = `❌ Incorrect! Letter *${guess}* is NOT in the word. Fails: ${game.fails}/${game.maxFails}\n`;
                }
            }

            // Check win/loss condition
            if (!maskWord(game.word, game.guessedLetters).includes('_')) {
                msg = `🎉 *CONGRATULATIONS!* You guessed the word: *${game.word}*`;
                gameEnded = true;
            } else if (game.fails >= game.maxFails) {
                msg = `💀 *GAME OVER!* The man is hanged. The word was: *${game.word}*`;
                gameEnded = true;
            }

        } else if (guess.length > 1) {
            // --- Word Guess ---
            if (guess === game.word) {
                msg = `🎉 *CONGRATULATIONS!* You guessed the word: *${game.word}*`;
                gameEnded = true;
            } else {
                game.fails++;
                msg = `❌ Incorrect word guess. Fails: ${game.fails}/${game.maxFails}\n`;
                if (game.fails >= game.maxFails) {
                    msg = `💀 *GAME OVER!* The man is hanged. The word was: *${game.word}*`;
                    gameEnded = true;
                }
            }
        } else {
            return await message.sendMessage(Lang.INVALID_INPUT, { quoted: message.data });
        }

        if (gameEnded) {
            activeHangmanGames.delete(playerId);
            msg += `\n\n${drawHangman(game.fails)}`;
        } else {
            msg += `\n\nWord: ${maskWord(game.word, game.guessedLetters)}\n`;
            msg += `Guessed: ${game.guessedLetters.join(', ')}\n`;
            msg += drawHangman(game.fails);
        }

        await message.sendMessage(msg);
    }
);
