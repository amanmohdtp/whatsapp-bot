const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("mm");

// --- Game State Management ---
// Key: Player JID | Value: Game Object
const activeMMGames = new Map();

// Constants
const COLORS = ['R', 'B', 'G', 'Y', 'P', 'C']; // Red, Blue, Green, Yellow, Purple, Cyan
const CODE_LENGTH = 4;
const MAX_GUESSES = 10;

// Function to generate the secret code (Bot's job)
function generateCode() {
    let code = [];
    for (let i = 0; i < CODE_LENGTH; i++) {
        code.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
    }
    return code;
}

// Function to provide feedback (Black Pegs and White Pegs)
function getFeedback(secretCode, guess) {
    let blackPegs = 0;
    let whitePegs = 0;
    
    // Create copies to mark checked positions
    const codeTemp = [...secretCode];
    const guessTemp = [...guess];

    // 1. Check Black Pegs (Correct Color and Correct Position)
    for (let i = 0; i < CODE_LENGTH; i++) {
        if (guessTemp[i] === codeTemp[i]) {
            blackPegs++;
            guessTemp[i] = null; // Mark as checked
            codeTemp[i] = null; // Mark as checked
        }
    }

    // 2. Check White Pegs (Correct Color but Wrong Position)
    for (let i = 0; i < CODE_LENGTH; i++) {
        if (guessTemp[i] !== null) {
            const indexInCode = codeTemp.indexOf(guessTemp[i]);
            if (indexInCode !== -1) {
                whitePegs++;
                codeTemp[indexInCode] = null; // Mark as checked
            }
        }
    }

    return { black: blackPegs, white: whitePegs };
}

// Main command to start the game
Asena.addCommand(
    { pattern: "mastermind", fromMe: true, desc: Lang.MM_DESC },
    async (message, match) => {
        const playerId = message.from;
        if (activeMMGames.has(playerId)) {
            return await message.sendMessage(Lang.MM_IN_PROGRESS);
        }

        const secretCode = generateCode();
        const newGame = {
            secretCode: secretCode,
            guesses: 0,
            history: [] // { guess: [], feedback: {} }
        };

        activeMMGames.set(playerId, newGame);

        let msg = `🧠 *Mastermind Code Breaker Started!* 🧠\n\n`;
        msg += `The bot has set a secret *${CODE_LENGTH}*-color code. You have ${MAX_GUESSES} guesses.\n`;
        msg += `Colors available: *${COLORS.join(', ')}*\n\n`;
        msg += `Guess the code using the first letter of the color (e.g., R, B, G, Y, P, C).\n`;
        msg += `Example: *!code RBYC*`;

        await message.sendMessage(msg);
    }
);

// Listener for the code guess command
Asena.addCommand(
    { pattern: "code ?(.*)", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const playerId = message.from;
        const game = activeMMGames.get(playerId);

        if (!game) return; // No active game

        const rawGuess = match[1].toUpperCase().trim();
        const guessArray = rawGuess.split('');

        if (guessArray.length !== CODE_LENGTH) {
            return await message.sendMessage(Lang.INVALID_LENGTH.replace('{length}', CODE_LENGTH), { quoted: message.data });
        }
        if (!guessArray.every(g => COLORS.includes(g))) {
            return await message.sendMessage(Lang.INVALID_COLORS, { quoted: message.data });
        }

        game.guesses++;
        const feedback = getFeedback(game.secretCode, guessArray);

        game.history.push({ guess: guessArray, feedback });

        let msg = `*Guess ${game.guesses}/${MAX_GUESSES}:* ${guessArray.join(' ')}\n`;
        msg += `⚫ (Black Pegs - Correct Color/Position): *${feedback.black}*\n`;
        msg += `⚪ (White Pegs - Correct Color/Wrong Position): *${feedback.white}*\n\n`;

        if (feedback.black === CODE_LENGTH) {
            // WIN
            msg = `🎉 *CONGRATULATIONS!* You cracked the code in ${game.guesses} guesses!`;
            msg += `\nCode was: *${game.secretCode.join(' ')}*`;
            activeMMGames.delete(playerId);
        } else if (game.guesses >= MAX_GUESSES) {
            // LOSS
            msg = `💀 *GAME OVER!* You ran out of guesses.`;
            msg += `\nThe secret code was: *${game.secretCode.join(' ')}*`;
            activeMMGames.delete(playerId);
        } else {
            // Continue
            msg += `*Guess History:*\n`;
            game.history.forEach((h) => {
                msg += `${h.guess.join('')} -> ${'⚫'.repeat(h.feedback.black)}${'⚪'.repeat(h.feedback.white)}\n`;
            });
            msg += `\nGuess again (e.g., !code RBYC). Remaining: ${MAX_GUESSES - game.guesses}`;
        }

        await message.sendMessage(msg);
    }
);
