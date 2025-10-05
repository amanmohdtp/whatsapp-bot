const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("tictactoe"); // Assume you have a language pack

// --- Game State Management ---
// Key: Group JID or Player JID (for 1v1) | Value: Game Object
const activeGames = new Map();

// Simplified Tic-Tac-Toe AI (Bot Strategy)
function botMove(board) {
    // 1. Check for immediate win (Bot's 'X')
    for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = 'X';
            if (checkWin(board, 'X')) return i;
            board[i] = ''; // undo move
        }
    }
    // 2. Check for opponent's win and block ('O')
    for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = 'O';
            if (checkWin(board, 'O')) {
                board[i] = ''; // undo block check
                return i; // block here
            }
            board[i] = ''; // undo move
        }
    }
    // 3. Take center (index 4)
    if (board[4] === '') return 4;

    // 4. Take a random corner
    const corners = [0, 2, 6, 8].filter(i => board[i] === '');
    if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];

    // 5. Take any available spot
    const emptySpots = board.map((val, idx) => val === '' ? idx : null).filter(val => val !== null);
    return emptySpots.length > 0 ? emptySpots[Math.floor(Math.random() * emptySpots.length)] : -1;
}

// Function to check for a win
function checkWin(board, player) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]            // Diagonals
    ];
    for (const [a, b, c] of lines) {
        if (board[a] === player && board[b] === player && board[c] === player) {
            return true;
        }
    }
    return false;
}

// Function to draw the board as text
function drawBoard(board) {
    const map = (val) => val === '' ? '◻️' : val === 'X' ? '❌' : '⭕';
    let output = '';
    for (let i = 0; i < 9; i += 3) {
        output += `| ${map(board[i])} | ${map(board[i + 1])} | ${map(board[i + 2])} |\n`;
    }
    return output;
}

// Main command to start the game
Asena.addCommand(
    { pattern: "ttt ?(.*)", fromMe: true, desc: Lang.TTT_DESC },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        const mode = match.trim().toLowerCase();

        if (activeGames.has(chatId)) {
            return await message.sendMessage(Lang.GAME_IN_PROGRESS);
        }

        let isBot = mode === 'bot';
        let newGame = {
            board: ['', '', '', '', '', '', '', '', ''], // 9 cells
            turn: 'X', // X always goes first
            mode: isBot ? 'BvP' : 'PvP',
            playerX: message.client.user.jid,
            playerO: isBot ? 'BOT' : message.reply_message ? message.reply_message.jid : null,
            moves: 0
        };

        if (!isBot && !newGame.playerO) {
            return await message.sendMessage(Lang.REPLY_TO_PLAYER);
        }

        activeGames.set(chatId, newGame);

        let initialMsg = `*Tic-Tac-Toe Started!* (Mode: ${isBot ? 'Bot vs Player' : 'Player vs Player'})\n`;
        initialMsg += `*Player ❌:* @${newGame.playerX.split('@')[0]}\n`;
        if (!isBot) {
            initialMsg += `*Player ⭕:* @${newGame.playerO.split('@')[0]}\n`;
        }
        initialMsg += `\nType *!play [1-9]* to make a move (1 is top-left, 9 is bottom-right).\n\n`;
        initialMsg += drawBoard(newGame.board);

        await message.sendMessage(initialMsg, { mentions: isBot ? [] : [newGame.playerX, newGame.playerO] });

        // If bot is O and it's X's turn, wait for player. If bot is X (not implemented here), bot would move first.
    }
);

// Listener for game moves (using !play [1-9])
Asena.addCommand(
    { pattern: "play ?([1-9])", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        if (!activeGames.has(chatId)) return;

        const game = activeGames.get(chatId);
        const playerJid = message.from;
        const move = parseInt(match[1]) - 1; // 1-9 to 0-8 index

        let currentPlayer = game.turn === 'X' ? game.playerX : game.playerO;
        let isBotTurn = currentPlayer === 'BOT';

        if (!isBotTurn && playerJid !== currentPlayer) {
            return await message.sendMessage(Lang.NOT_YOUR_TURN);
        }
        if (isBotTurn) {
             // Should not happen if turn logic is correct, but prevents human move on bot turn
             return;
        }

        if (game.board[move] !== '') {
            return await message.sendMessage(Lang.SPOT_TAKEN, { quoted: message.data });
        }
        
        // 1. Player move
        game.board[move] = game.turn;
        game.moves++;

        if (checkWin(game.board, game.turn)) {
            const winner = game.turn === 'X' ? game.playerX : game.playerO;
            activeGames.delete(chatId);
            return await message.sendMessage(`🎉 *Game Over!* 🎉\n@${winner.split('@')[0]} wins!\n\n${drawBoard(game.board)}`, { mentions: [winner] });
        }

        if (game.moves === 9) {
            activeGames.delete(chatId);
            return await message.sendMessage(`🤝 *Game Over!* It's a draw!\n\n${drawBoard(game.board)}`);
        }

        // 2. Switch turn
        game.turn = game.turn === 'X' ? 'O' : 'X';
        let nextPlayer = game.turn === 'X' ? game.playerX : game.playerO;
        
        let boardMsg = drawBoard(game.board) + `\n*Next Turn:* ${nextPlayer === 'BOT' ? '🤖 BOT' : `@${nextPlayer.split('@')[0]}`}`;
        await message.sendMessage(boardMsg, { mentions: [nextPlayer].filter(j => j !== 'BOT') });


        // 3. Bot move if BvP
        if (nextPlayer === 'BOT') {
            const botIdx = botMove(game.board);
            game.board[botIdx] = game.turn; // Bot is 'O'
            game.moves++;

            if (checkWin(game.board, game.turn)) {
                activeGames.delete(chatId);
                return await message.sendMessage(`😭 *Game Over!* 🤖 BOT wins!\n\n${drawBoard(game.board)}`);
            }
            if (game.moves === 9) {
                activeGames.delete(chatId);
                return await message.sendMessage(`🤝 *Game Over!* It's a draw!\n\n${drawBoard(game.board)}`);
            }
            
            // Switch back to player
            game.turn = 'X';
            nextPlayer = game.playerX;
            boardMsg = drawBoard(game.board) + `\n*Next Turn:* @${nextPlayer.split('@')[0]}`;
            await message.sendMessage(`🤖 Bot moved to position *${botIdx + 1}*.\n\n` + boardMsg, { mentions: [nextPlayer] });
        }

    }
);

// Command to end the game
Asena.addCommand(
    { pattern: "tttend", fromMe: true, desc: Lang.TTT_END_DESC },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        if (activeGames.has(chatId)) {
            activeGames.delete(chatId);
            return await message.sendMessage(Lang.GAME_ENDED);
        }
        return await message.sendMessage(Lang.NO_GAME_ACTIVE);
    }
);
