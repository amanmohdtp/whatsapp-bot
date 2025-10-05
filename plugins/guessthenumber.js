const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("guessthenumber");

// --- Game State Management ---
const activeNumberGames = new Map(); // Key: Player JID | Value: Game Object
const MIN = 1;
const MAX = 100;
const MAX_ATTEMPTS = 10;

// Main command to start the game
Asena.addCommand(
    { pattern: "guessthenumber", fromMe: true, desc: Lang.GN_DESC },
    async (message, match) => {
        const playerId = message.from;
        if (activeNumberGames.has(playerId)) {
            return await message.sendMessage(Lang.GN_IN_PROGRESS);
        }

        const secretNumber = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;

        const newGame = {
            secretNumber: secretNumber,
            attempts: 0,
            maxAttempts: MAX_ATTEMPTS
        };

        activeNumberGames.set(playerId, newGame);

        let msg = `🔢 *Guess the Number Game Started!* 🔢\n\n`;
        msg += `I have chosen a number between *${MIN}* and *${MAX}*.`;
        msg += `\nYou have *${MAX_ATTEMPTS}* attempts to guess it.`;
        msg += `\n\nUse the command *!guessnum [number]* to make a guess.`;

        await message.sendMessage(msg);
    }
);

// Listener for the guess command
Asena.addCommand(
    { pattern: "guessnum ?([0-9]+)", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const playerId = message.from;
        const game = activeNumberGames.get(playerId);

        if (!game) return; // No active game

        const guess = parseInt(match[1]);
        if (isNaN(guess) || guess < MIN || guess > MAX) {
            return await message.sendMessage(Lang.INVALID_RANGE.replace('{min}', MIN).replace('{max}', MAX), { quoted: message.data });
        }

        game.attempts++;

        let msg = `Your guess: *${guess}* (Attempt ${game.attempts}/${game.maxAttempts})\n`;

        if (guess === game.secretNumber) {
            // WIN
            msg += `🎉 *CONGRATULATIONS!* You guessed the number *${game.secretNumber}* in ${game.attempts} attempts!`;
            activeNumberGames.delete(playerId);
        } else if (game.attempts >= game.maxAttempts) {
            // LOSS
            msg += `💀 *GAME OVER!* You ran out of attempts. The number was *${game.secretNumber}*.`;
            activeNumberGames.delete(playerId);
        } else {
            // Hint
            if (guess < game.secretNumber) {
                msg += `⬆️ *TOO LOW.* Try a higher number.`;
            } else {
                msg += `⬇️ *TOO HIGH.* Try a lower number.`;
            }
        }

        await message.sendMessage(msg);
    }
);
