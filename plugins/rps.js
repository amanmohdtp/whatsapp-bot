const Asena = require("../Utilis/events");
const Language = require("../language");
const Lang = Language.getString("rps");

const choices = ["rock", "paper", "scissors"];
const emojis = {
    rock: "🪨",
    paper: "📄",
    scissors: "✂️"
};

// Winning logic
function getWinner(playerChoice, botChoice) {
    if (playerChoice === botChoice) return "draw";

    if (
        (playerChoice === "rock" && botChoice === "scissors") ||
        (playerChoice === "paper" && botChoice === "rock") ||
        (playerChoice === "scissors" && botChoice === "paper")
    ) {
        return "player";
    } else {
        return "bot";
    }
}

Asena.addCommand(
    { pattern: "rps ?(.*)", fromMe: false, desc: Lang.RPS_DESC },
    async (message, match) => {
        const playerInput = match.trim().toLowerCase();
        
        if (playerInput === "") {
            return await message.sendMessage(`Please choose: *rock*, *paper*, or *scissors*.\nExample: !rps rock`);
        }

        const playerChoice = choices.find(c => c.startsWith(playerInput));
        
        if (!playerChoice) {
            return await message.sendMessage(Lang.INVALID_CHOICE);
        }

        // Bot's turn (simple random choice)
        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        const winner = getWinner(playerChoice, botChoice);
        
        let resultMsg = `*You Chose:* ${emojis[playerChoice]} (${playerChoice})\n`;
        resultMsg += `*Bot Chose:* ${emojis[botChoice]} (${botChoice})\n\n`;

        if (winner === "player") {
            resultMsg += "🎉 *YOU WIN!*";
        } else if (winner === "bot") {
            resultMsg += "😭 *BOT WINS!*";
        } else {
            resultMsg += "🤝 *IT'S A DRAW!*";
        }

        await message.sendMessage(resultMsg);
    }
);
