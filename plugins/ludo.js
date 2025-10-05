const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("ludo");

// --- Game State Management ---
const activeLudoGames = new Map(); // Key: Group JID | Value: Game Object
const COLORS = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
const BOT_ID = 'BOT_PLAYER_'; // Prefix for bot JIDs

// Simplified Ludo Board Logic (Paths and start/end points)
const pathMap = {
    'RED': [0, 1, 2, 3, 4, 5, 11, 10, 9, 8, 7, 6, 12, 18, 19, 20, 21, 22, 23, 29, 35, 34, 33, 32, 31, 30, 36, 42, 43, 44, 45, 46, 47, 53, 52, 51, 50, 49, 48, 54, 41, 40, 39, 38, 37, 5],
    // In a real game, all paths must be mapped correctly. This is a simplified example.
};
const START_POSITIONS = { 'RED': 0, 'BLUE': 13, 'YELLOW': 26, 'GREEN': 39 }; // Path indices
const HOME_CELLS = { 'RED': [55, 56, 57, 58] }; // Home safe cells (not on main path)

// Dice roll function
function rollDice() {
    return Math.floor(Math.random() * 6) + 1;
}

// Player move function (simplified - checks for 6 and safe house only)
function calculateNewPosition(game, color, dice) {
    // Simplified logic: only moves piece 0
    let currentPos = game.pieces[color][0];
    const path = pathMap['RED']; // Using RED path for simplicity
    
    // Check if in home yard (not out yet)
    if (currentPos === -1 && dice === 6) {
        return START_POSITIONS[color]; // Move to start cell
    }
    
    if (currentPos === -1) return -1; // Cannot move

    let newIndex = path.indexOf(currentPos) + dice;
    
    // Check if overshot the main path end
    if (newIndex >= path.length) {
        return 'OVERSHOT'; 
    }
    
    return path[newIndex];
}

// --- COMMANDS ---

// Start Ludo Lobby
Asena.addCommand(
    { pattern: "ludo", fromMe: true, desc: Lang.LUDO_DESC },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        if (activeLudoGames.has(chatId)) {
            return await message.sendMessage(Lang.GAME_IN_PROGRESS);
        }
        
        let newGame = {
            players: [{ jid: message.from, color: 'RED' }],
            turn: 'RED',
            pieces: { 'RED': [-1, -1, -1, -1] }, // All 4 pieces in home yard
            deck: [],
            moves: 0,
            botCount: 0,
        };
        activeLudoGames.set(chatId, newGame);

        let msg = `🎲 *Ludo Lobby Started!* 🎲\n`;
        msg += `1/4 players ready. Player RED: @${message.from.split('@')[0]}\n`;
        msg += `Type *!joinludo* to join, or *!startludo* to start with bots filling the rest.`;

        await message.sendMessage(msg, { mentions: [message.from] });
    }
);

// Join Ludo Lobby
Asena.addCommand(
    { pattern: "joinludo", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        const game = activeLudoGames.get(chatId);

        if (!game) return await message.sendMessage(Lang.NO_LUDO_LOBBY);
        if (game.players.length >= 4) return await message.sendMessage(Lang.LOBBY_FULL);
        if (game.players.some(p => p.jid === message.from)) return await message.sendMessage(Lang.ALREADY_JOINED);
        
        const nextColor = COLORS[game.players.length];
        game.players.push({ jid: message.from, color: nextColor });
        game.pieces[nextColor] = [-1, -1, -1, -1];

        let playerList = game.players.map(p => `${p.color}: @${p.jid.split('@')[0]}`).join('\n');
        
        await message.sendMessage(`✅ @${message.from.split('@')[0]} joined as ${nextColor}. ${game.players.length}/4 players ready.\n\n*Current Players:*\n${playerList}`);
    }
);

// Start Ludo Game (with Bot Fill)
Asena.addCommand(
    { pattern: "startludo", fromMe: true, desc: "Starts the Ludo game with bots filling empty slots." },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        const game = activeLudoGames.get(chatId);

        if (!game) return await message.sendMessage(Lang.NO_LUDO_LOBBY);
        
        // Fill empty slots with bots
        while (game.players.length < 4) {
            const nextColor = COLORS[game.players.length];
            const botJid = BOT_ID + game.botCount;
            game.players.push({ jid: botJid, color: nextColor });
            game.pieces[nextColor] = [-1, -1, -1, -1];
            game.botCount++;
        }

        let playerList = game.players.map(p => `${p.color}: ${p.jid.startsWith(BOT_ID) ? '🤖 BOT' : `@${p.jid.split('@')[0]}`}`).join('\n');
        
        let msg = `🔥 *Ludo Game Started!* 🔥\n\n`;
        msg += `*Players:*\n${playerList}\n\n`;
        msg += `It is ${game.turn}'s turn. Type *!roll* to roll the dice.`;

        await message.sendMessage(msg, { mentions: game.players.filter(p => !p.jid.startsWith(BOT_ID)).map(p => p.jid) });

        if (game.turn.startsWith(BOT_ID)) {
             // Handle first bot turn
             await handleBotTurn(message, game);
        }
    }
);

