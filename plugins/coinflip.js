const Asena = require("../Utilis/events");
const Language = require => {
    return { getString: (key) => key }; // Simplified Lang
};
const Lang = Language().getString;

// Main command to start the game
Asena.addCommand(
    { pattern: "flip ?(.*)", fromMe: false, desc: "Flips a coin and allows betting on Heads or Tails." },
    async (message, match) => {
        const bet = match[1] ? match[1].toUpperCase().trim() : '';
        
        // 0 = Heads, 1 = Tails
        const flipResult = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
        
        let msg = `🪙 *COIN FLIPPED:* It's *${flipResult}*! 🪙\n\n`;
        let result = '';

        if (!bet) {
            msg += `*No bet placed.* It's a flip!`;
            return await message.sendMessage(msg);
        }

        if (bet === 'HEADS' || bet === 'TAILS') {
            result = (flipResult === bet) ? 'WON' : 'LOST';
            msg += `You bet on *${bet}*. You ${result}!`;
        } else {
            return await message.sendMessage(`❌ Invalid bet. Please bet *HEADS* or *TAILS*.`);
        }
        
        await message.sendMessage(msg);
    }
);
