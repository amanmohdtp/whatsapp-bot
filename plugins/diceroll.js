const Asena = require("../Utilis/events");
const Language = require => {
    return { getString: (key) => key }; // Simplified Lang
};
const Lang = Language().getString;

// --- Game State Management ---
// No persistent state needed for this single-turn game

// Function to roll the dice (1-6)
function rollDice() {
    return Math.floor(Math.random() * 6) + 1;
}

// Main command to start the game
Asena.addCommand(
    { pattern: "diceroll ?(.*)", fromMe: false, desc: "Rolls a dice and allows betting on Odd/Even/Number." },
    async (message, match) => {
        const bet = match[1].toUpperCase().trim();
        const diceResult = rollDice();
        
        let msg = `🎲 *DICE ROLLED:* The result is *${diceResult}*! 🎲\n\n`;
        let result = '';

        if (!bet) {
            // If no bet is placed, just roll
            msg += `*No bet placed.* Enjoy the roll!`;
            return await message.sendMessage(msg);
        }

        const isEven = diceResult % 2 === 0;

        if (bet === 'ODD') {
            result = isEven ? 'LOST' : 'WON';
            msg += `You bet on *ODD*. You ${result}!`;
        } else if (bet === 'EVEN') {
            result = isEven ? 'WON' : 'LOST';
            msg += `You bet on *EVEN*. You ${result}!`;
        } else if (['1', '2', '3', '4', '5', '6'].includes(bet)) {
            const betNumber = parseInt(bet);
            result = (diceResult === betNumber) ? 'WON' : 'LOST';
            msg += `You bet on the number *${betNumber}*. You ${result}! (1:5 odds)`;
        } else {
            return await message.sendMessage(`❌ Invalid bet. Please bet *ODD*, *EVEN*, or a specific number (1-6).`);
        }
        
        await message.sendMessage(msg);
    }
);
