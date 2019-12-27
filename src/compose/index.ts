import * as waves from "./waves";

type Stack = {
    index: number,
    count: number,
};

type Wave =
    "square50" |
    "square25" |
    "square12.5" |
    "triangle" |
    "saw" |
    "sine" |
    "whitenoise";

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
            return acc + 240 / tempo / parseInt(dotted ? token.slice(0, -1) : token, 10) * (dotted ? 1.5 : 1);
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

    const pattern = /([a-g][+-]?|r)[0-9]*\.?(&[0-9]*\.?)*|[<>\[]|\][0-9]*|[tv][0-9]+(\.[0-9]+)?|l[0-9]+\.?(&[0-9]+\.?)*|@[0-9]+/g;
    const tokens = source.match(pattern) || [];
    const sampling = 44100;
    const composed: number[] = [];
    const stack: Stack[] = [];
    let length = 0;
    let position = 0;
    let tempo = 120;
    let octave = 0;
    let volume = 0.5;
    let defaultNoteLength = "8";
    let waveType: Wave = "square50";

    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
        const token = tokens[tokenIndex];
        switch (true) {
            case token[0] >= "a" && token[0] <= "g": {
                const scale = token[0] + (token[1] === "-" || token[1] === "+" ? token[1] : "");
                const lengthString = token.slice(scale.length) || defaultNoteLength;
                const noteLength = Math.floor(parseLength(lengthString, tempo) * sampling);
                const frequency = frequencyScale[scale] * (2 ** octave);
                let gate = false;

                for (let i = 0; i < noteLength; i++) {
                    if (gate) {
                        pushOverride(position + i, 0);
                        continue;
                    }

                    const value =
                        waveType === "square50" ? waves.square(frequency, i / sampling, 0.5) :
                        waveType === "square25" ? waves.square(frequency, i / sampling, 0.25) :
                        waveType === "square12.5" ? waves.square(frequency, i / sampling, 0.125) :
                        waveType === "triangle" ? waves.triangle(frequency, i / sampling) :
                        waveType === "saw" ? waves.saw(frequency, i / sampling) :
                        waveType === "sine" ? waves.sine(frequency, i / sampling) :
                        waveType === "whitenoise" ? waves.whiteNoise() : 0;
                    pushOverride(position + i, value * volume);

                    if (noteLength - i < sampling / frequency && Math.abs(value) < 0.05) {
                        gate = true;
                    }
                }
                position += noteLength;
                break;
            }

            case token[0] === "r": {
                const lengthString = token.slice(1) || defaultNoteLength;
                const noteLength = Math.floor(parseLength(lengthString, tempo) * sampling);

                for (let i = 0; i <= noteLength; i++) {
                    pushOverride(position + i, 0);
                }
                position += noteLength;
                break;
            }

            case token[0] === "l": {
                defaultNoteLength = token.slice(1);
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

            case token[0] === "v": {
                volume = parseFloat(token.slice(1)) / 100;
                break;
            }

            case token[0] === "@": {
                const waveTypes: Wave[] = [
                    "square50",
                    "square25",
                    "square12.5",
                    "triangle",
                    "saw",
                    "sine",
                    "whitenoise",
                ];
                waveType = waveTypes[parseInt(token.slice(1), 10)] || "square50";
                break;
            }

            case token[0] === "[": {
                stack.push({
                    index: tokenIndex,
                    count: -1,
                });

                break;
            }

            case token[0] === "]": {
                const top = stack.pop();
                if (!top) {
                    break;
                }

                const count = parseInt(token.slice(1), 10) || 1;
                if (top.count === -1) {
                    top.count = count;
                }
                top.count--;

                if (top.count > 0) {
                    tokenIndex = top.index;
                    stack.push(top);
                }

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
