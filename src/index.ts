import * as Discord from "discord.js";

async function onMessage(message: Discord.Message) {
    function send(content: string) {
        message.channel.send(content);
    }

    const prefix = "dc!";

    if (message.author.bot) {
        return;
    }

    const lowerContent = message.content.toLowerCase();

    if (lowerContent.slice(0, 3) !== prefix) {
        return;
    }

    const command = (lowerContent.slice(3).match(/^[a-z]+/) || [""])[0];

    switch (command) {
        case "help": {
            const help = [
                "Dischord",
                `${prefix}help Dischordのヘルプを表示`,
                "Dischord MML 文法",
            ];
            send(help.join("\n"));
            break;
        }

        default: {
            send("不明なコマンドです");
            break;
        }
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
