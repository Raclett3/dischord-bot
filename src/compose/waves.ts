export function sine(frequency: number, position: number) {
    return Math.sin(position * frequency * Math.PI);
}

export function square(frequency: number, position: number, duty: number = 0.5) {
    return (position * frequency) % 1 <= duty ? 1 : -1;
}

export function saw(frequency: number, position: number) {
    return (position * frequency) % 1;
}

export function triangle(frequency: number, position: number) {
    return Math.acos(Math.cos(position * frequency * 2 * Math.PI)) / Math.PI * 2 - 1;
}

export function whiteNoise() {
    return Math.random() * 2 - 1;
}
