const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("memory");

// --- Game State Management ---
const activeMemoryGames = new Map(); // Key: Player JID | Value: Game Object
const MAX_SEQUENCE_LENGTH = 7;
const COLORS = ['R', 'G', 'B', 'Y'];

// Function to generate the sequence
function generateSequence(length) {
    let seq = [];
    for (let i = 0; i < length; i++) {
        seq.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
    }
    return seq;
}

// Main command to start the game
Asena.addCommand(
    { pattern: "memory", fromMe: true, desc: Lang.MEM_DESC },
    async (message, match) => {
        const playerId = message.from;
        if (activeMemoryGames.has(playerId)) {
            return await message.sendMessage(Lang.MEM_IN_PROGRESS);
        }

        const newGame = {
            level: 1,
            sequence: generateSequence(1),
        };

        activeMemoryGames.set(playerId, newGame);

        await startRound(message, newGame);
    }
);

// Helper function to start a new round
async function startRound(message, game) {
    const sequenceStr = game.sequence.join(' ');
    
    let msg = `🧠 *Memory Game - Level ${game.level}* 🧠\n\n`;
    msg += `MEMORIZE THIS SEQUENCE:\n\n*${sequenceStr}*\n\n`;
    msg += `You have 5 seconds...`;

    await message.sendMessage(msg);

    // Hide the sequence after 5 seconds and prompt the user
    setTimeout(async () => {
        if (!activeMemoryGames.has(message.from)) return; // Game may have ended
        
        let promptMsg = `*Time's up!* Enter the sequence now.`;
        promptMsg += `\nExample: *!seq R G B Y*`;
        
        await message.sendMessage(promptMsg);
    }, 5000); 
}


// Listener for the sequence input
Asena.addCommand(
    { pattern: "seq ?(.*)", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const playerId = message.from;
        const game = activeMemoryGames.get(playerId);

        if (!game) return;

        const guess = match[1].toUpperCase().trim().split(/\s+/).filter(c => c.length > 0);
        const sequence = game.sequence;

        if (guess.length !== sequence.length) {
            return await message.sendMessage(`❌ Incorrect length. The sequence had ${sequence.length} elements. Try again! *!seq [your sequence]*`);
        }

        if (guess.join('') === sequence.join('')) {
            // WIN Round
            game.level++;

            if (game.level > MAX_SEQUENCE_LENGTH) {
                // Game Won
                activeMemoryGames.delete(playerId);
                return await message.sendMessage(`🏆 *PERFECT MEMORY!* You beat the final level! Game Over.`);
            }

            // Next Round
            game.sequence = generateSequence(game.level);
            let successMsg = `✅ *CORRECT!* Moving to Level ${game.level}...`;
            await message.sendMessage(successMsg);
            
            await startRound(message, game);

        } else {
            // LOSS
            const correctSequence = sequence.join(' ');
            activeMemoryGames.delete(playerId);
            let lossMsg = `💀 *GAME OVER!* Your guess was: ${guess.join(' ')}\n`;
            lossMsg += `The correct sequence was: *${correctSequence}*\n`;
            lossMsg += `You reached Level ${game.level - 1}.`;

            await message.sendMessage(lossMsg);
        }
    }
);
