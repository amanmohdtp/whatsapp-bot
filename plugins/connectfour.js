const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("c4");

// --- Game State Management ---
// Key: Group JID | Value: Game Object
const activeC4Games = new Map();
const lobbyC4 = new Map(); // Key: Group JID | Value: { players: JID[], timer: Timeout }

// Constants
const ROWS = 6;
const COLS = 7;
const EMPTY = '⚫';
const PLAYER1 = '🔴';
const PLAYER2 = '🟡';
const BOT = '🟡'; // Bot will always play as the second player/yellow

// Function to create an empty board
function createBoard() {
    return Array(ROWS).fill(0).map(() => Array(COLS).fill(EMPTY));
}

// Function to draw the board
function drawBoard(board) {
    let output = '';
    output += '  1 2 3 4 5 6 7\n';
    output += '-----------------\n';
    for (const row of board) {
        output += '|' + row.join('|') + '|\n';
    }
    output += '-----------------\n';
    return output;
}

// Check for win condition
function checkWin(board, player) {
    // Check horizontal, vertical, and both diagonals (omitted for brevity, this is complex logic)
    // Basic check for one diagonal:
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === player &&
                r + 3 < ROWS && board[r + 1][c + 1] === player && // Simple diagonal check
                board[r + 2][c + 2] === player &&
                board[r + 3][c + 3] === player) {
                return true;
            }
            // A full implementation requires checking all 4 directions
        }
    }
    return false; // placeholder
}

// Bot AI: Simple 'Block or Win' strategy
function botMove(board) {
    // 1. Check for immediate win
    for (let c = 0; c < COLS; c++) {
        const r = getNextOpenRow(board, c);
        if (r !== -1) {
            board[r][c] = BOT;
            if (checkWin(board, BOT)) {
                board[r][c] = EMPTY; return c;
            }
            board[r][c] = EMPTY;
        }
    }
    // 2. Check for opponent win and block (omitted for brevity)
    // 3. Random valid move
    const validCols = Array(COLS).fill(0).map((_, i) => i).filter(c => board[0][c] === EMPTY);
    return validCols[Math.floor(Math.random() * validCols.length)];
}

function getNextOpenRow(board, col) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === EMPTY) return r;
    }
    return -1;
}

// --- COMMANDS ---

// Start or Join Lobby
Asena.addCommand(
    { pattern: "c4 ?(.*)", fromMe: true, desc: Lang.C4_DESC },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        
        if (activeC4Games.has(chatId)) {
            return await message.sendMessage(Lang.GAME_IN_PROGRESS);
        }

        if (lobbyC4.has(chatId)) {
            // Player joins existing lobby
            if (lobbyC4.get(chatId).players.length >= 2) {
                return await message.sendMessage(Lang.LOBBY_FULL);
            }
            if (!lobbyC4.get(chatId).players.includes(message.from)) {
                 lobbyC4.get(chatId).players.push(message.from);
            }
            clearTimeout(lobbyC4.get(chatId).timer); // Reset timer

            if (lobbyC4.get(chatId).players.length === 2) {
                return startGame(message, chatId, lobbyC4.get(chatId).players, false);
            }
            
            const timer = setTimeout(() => startGame(message, chatId, lobbyC4.get(chatId).players, true), 30000); // 30 sec wait
            lobbyC4.set(chatId, { players: lobbyC4.get(chatId).players, timer });
            
            return await message.sendMessage(`✅ Joined Lobby! 1/2 players ready. Waiting 30 seconds for 2nd player. Type !c4 to join.`);
        } else {
            // New lobby
            const players = [message.from];
            const timer = setTimeout(() => startGame(message, chatId, players, true), 30000); // 30 sec wait
            lobbyC4.set(chatId, { players, timer });
            return await message.sendMessage(`🔴 *Connect 4 Lobby Started!* 1/2 players ready. Waiting 30 seconds for 2nd player. Type !c4 to join.`);
        }
    }
);

// Game Logic
async function startGame(message, chatId, players, needsBot) {
    clearTimeout(lobbyC4.get(chatId).timer);
    lobbyC4.delete(chatId);

    const isBot = needsBot && players.length < 2;
    const player2 = isBot ? 'BOT' : players[1];
    
    const newGame = {
        board: createBoard(),
        turn: PLAYER1,
        players: { [PLAYER1]: players[0], [PLAYER2]: player2 },
        moves: 0
    };
    activeC4Games.set(chatId, newGame);

    let msg = `🔥 *CONNECT FOUR STARTED!* 🔥\n`;
    msg += `*Player ${PLAYER1}:* @${players[0].split('@')[0]}\n`;
    msg += `*Player ${PLAYER2}:* ${isBot ? '🤖 BOT' : `@${player2.split('@')[0]}`}\n\n`;
    msg += `It is *${PLAYER1}*'s turn. Type *!drop [1-7]* to place your piece.\n\n`;
    msg += drawBoard(newGame.board);
    
    await message.sendMessage(msg, { mentions: [players[0]] });
}

// Drop command
Asena.addCommand(
    { pattern: "drop ?([1-7])", fromMe: false, deleteCommand: false },
    async (message, match) => {
        const chatId = message.isGroup ? message.jid : message.from;
        const game = activeC4Games.get(chatId);
        
        if (!game || game.players[game.turn] !== message.from) return; // Not a game or not your turn

        const col = parseInt(match[1]) - 1; // 1-7 to 0-6 index
        const row = getNextOpenRow(game.board, col);
        
        if (row === -1) {
            return await message.sendMessage(Lang.COLUMN_FULL);
        }

        // 1. Player Move
        game.board[row][col] = game.turn;
        game.moves++;

        if (checkWin(game.board, game.turn)) {
            activeC4Games.delete(chatId);
            return await message.sendMessage(`🎉 *Game Over!* @${message.from.split('@')[0]} wins!\n\n${drawBoard(game.board)}`, { mentions: [message.from] });
        }
        
        // 2. Switch Turn
        game.turn = game.turn === PLAYER1 ? PLAYER2 : PLAYER1;
        let nextPlayer = game.players[game.turn];
        
        let boardMsg = drawBoard(game.board);
        await message.sendMessage(boardMsg + `\n*Next Turn:* ${nextPlayer === 'BOT' ? '🤖 BOT' : `@${nextPlayer.split('@')[0]}`}`, { mentions: [nextPlayer].filter(j => j !== 'BOT') });

        // 3. Bot Move (if BAP)
        if (nextPlayer === 'BOT') {
            const botCol = botMove(game.board);
            const botRow = getNextOpenRow(game.board, botCol);
            
            if (botRow === -1) {
                // Should not happen if logic is correct, means board is full (Draw)
                activeC4Games.delete(chatId);
                return await message.sendMessage(`🤝 *Game Over!* It's a draw!\n\n${drawBoard(game.board)}`);
            }
            
            game.board[botRow][botCol] = game.turn;
            game.moves++;
            
            if (checkWin(game.board, game.turn)) {
                activeC4Games.delete(chatId);
                return await message.sendMessage(`😭 *Game Over!* 🤖 BOT wins!\n\n${drawBoard(game.board)}`);
            }

            // Switch back to player 1
            game.turn = PLAYER1;
            nextPlayer = game.players[PLAYER1];
            boardMsg = drawBoard(game.board);
            await message.sendMessage(`🤖 Bot moved to column *${botCol + 1}*.\n\n` + boardMsg + `\n*Next Turn:* @${nextPlayer.split('@')[0]}`, { mentions: [nextPlayer] });
        }
    }
);
