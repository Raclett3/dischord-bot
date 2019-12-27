import {spawn} from "child_process";
import * as Discord from "discord.js";
import {ReadableStreamBuffer} from "stream-buffers";
import {compose} from "./compose";

function appendRiffHeader(buffer: Buffer, sampling = 44100) {
    const header = Buffer.alloc(44);
    const length = buffer.length;
    header.write("RIFF", 0);
    header.writeUInt32LE(length * 2 + 36, 4);
    header.write("WAVEfmt ", 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampling, 24);
    header.writeUInt32LE(sampling * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(length * 2, 40);

    return Buffer.concat([header, buffer]);
}

type QueueItem = {
    channel: Discord.VoiceChannel,
    stream: ReadableStreamBuffer,
};

const queue: QueueItem[] = [];

function playStream(channel: Discord.VoiceChannel, stream: ReadableStreamBuffer) {
    async function processQueue() {
        if (queue.length === 0) {
            return;
        }

        queue[0].channel.join().then((connection) => {
            const dispatcher = connection.playConvertedStream(queue[0].stream);
            dispatcher.on("end", () => {
                connection.disconnect();
                queue.shift();
                processQueue();
            });
        });
    }

    queue.push({channel, stream});
    if (queue.length === 1) {
        processQueue();
    }
}

async function convertToMp3(wavBuffer: Buffer) {
    return await new Promise<Buffer>((resolve) => {
        const ffmpeg = spawn("ffmpeg", [
            "-i", "pipe:0",
            "-vn",
            "-f", "mp3",
            "-ac", "1",
            "-ab", "192k",
            "-ar", "44100",
            "-acodec", "libmp3lame",
            "pipe:1",
        ], {
            stdio: ["pipe", "pipe", "pipe"],
        });
        let mp3 = Buffer.alloc(0);
        ffmpeg.stdout.on("data", (data: Buffer) => {
            mp3 = Buffer.concat([mp3, data]);
        });
        ffmpeg.on("close", () => {
            resolve(mp3);
        });
        ffmpeg.stdin.write(wavBuffer);
        ffmpeg.stdin.end();
    });
}

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
                `${prefix}vcplay [MML] MMLをVCで再生`,
                "Dischord MML 文法",
                "以下の文字列を連ねて記述します。",
                "CDEFGABR ドレミファソラシと休符に対応しています。数字を後ろにつけるとn分音符を表現します。",
                "<> オクターブを上げたり下げたりします。",
                "T テンポを後ろに表記された値に変更します。",
                "V 音量を変更します。デフォルトは50です。",
                "L デフォルトの音符の長さを変更します。",
                "@ 音色を変更します。以下は指定できる波形の一覧です。",
                "0: 矩形波(デューティ比50%), 1: 矩形波(デューティ比25%), 2: 矩形波(デューティ比12.5%), 3: 三角波, 4: ノコギリ波, 5: サイン波, 6: ホワイトノイズ",
                "@Ea,d,s,r ADSRエンベロープを設定します。",
                "@Un,d n個の音をd重ねて出力します。",
                "[]n 括弧で囲んだ範囲をn回繰り返します。",
                "; 複数の音を重ねるために、書き込み位置を先頭に戻します。",
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
                    attachment: await convertToMp3(appendRiffHeader(composed)),
                    name: "result.mp3",
                },
            });
            break;
        }

        case "vcplay": {
            if (!message.member.voiceChannel) {
                send("あなたはVCに参加していません。");
                break;
            }
            send("生成しています。");
            const composed = compose(lowerContent.slice(prefix.length + command.length), 96000);
            const stream = new ReadableStreamBuffer();
            stream.push(composed);
            playStream(message.member.voiceChannel, stream);
            send("成功しました。結果はキューに追加され、VCにて順次再生されます。");
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
