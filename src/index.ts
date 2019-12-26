import * as Discord from "discord.js";

async function onMessage(message: Discord.Message) {
    const prefix = "dc!";

    if (message.author.bot) {
        return;
    }

    const content = message.content;

    if (content.slice(0, 3) === prefix) {
        message.reply(message.content);
    }
}

(async () => {
    const token = process.env.DISCHORD_TOKEN;

    if (!token) {
        console.log("環境変数 \"DISCHORD_TOKEN\" がセットされていません。");
        process.exit(1);
    }

    const client = new Discord.Client();

    client.on("ready", () => {
        console.log(`準備完了: ${client.user.username}`);
    });

    client.on("message", onMessage);

    await client.login(token);
})();
