const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("scramble");

// --- Game State Management ---
const currentScrambles = new Map(); // Key: JID | Value: { originalWord: string, expires: number }
const playerScores = new Map(); // Key: JID | Value: number

const wordList = [
    "ASENA", "BOT", "CODE", "JAVASCRIPT", "MODULE", "GAME",
    "PYTHON", "NODE", "TURN", "STATE", "CHAT", "COMMAND"
];

function shuffleWord(word) {
    let a = word.split(""),
        n = a.length;
    for(let i = n - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a.join("");
}

// Main command to start a new round
Asena.addCommand(
    { pattern: "scramble", fromMe: true, desc: Lang.SCRAMBLE_DESC },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        
        if (currentScrambles.has(chatId) && currentScrambles.get(chatId).expires > Date.now()) {
            return await message.sendMessage(Lang.ROUND_IN_PROGRESS);
        }
        
        // Pick a word
        const originalWord = wordList[Math.floor(Math.random() * wordList.length)];
        let scrambled = shuffleWord(originalWord);
        while(scrambled.toUpperCase() === originalWord.toUpperCase()) {
             scrambled = shuffleWord(originalWord); // Reshuffle if it matches the original
        }

        currentScrambles.set(chatId, {
            originalWord: originalWord.toUpperCase(),
            expires: Date.now() + 60000 // 60 seconds timer
        });

        let msg = `🔥 *WORD SCRAMBLE ROUND STARTED!* 🔥\n\n`;
        msg += `Unscramble this word: *${scrambled}*\n\n`;
        msg += `Be the first to guess the original word! (You have 60 seconds)\n`;
        msg += `Reply with your guess.`;

        await message.sendMessage(msg);
        
        // Cleanup after timer expires
        setTimeout(async () => {
            if (currentScrambles.has(chatId) && currentScrambles.get(chatId).originalWord === originalWord.toUpperCase()) {
                await message.sendMessage(`⏰ Time's up! The word was *${originalWord}*!`);
                currentScrambles.delete(chatId);
            }
        }, 60000);
    }
);

// Listener for guesses
Asena.addCommand(
    { on: "text", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        if (!currentScrambles.has(chatId)) return;
        
        const game = currentScrambles.get(chatId);
        const guess = message.message.toUpperCase().trim();
        
        if (guess === game.originalWord) {
            const winnerJid = message.from;
            const currentScore = playerScores.get(winnerJid) || 0;
            playerScores.set(winnerJid, currentScore + 1);
            
            currentScrambles.delete(chatId); // End the round
            
            let msg = `🏆 *CORRECT!* @${winnerJid.split('@')[0]} wins this round!\n`;
            msg += `The word was *${game.originalWord}*.\n`;
            msg += `Your score is now: *${currentScore + 1}*`;
            
            await message.sendMessage(msg, { mentions: [winnerJid] });
        }
    }
);

// Command to check scores
Asena.addCommand(
    { pattern: "scblscore", fromMe: true, desc: "Shows the current Scramble scores." },
    async (message, match) => {
        if (playerScores.size === 0) {
            return await message.sendMessage("No scores recorded yet. Start playing!");
        }
        
        let leaderboard = "🏆 *Scramble Leaderboard* 🏆\n\n";
        const sortedScores = Array.from(playerScores.entries()).sort((a, b) => b[1] - a[1]);
        
        sortedScores.forEach(([jid, score], index) => {
            leaderboard += `${index + 1}. @${jid.split('@')[0]}: *${score}*\n`;
        });

        await message.sendMessage(leaderboard, { mentions: sortedScores.map(([jid]) => jid) });
    }
);
