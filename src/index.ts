import * as Discord from "discord.js";
import {compose} from "./compose";

async function onMessage(message: Discord.Message) {
    function send(content: string, options?: Discord.MessageOptions) {
        message.channel.send(content, options);
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
                `${prefix}play [MML] MMLを音声ファイルに書き出し`,
                "Dischord MML 文法",
                "以下の文字列を連ねて記述します。",
                "CDEFGABR ドレミファソラシと休符に対応しています。数字を後ろにつけるとn分音符を表現します。",
                "T テンポを後ろに表記された値に変更します。",
                "(他のMMLと互換性はありません。)",
            ];
            send(help.join("\n"));
            break;
        }

        case "play": {
            send("生成しています。");
            const composed = compose(lowerContent.slice(3 + command.length));
            send("成功しました。", {
                file: {
                    attachment: composed,
                    name: "result.wav",
                },
            });
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
