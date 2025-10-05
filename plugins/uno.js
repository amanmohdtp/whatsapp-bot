const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("uno");

// --- Game State Management ---
const activeUnoGames = new Map(); // Key: Group JID | Value: Game Object
const BOT_ID = 'BOT_UNO_';

// Card definitions (Simplified: only 0-9 and color/wild)
const COLORS = ['R', 'Y', 'G', 'B']; // Red, Yellow, Green, Blue
const NUMBERS = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9];
const WILD_CARDS = ['W', 'W4']; // Wild, Wild Draw Four

function createDeck() {
    let deck = [];
    for (const color of COLORS) {
        for (const number of NUMBERS) {
            deck.push({ color, value: number.toString(), type: 'number' });
        }
        // Add action cards (simplified: 2 Draw 2s per color)
        deck.push({ color, value: '+2', type: 'action' });
        deck.push({ color, value: '+2', type: 'action' });
    }
    // Add 4 Wilds and 4 Wild Draw Fours
    for (let i = 0; i < 4; i++) {
        deck.push({ color: 'W', value: 'WILD', type: 'wild' });
        deck.push({ color: 'W', value: '+4', type: 'wild' });
    }
    // Simple shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function cardToString(card) {
    let colorMap = { 'R': '🟥', 'Y': '🟨', 'G': '🟩', 'B': '🟦', 'W': '🃏' };
    return `${colorMap[card.color]} ${card.value}`;
}

// Check if a card is playable
function isPlayable(topCard, card) {
    if (card.type === 'wild') return true;
    if (card.color === topCard.color) return true;
    if (card.value === topCard.value) return true;
    return false;
}

// --- COMMANDS ---

// Start Uno Lobby
Asena.addCommand(
    { pattern: "uno", fromMe: true, desc: Lang.UNO_DESC },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        if (activeUnoGames.has(chatId)) {
            return await message.sendMessage(Lang.GAME_IN_PROGRESS);
        }
        
        const newDeck = createDeck();
        
        let newGame = {
            players: [{ jid: message.from, hand: [] }],
            deck: newDeck,
            discardPile: [],
            topCard: null,
            turnIndex: 0,
            direction: 1, // 1 for clockwise, -1 for counter-clockwise
            botCount: 0,
        };
        activeUnoGames.set(chatId, newGame);

        let msg = `🃏 *Uno Lobby Started!* 🃏\n`;
        msg += `1/4 players ready. Player: @${message.from.split('@')[0]}\n`;
        msg += `Type *!joinuno* to join, or *!startuno* to start (2-4 players).`;

        await message.sendMessage(msg, { mentions: [message.from] });
    }
);

// Join Uno Lobby
Asena.addCommand(
    { pattern: "joinuno", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        const game = activeUnoGames.get(chatId);

        if (!game) return await message.sendMessage(Lang.NO_UNO_LOBBY);
        if (game.players.length >= 4) return await message.sendMessage(Lang.LOBBY_FULL);
        if (game.players.some(p => p.jid === message.from)) return await message.sendMessage(Lang.ALREADY_JOINED);
        
        game.players.push({ jid: message.from, hand: [] });

        await message.sendMessage(`✅ @${message.from.split('@')[0]} joined. ${game.players.length}/4 players ready.`);
    }
);