// Roll Dice Command
Asena.addCommand(
    { pattern: "roll", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        const game = activeLudoGames.get(chatId);

        if (!game) return;
        
        const player = game.players.find(p => p.color === game.turn);
        if (player.jid !== message.from) return await message.sendMessage(Lang.NOT_YOUR_TURN);

        const dice = rollDice();
        
        let msg = `@${message.from.split('@')[0]} rolled a *${dice}*!\n`;
        
        // --- Simplified Move Logic ---
        let movablePieces = game.pieces[player.color].map((pos, index) => {
             // Simplified: only piece 0 can move
             if (index === 0) return 0;
             return null;
        }).filter(i => i !== null);
        
        if (movablePieces.length > 0) {
            // Assume we move piece 0 for simplicity
            const newPos = calculateNewPosition(game, player.color, dice);
            
            if (newPos === 'OVERSHOT') {
                msg += `Piece 1 cannot move that far (overshot home). Turn passes.`;
                game.turn = getNextTurn(game.turn, game.players);
            } else if (newPos !== -1) {
                game.pieces[player.color][0] = newPos;
                msg += `Piece 1 moved to position *${newPos}*.`;
                // Add logic for 'kill' and 'safe' cells here
                
                // If dice was 6, give extra turn
                if (dice !== 6) {
                    game.turn = getNextTurn(game.turn, game.players);
                } else {
                    msg += `\nRolled a 6! Roll again! (!roll)`;
                }
            } else {
                msg += `Cannot move piece 1 with a ${dice}. Turn passes.`;
                game.turn = getNextTurn(game.turn, game.players);
            }
        } else {
            msg += `No movable pieces. Turn passes.`;
            game.turn = getNextTurn(game.turn, game.players);
        }

        // Check for bot turn after human turn ends
        const nextPlayer = game.players.find(p => p.color === game.turn);
        if (nextPlayer.jid.startsWith(BOT_ID)) {
            await message.sendMessage(msg, { mentions: [message.from] });
            return await handleBotTurn(message, game);
        }

        await message.sendMessage(msg, { mentions: [message.from] });
    }
);

// Helper to get next player's color
function getNextTurn(currentColor, players) {
    const currentIndex = players.findIndex(p => p.color === currentColor);
    const nextIndex = (currentIndex + 1) % players.length;
    return players[nextIndex].color;
}

// Bot Turn Logic (Simplified)
async function handleBotTurn(message, game) {
    // Implement small delay to mimic thinking
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    
    const botPlayer = game.players.find(p => p.color === game.turn);
    const dice = rollDice();
    
    let msg = `🤖 BOT (${botPlayer.color}) rolled a *${dice}*.\n`;

    // --- Bot Move Logic ---
    const newPos = calculateNewPosition(game, botPlayer.color, dice);
    
    if (newPos !== 'OVERSHOT' && newPos !== -1) {
        game.pieces[botPlayer.color][0] = newPos; // Move piece 1
        msg += `Piece 1 moved to position *${newPos}*.`;
    } else {
        msg += `No optimal move found. Turn passes.`;
    }
    
    // Check for extra turn
    if (dice !== 6) {
        game.turn = getNextTurn(game.turn, game.players);
    } else {
        msg += `\nRolled a 6! BOT rolls again...`;
        await message.sendMessage(msg);
        return handleBotTurn(message, game); // Recursive bot turn
    }

    // Check if next is human
    const nextPlayer = game.players.find(p => p.color === game.turn);
    msg += `\nIt is now ${game.turn}'s turn.`;

    await message.sendMessage(msg, { mentions: nextPlayer.jid.startsWith(BOT_ID) ? [] : [nextPlayer.jid] });

    if (nextPlayer.jid.startsWith(BOT_ID)) {
        // If the next player is also a bot, continue the bot chain
        return handleBotTurn(message, game);
    }
}
