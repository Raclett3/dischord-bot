export interface Effect {
    apply: (value: number) => number;
}

export class LowPassFilter implements Effect {
    private in1 = 0;
    private in2 = 0;
    private out1 = 0;
    private out2 = 0;

    constructor(private cutOff: number, private q: number, private sampling: number) {}

    public apply(input: number) {
        const omega = 2 * Math.PI * this.cutOff / this.sampling;
        const alpha = Math.sin(omega) / (2 / this.q);

        const a0 =  1 + alpha;
        const a1 = -2 * Math.cos(omega);
        const a2 =  1 - alpha;
        const b0 = (1 - Math.cos(omega)) / 2;
        const b1 =  1 - Math.cos(omega);
        const b2 = (1 - Math.cos(omega)) / 2;

        const output = b0 / a0 * input
                     + b1 / a0 * this.in1
                     + b2 / a0 * this.in2
                     - a1 / a0 * this.out1
                     - a2 / a0 * this.out2;

        this.in2 = this.in1;
        this.in1 = input;
        this.out2 = this.out1;
        this.out1 = output;

        return output;
    }
}

export class HighPassFilter implements Effect {
    private in1 = 0;
    private in2 = 0;
    private out1 = 0;
    private out2 = 0;

    constructor(private cutOff: number, private q: number, private sampling: number) {}

    public apply(input: number) {
        const omega = 2 * Math.PI * this.cutOff / this.sampling;
        const alpha = Math.sin(omega) / (2 / this.q);

        const a0 =   1 + alpha;
        const a1 =  -2 * Math.cos(omega);
        const a2 =   1 - alpha;
        const b0 =  (1 + Math.cos(omega)) / 2;
        const b1 = -(1 + Math.cos(omega));
        const b2 =  (1 + Math.cos(omega)) / 2;

        const output = b0 / a0 * input
                     + b1 / a0 * this.in1
                     + b2 / a0 * this.in2
                     - a1 / a0 * this.out1
                     - a2 / a0 * this.out2;

        this.in2 = this.in1;
        this.in1 = input;
        this.out2 = this.out1;
        this.out1 = output;

        return output;
    }
}