// Start Uno Game
Asena.addCommand(
    { pattern: "startuno", fromMe: true, desc: "Starts the Uno game." },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        const game = activeUnoGames.get(chatId);

        if (!game || game.players.length < 2) return await message.sendMessage(Lang.NEED_PLAYERS);
        
        // Bot Fill (up to 4 players)
        while (game.players.length < 4) {
            const botJid = BOT_ID + game.botCount;
            game.players.push({ jid: botJid, hand: [] });
            game.botCount++;
        }
        
        // Deal 7 cards
        for (let i = 0; i < 7; i++) {
            for (const player of game.players) {
                player.hand.push(game.deck.pop());
            }
        }
        
        // Draw starting card
        do {
            game.topCard = game.deck.pop();
            game.discardPile.push(game.topCard);
        } while (game.topCard.type !== 'number'); // Must start with a number card
        
        let playerList = game.players.map(p => `${p.jid.startsWith(BOT_ID) ? '🤖 BOT' : `@${p.jid.split('@')[0]}`} (${p.hand.length} cards)`).join('\n');
        
        let msg = `🔥 *Uno Game Started!* 🔥\n\n`;
        msg += `*Players:*\n${playerList}\n\n`;
        msg += `*Top Card:* ${cardToString(game.topCard)}\n\n`;
        
        // Send hands privately (must be done via PM in a real bot)
        for (const player of game.players.filter(p => !p.jid.startsWith(BOT_ID))) {
            const handStr = player.hand.map((c, i) => `[${i}] ${cardToString(c)}`).join('\n');
            message.client.sendMessage(player.jid, `*Your Uno Hand:*\n\n${handStr}`);
        }
        
        const currentPlayer = game.players[game.turnIndex];
        msg += `It is ${currentPlayer.jid.startsWith(BOT_ID) ? '🤖 BOT' : `@${currentPlayer.jid.split('@')[0]}`}'s turn.`;

        await message.sendMessage(msg, { mentions: game.players.filter(p => !p.jid.startsWith(BOT_ID)).map(p => p.jid) });

        if (currentPlayer.jid.startsWith(BOT_ID)) {
             await handleUnoBotTurn(message, game);
        }
    }
);

// Play Card Command
Asena.addCommand(
    { pattern: "play ?([0-9]+) ?(.*)", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        const game = activeUnoGames.get(chatId);

        if (!game) return;
        
        const currentPlayer = game.players[game.turnIndex];
        if (currentPlayer.jid !== message.from) return await message.sendMessage(Lang.NOT_YOUR_TURN);
        
        const cardIndex = parseInt(match[1]);
        const newColor = match[2] ? match[2].toUpperCase().charAt(0) : null;
        const playerHand = currentPlayer.hand;

        if (cardIndex < 0 || cardIndex >= playerHand.length) return await message.sendMessage(Lang.INVALID_CARD_INDEX);

        const cardToPlay = playerHand[cardIndex];
        
        // 1. Play Card Check
        if (!isPlayable(game.topCard, cardToPlay)) {
            return await message.sendMessage(Lang.CARD_UNPLAYABLE.replace('{card}', cardToString(cardToPlay)));
        }

        // 2. Process Play
        playerHand.splice(cardIndex, 1);
        game.discardPile.push(cardToPlay);
        game.topCard = cardToPlay;
        
        let msg = `@${message.from.split('@')[0]} played ${cardToString(cardToPlay)}.\n`;
        
        // 3. Check Win
        if (playerHand.length === 0) {
            activeUnoGames.delete(chatId);
            return await message.sendMessage(`🎉 *GAME OVER!* @${message.from.split('@')[0]} wins the game!`);
        }
        
        // 4. Handle Actions (Simplified)
        if (cardToPlay.type === 'wild' && newColor && COLORS.includes(newColor)) {
            game.topCard.color = newColor; // Set new color for wild
            msg += `New color set to ${newColor}.\n`;
        } else if (cardToPlay.type === 'wild' && !newColor) {
             return await message.sendMessage(`You must specify a color for the wild card! Example: !play ${cardIndex} R`);
        }
        
        // Set next turn
        game.turnIndex = (game.turnIndex + game.direction) % game.players.length;
        if (game.turnIndex < 0) game.turnIndex += game.players.length;

        const nextPlayer = game.players[game.turnIndex];
        
        msg += `*Top Card:* ${cardToString(game.topCard)}\n`;
        msg += `It is ${nextPlayer.jid.startsWith(BOT_ID) ? '🤖 BOT' : `@${nextPlayer.jid.split('@')[0]}`}'s turn.`;
        
        await message.sendMessage(msg, { mentions: [message.from, nextPlayer.jid].filter(j => !j.startsWith(BOT_ID)) });

        // If next player is bot, start bot turn
        if (nextPlayer.jid.startsWith(BOT_ID)) {
            return await handleUnoBotTurn(message, game);
        }
    }
);

