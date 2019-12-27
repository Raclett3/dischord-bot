import * as waves from "./waves";

const frequencyScale: {[key: string]: number} = {
    "c-":  493.883,
    "c" :  523.251,
    "c+":  554.365,
    "d-":  554.365,
    "d" :  587.330,
    "d+":  622.254,
    "e-":  622.254,
    "e" :  659.255,
    "e+":  698.456,
    "f-":  659.255,
    "f" :  698.456,
    "f+":  739.989,
    "g-":  739.989,
    "g" :  783.991,
    "g+":  830.609,
    "a-":  830.609,
    "a" :  880.000,
    "a+":  932.328,
    "b-":  932.328,
    "b" :  987.767,
    "b+": 1046.502,
};

function parseLength(length: string, tempo: number) {
    const tokens = length.split("&");
    return tokens.reduce<number>((acc, token) => {
            const dotted = token.slice(-1) === ".";
            return acc + 240 / tempo / (parseInt(dotted ? token.slice(0, -1) : token, 10) * (dotted ? 1.5 : 1));
        }, 0);
}

export function compose(source: string): Buffer {
    function pushOverride(index: number, value: number) {
        if (index >= length) {
            composed.push(value);
            length++;
        } else {
            composed[index] += value;
        }
    }

    const tokens = source.match(/([a-g][+-]?|r)[0-9]*\.?(&[0-9]*\.?)*|[<>]|t[0-9]+(\.[0-9]+)?/g) || [];
    const sampling = 44100;
    const composed: number[] = [];
    let length = 0;
    let position = 0;
    let tempo = 120;
    let octave = 0;

    for (const token of tokens) {
        switch (true) {
            case token[0] >= "a" && token[0] <= "g": {
                const scale = token[0] + (token[1] === "-" || token[1] === "+" ? token[1] : "");
                const noteLength = Math.floor(parseLength(token.slice(scale.length), tempo) * sampling);
                const frequency = frequencyScale[scale] * (2 ** octave);

                for (let i = 0; i <= noteLength; i++) {
                    pushOverride(position + i, waves.sine(frequency, i / sampling));
                }
                position += noteLength;
                break;
            }

            case token[0] === "r": {
                const noteLength = Math.floor(parseLength(token.slice(1), tempo) * sampling);

                for (let i = 0; i <= noteLength; i++) {
                    pushOverride(position + i, 0);
                }
                position += noteLength;
                break;
            }

            case token === "<": {
                octave++;
                break;
            }

            case token === ">": {
                octave--;
                break;
            }

            case token[0] === "t": {
                tempo = parseFloat(token.slice(1));
                break;
            }
        }
    }

    const headerLength = 44;
    const buffer = Buffer.alloc(length * 2 + headerLength);
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(length * 2 + 36, 4);
    buffer.write("WAVEfmt ", 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampling, 24);
    buffer.writeUInt32LE(sampling * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(length * 2, 40);
    composed.forEach((value, index) => {
        const data = Math.floor(Math.min(Math.max(-1, value), 1) * 0x7FFF);
        buffer.writeInt16LE(data, index * 2 + headerLength);
    });

    return buffer;
}
