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

    if (lowerContent.slice(0, prefix.length) !== prefix) {
        return;
    }

    const command = (lowerContent.slice(prefix.length).match(/^[a-z]+/) || [""])[0];

    switch (command) {
        case "help": {
            const help = [
                "Dischord",
                `${prefix}help Dischordのヘルプを表示`,
                `${prefix}play [MML] MMLを音声ファイルに書き出し`,
                "Dischord MML 文法",
                "以下の文字列を連ねて記述します。",
                "CDEFGABR ドレミファソラシと休符に対応しています。数字を後ろにつけるとn分音符を表現します。",
                "<> オクターブを上げたり下げたりします。",
                "T テンポを後ろに表記された値に変更します。",
                "V 音量を変更します。デフォルトは50です。",
                "L デフォルトの音符の長さを変更します。",
                "@ 音色を変更します。以下は指定できる波形の一覧です。",
                "0: 矩形波(デューティ比50%), 1: 矩形波(デューティ比25%), 2: 矩形波(デューティ比12.5%), 3: 三角波, 4: ノコギリ波, 5: サイン波, 6: ホワイトノイズ",
                "(他のMMLと互換性はありません。)",
            ];
            send(help.join("\n"));
            break;
        }

        case "play": {
            send("生成しています。");
            const composed = compose(lowerContent.slice(prefix.length + command.length));
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
