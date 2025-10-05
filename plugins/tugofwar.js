const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("tow");

// --- Game State Management ---
// Key: Group JID | Value: Game Object
const activeTowGames = new Map();
const BOT_ID = 'BOT_TOW';
const GAME_DURATION = 15000; // 15 seconds

// Function to draw the rope
function drawRope(score) {
    const ropeLength = 20;
    const center = Math.floor(ropeLength / 2);
    
    // Normalize score to fit rope
    let normalizedScore = Math.floor((score / 5) + center); // Max score 10 = 2, Min score -10 = -2. +10 (center)
    normalizedScore = Math.max(1, Math.min(ropeLength - 2, normalizedScore)); 

    let rope = Array(ropeLength).fill('=');
    rope[0] = '🚩'; // P1 Flag
    rope[ropeLength - 1] = '🚩'; // P2 Flag
    rope[center] = '⚪'; // Center
    
    let pointer = normalizedScore;
    rope[pointer] = '🔴'; // The actual tugging point
    
    return rope.join('');
}

// --- COMMANDS ---

// Start Tug-of-War Lobby
Asena.addCommand(
    { pattern: "tugofwar", fromMe: true, desc: Lang.TOW_DESC },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        
        if (activeTowGames.has(chatId)) {
            return await message.sendMessage(Lang.GAME_IN_PROGRESS);
        }

        let newGame = {
            players: [{ jid: message.from, score: 0 }],
            isBot: false,
            startTime: 0,
            timer: null
        };
        activeTowGames.set(chatId, newGame);

        let msg = `💪 *Tug-of-War Lobby Started!* 💪\n`;
        msg += `Player 1: @${message.from.split('@')[0]}\n`;
        msg += `Type *!jointow* to join (needs 2 players), or *!starttow* to play vs. bot.`;

        await message.sendMessage(msg, { mentions: [message.from] });
    }
);

// Join Tug-of-War Lobby
Asena.addCommand(
    { pattern: "jointow", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        const game = activeTowGames.get(chatId);

        if (!game) return await message.sendMessage(Lang.NO_TOW_LOBBY);
        if (game.players.length >= 2) return await message.sendMessage(Lang.LOBBY_FULL);
        if (game.players.some(p => p.jid === message.from)) return await message.sendMessage(Lang.ALREADY_JOINED);
        
        game.players.push({ jid: message.from, score: 0 });
        game.isBot = false;
        
        await startGame(message, game, chatId);
    }
);

// Start Tug-of-War vs Bot
Asena.addCommand(
    { pattern: "starttow", fromMe: true, desc: "Starts Tug-of-War against a bot." },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        const game = activeTowGames.get(chatId);

        if (!game) return await message.sendMessage(Lang.NO_TOW_LOBBY);
        if (game.players.length > 1) return await message.sendMessage(Lang.ALREADY_2P);
        
        // Add bot player
        game.players.push({ jid: BOT_ID, score: 0 });
        game.isBot = true;

        await startGame(message, game, chatId);
    }
);

// Game Logic - Start timer and listener
async function startGame(message, game, chatId) {
    let p1 = game.players[0].jid.startsWith(BOT_ID) ? '🤖 BOT' : `@${game.players[0].jid.split('@')[0]}`;
    let p2 = game.players[1].jid.startsWith(BOT_ID) ? '🤖 BOT' : `@${game.players[1].jid.split('@')[0]}`;

    let msg = `🔥 *Tug-of-War vs ${p2} STARTED!* 🔥\n`;
    msg += `Player 1 (${p1}) vs Player 2 (${p2})\n`;
    msg += `Send the word *TUG* as fast as you can for ${GAME_DURATION / 1000} seconds!\n`;
    msg += `\n${drawRope(0)}\n`;
    msg += `Ready... GO!`;
    
    await message.sendMessage(msg, { mentions: game.players.filter(p => !p.jid.startsWith(BOT_ID)).map(p => p.jid) });

    game.startTime = Date.now();
    
    // Bot timer (if BvP)
    if (game.isBot) {
        // Bot sends a message every 1.5 - 2.5 seconds
        game.botTimer = setInterval(() => {
            game.players[1].score += 1; // Bot always P2
        }, Math.random() * 1000 + 1500);
    }

    // End Game Timer
    game.timer = setTimeout(async () => {
        activeTowGames.delete(chatId);
        if (game.isBot) clearInterval(game.botTimer);
        
        const finalScore = game.players[0].score - game.players[1].score;
        let resultMsg = `⏰ *TIME'S UP!* Final Tally:\n`;
        resultMsg += `Player 1: ${game.players[0].score} pulls\n`;
        resultMsg += `Player 2: ${game.players[1].score} pulls\n\n`;

        if (finalScore > 0) {
            resultMsg += `🎉 *VICTORY!* ${p1} pulls the rope over!`;
        } else if (finalScore < 0) {
            resultMsg += `😭 *DEFEAT!* ${p2} pulls the rope over!`;
        } else {
            resultMsg += `🤝 *DRAW!* The rope didn't move!`;
        }
        
        await message.sendMessage(resultMsg);
    }, GAME_DURATION);
}

// Listener for the 'TUG' message
Asena.addCommand(
    { on: "text", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        const game = activeTowGames.get(chatId);

        if (!game || Date.now() > game.startTime + GAME_DURATION) return;
        if (message.message.toUpperCase().trim() !== "TUG") return;
        
        const playerJid = message.from;
        const playerIndex = game.players.findIndex(p => p.jid === playerJid);

        if (playerIndex === -1) return; // Player not in game

        game.players[playerIndex].score += 1;
        
        // Announce current state every 10 pulls or if player is winning/losing significantly
        const currentScore = game.players[0].score - game.players[1].score;
        if (game.players[0].score + game.players[1].score > 0 && 
            (game.players[0].score + game.players[1].score) % 5 === 0 || 
            Math.abs(currentScore) > 4) 
        {
            let statusMsg = `*TUG-OF-WAR STATUS:*\n`;
            statusMsg += drawRope(currentScore) + '\n';
            
            await message.sendMessage(statusMsg);
        }
    }
);
