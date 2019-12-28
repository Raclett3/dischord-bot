import * as Effects from "./effects";
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
    "whitenoise" |
    "sineharmony" |
    "none";

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

function renderWave(waveType: Wave, frequency: number, offset: number, harmony: number[]) {
    function renderHarmony() {
        return harmony.reduce(
                    (acc, volume, index) => acc + waves.sine(frequency * (index + 1), offset) * volume, 0);
    }

    return (
        waveType === "square50" ? waves.square(frequency, offset, 0.5) :
        waveType === "square25" ? waves.square(frequency, offset, 0.25) :
        waveType === "square12.5" ? waves.square(frequency, offset, 0.125) :
        waveType === "triangle" ? waves.triangle(frequency, offset) :
        waveType === "saw" ? waves.saw(frequency, offset) :
        waveType === "sine" ? waves.sine(frequency, offset) :
        waveType === "whitenoise" ? waves.whiteNoise() :
        waveType === "sineharmony" ? renderHarmony() / harmony.length : 0
    );
}

function applyEffects(input: number, effects: Effects.Effect[]) {
    return effects.reduce((acc, effect) => effect.apply(acc), input);
}

export function compose(source: string, sampling = 44100): Buffer {
    function pushOverride(index: number, value: number) {
        if (index >= length) {
            composed.push(value);
            length++;
        } else {
            composed[index] += value;
        }
    }

    const pattern = /([a-g][+-]?|r)\d*\.?(&\d*\.?)*|[<>\[]|\]\d*|[tv]\d+(\.\d+)?|l\d+\.?(&\d+\.?)*|@\d+|@e\d+,\d+,\d+,\d+|;|@u\d+,\d+|@h\d+(,\d+)*|#[a-z]\d+(\.\d+)?(,\d+(\.\d+)?)*/g;
    const tokens = source.match(pattern) || [];
    const composed: number[] = [];
    const stack: Stack[] = [];
    let length = 0;
    let position = 0;
    let tempo = 120;
    let octave = 0;
    let volume = 0.5;
    let defaultNoteLength = "8";
    let waveType: Wave = "square50";
    let harmony: number[] = [];
    const effects: Effects.Effect[] = [];

    let attack = 0;
    let decay = 0;
    let sustain = 1;
    let release = 0;
    let unisonCount = 1;
    let unisonDetune = 0;

    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
        const token = tokens[tokenIndex];
        switch (true) {
            case token[0] >= "a" && token[0] <= "g": {
                const scale = token[0] + (token[1] === "-" || token[1] === "+" ? token[1] : "");
                const lengthString = token.slice(scale.length) || defaultNoteLength;
                const noteLength = Math.floor(parseLength(lengthString, tempo) * sampling);
                const frequency = frequencyScale[scale] * (2 ** octave);
                let gate = false;

                const attackLength = Math.min(Math.floor(attack * sampling), noteLength);
                const decayLength = Math.min(Math.floor(decay * sampling), noteLength - attackLength);
                const releaseLength = Math.floor(release * sampling);

                for (let i = 0; i < noteLength + releaseLength; i++) {
                    if (gate) {
                        const value = applyEffects(renderWave("none", 0, i, harmony), effects) * volume;
                        pushOverride(position + i, value);
                        continue;
                    } else {
                        const envelope =
                                attackLength > i ? i / attackLength :
                                decayLength > i - attackLength ? 1 - (1 - sustain) * (i - attackLength) / decayLength :
                                noteLength <= i ? sustain * (noteLength + releaseLength - i) / releaseLength :
                                sustain;
                        let value = 0;

                        for (let j = 0; j < unisonCount; j++) {
                            const unisonFrequency = unisonCount >= 2
                                                    ? (1 + unisonDetune / 10000) ** (-1 + j * 2 / (unisonCount - 1))
                                                    : 1;
                            value += renderWave(
                                        waveType, frequency * unisonFrequency, i / sampling, harmony) / unisonCount;
                        }

                        value *= volume * envelope;
                        value = applyEffects(value, effects);
                        pushOverride(position + i, value);

                        if (noteLength + releaseLength - i < sampling / frequency && Math.abs(value) < 0.05) {
                            gate = true;
                        }
                    }
                }
                position += noteLength;
                break;
            }

            case token[0] === "r": {
                const lengthString = token.slice(1) || defaultNoteLength;
                const noteLength = Math.floor(parseLength(lengthString, tempo) * sampling);

                for (let i = 0; i <= noteLength; i++) {
                    const value = applyEffects(renderWave("none", 0, i, harmony), effects) * volume;
                    pushOverride(position + i, value);
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

            case token.slice(0, 2) === "@e": {
                [attack, decay, sustain, release] = token.slice(2).split(",").map((param) => parseInt(param, 10) / 100);
                break;
            }

            case token.slice(0, 2) === "@h": {
                waveType = "sineharmony";
                harmony = token.slice(2).split(",").map((param) => parseInt(param, 10) / 100);
                break;
            }

            case token.slice(0, 2) === "@u": {
                [unisonCount, unisonDetune] = token.slice(2).split(",").map((param) => parseInt(param, 10));
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

            case token[0] === "#": {
                const effectName = token[1];
                const params = token.slice(2).split(",").map((param) => parseFloat(param));

                switch (effectName) {
                    case "l": {
                        if (params.length < 2) {
                            break;
                        }

                        const cutOff = params[0];
                        const resonance = params[1] / 100 + (1 / Math.sqrt(2));
                        effects.push(new Effects.LowPassFilter(cutOff, resonance, sampling));

                        break;
                    }

                    case "h": {
                        if (params.length < 2) {
                            break;
                        }

                        const cutOff = params[0];
                        const resonance = params[1] / 100 + (1 / Math.sqrt(2));
                        effects.push(new Effects.HighPassFilter(cutOff, resonance, sampling));

                        break;
                    }

                    case "e": {
                        if (params.length < 2) {
                            break;
                        }

                        const feedBack = Math.min(params[0] / 100, 1);
                        const delay = Math.floor(params[1] * sampling);
                        effects.push(new Effects.Echo(feedBack, delay));

                        break;
                    }
                }

                break;
            }

            case token[0] === ";": {
                position = 0;
                octave = 0;
                volume = 0.5;
                defaultNoteLength = "8";
                waveType = "square50";
                attack = 0;
                decay = 0;
                sustain = 1;
                release = 0;
                unisonCount = 0;
                unisonDetune = 0;

                break;
            }
        }
    }

    const buffer = Buffer.alloc(length * 2);
    composed.forEach((value, index) => {
        const data = Math.floor(Math.min(Math.max(-1, value), 1) * 0x7FFF);
        buffer.writeInt16LE(data, index * 2);
    });

    return buffer;
}