// Draw Card Command
Asena.addCommand(
    { pattern: "drawuno", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        const game = activeUnoGames.get(chatId);
        
        if (!game) return;
        
        const currentPlayer = game.players[game.turnIndex];
        if (currentPlayer.jid !== message.from) return await message.sendMessage(Lang.NOT_YOUR_TURN);
        
        const newCard = game.deck.pop();
        if (!newCard) return await message.sendMessage(Lang.NO_CARDS_LEFT);
        
        currentPlayer.hand.push(newCard);
        
        let msg = `@${message.from.split('@')[0]} drew a card. Hand size: ${currentPlayer.hand.length}\n`;
        msg += `*Top Card:* ${cardToString(game.topCard)}\n`;

        // Advance turn
        game.turnIndex = (game.turnIndex + game.direction) % game.players.length;
        if (game.turnIndex < 0) game.turnIndex += game.players.length;
        const nextPlayer = game.players[game.turnIndex];
        
        msg += `It is now ${nextPlayer.jid.startsWith(BOT_ID) ? '🤖 BOT' : `@${nextPlayer.jid.split('@')[0]}`}'s turn.`;

        await message.sendMessage(msg, { mentions: [message.from, nextPlayer.jid].filter(j => !j.startsWith(BOT_ID)) });

        if (nextPlayer.jid.startsWith(BOT_ID)) {
             return await handleUnoBotTurn(message, game);
        }
    }
);

// Simplified Bot AI (always plays the first playable card)
async function handleUnoBotTurn(message, game) {
    await new Promise(resolve => setTimeout(resolve, 2000)); 

    const botPlayer = game.players[game.turnIndex];
    const playableCardIndex = botPlayer.hand.findIndex(card => isPlayable(game.topCard, card));

    if (playableCardIndex !== -1) {
        // Bot plays a card
        const cardToPlay = botPlayer.hand[playableCardIndex];
        botPlayer.hand.splice(playableCardIndex, 1);
        game.discardPile.push(cardToPlay);
        game.topCard = cardToPlay;
        
        let msg = `🤖 BOT played ${cardToString(cardToPlay)}.`;
        
        // Handle Wild Color (Bot always picks the color it has the most of, simplified to Red)
        if (cardToPlay.type === 'wild') {
            const newColor = 'R'; 
            game.topCard.color = newColor;
            msg += ` Bot chose ${newColor} as the color.`;
        }

        if (botPlayer.hand.length === 0) {
             activeUnoGames.delete(message.jid);
             return await message.sendMessage(`🎉 *GAME OVER!* 🤖 BOT wins the game!`);
        }

        // Advance turn
        game.turnIndex = (game.turnIndex + game.direction) % game.players.length;
        if (game.turnIndex < 0) game.turnIndex += game.players.length;

        const nextPlayer = game.players[game.turnIndex];
        msg += `\n*Top Card:* ${cardToString(game.topCard)}\n`;
        msg += `It is now ${nextPlayer.jid.startsWith(BOT_ID) ? '🤖 BOT' : `@${nextPlayer.jid.split('@')[0]}`}'s turn.`;
        
        await message.sendMessage(msg, { mentions: nextPlayer.jid.startsWith(BOT_ID) ? [] : [nextPlayer.jid] });

        if (nextPlayer.jid.startsWith(BOT_ID)) {
            return await handleUnoBotTurn(message, game); // Recursive bot turn
        }
        
    } else {
        // Bot draws a card
        const newCard = game.deck.pop();
        botPlayer.hand.push(newCard);
        
        let msg = `🤖 BOT could not play a card and drew one. Hand size: ${botPlayer.hand.length}.\n`;

        // Advance turn
        game.turnIndex = (game.turnIndex + game.direction) % game.players.length;
        if (game.turnIndex < 0) game.turnIndex += game.players.length;
        const nextPlayer = game.players[game.turnIndex];
        
        msg += `It is now ${nextPlayer.jid.startsWith(BOT_ID) ? '🤖 BOT' : `@${nextPlayer.jid.split('@')[0]}`}'s turn.`;

        await message.sendMessage(msg, { mentions: nextPlayer.jid.startsWith(BOT_ID) ? [] : [nextPlayer.jid] });

        if (nextPlayer.jid.startsWith(BOT_ID)) {
             return await handleUnoBotTurn(message, game);
        }
    }
}
