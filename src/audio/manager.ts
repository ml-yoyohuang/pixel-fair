import type { Settings } from '../domain/models';
export class AudioManager {
    context: AudioContext | null = null;
    musicGain: GainNode | null = null;
    sfxGain: GainNode | null = null;
    timer: ReturnType<typeof setInterval> | null = null;
    next = 0;
    step = 0;
    duck = false;
    constructor(public settings: Settings) { document.addEventListener('visibilitychange', this.visibility); }
    private visibility = () => {
        if (!this.context)
            return;
        if (document.hidden) {
            void this.context.suspend();
        }
        else {
            this.next = this.context.currentTime + .1;
            void this.context.resume();
        }
    };
    async enable() {
        if (!this.context) {
            this.context = new AudioContext();
            this.musicGain = this.context.createGain();
            this.musicGain.connect(this.context.destination);
            this.sfxGain = this.context.createGain();
            this.sfxGain.connect(this.context.destination);
            this.next = this.context.currentTime + .1;
            this.timer = setInterval(() => this.schedule(), 80);
        }
        await this.context.resume();
        this.apply();
    }
    apply() {
        const ctx = this.context;
        if (!ctx)
            return;
        this.musicGain!.gain.setTargetAtTime(this.settings.music ? this.settings.musicVolume * (this.duck ? .4 : 1) : 0, ctx.currentTime, .15);
        this.sfxGain!.gain.setTargetAtTime(this.settings.sfx ? this.settings.sfxVolume : 0, ctx.currentTime, .02);
    }
    setReading(value: boolean) { this.duck = value; this.apply(); }
    tone(freq: number, start: number, duration: number, gain: number, type: OscillatorType, dest: AudioNode) { const ctx = this.context!; const osc = ctx.createOscillator(), env = ctx.createGain(); osc.type = type; osc.frequency.value = freq; env.gain.setValueAtTime(0, start); env.gain.linearRampToValueAtTime(gain, start + .025); env.gain.exponentialRampToValueAtTime(.0001, start + duration); osc.connect(env); env.connect(dest); osc.start(start); osc.stop(start + duration + .02); }
    private schedule() {
        const ctx = this.context;
        if (!ctx || ctx.state !== 'running')
            return;
        const melody = [72, 76, 79, 76, 74, 72, 67, 0, 69, 72, 76, 79, 76, 74, 72, 0, 74, 77, 81, 79, 77, 74, 72, 0, 67, 69, 72, 74, 76, 72, 67, 0, 72, 76, 79, 84, 83, 79, 76, 0, 69, 72, 76, 79, 81, 79, 76, 0, 74, 77, 79, 77, 76, 74, 72, 69, 67, 69, 72, 76, 74, 72, 67, 0];
        const roots = [48, 45, 53, 55];
        while (this.next < ctx.currentTime + .3) {
            const note = melody[this.step % melody.length];
            if (note)
                this.tone(440 * 2 ** ((note - 69) / 12), this.next, .5, .12, 'sine', this.musicGain!);
            if (this.step % 4 === 0) {
                const root = roots[Math.floor(this.step / 16) % 4];
                this.tone(440 * 2 ** ((root - 69) / 12), this.next, .85, .09, 'triangle', this.musicGain!);
                for (const interval of [12, 16, 19])
                    this.tone(440 * 2 ** ((root + interval - 69) / 12), this.next + .025 * interval, .8, .035, 'sine', this.musicGain!);
            }
            this.step++;
            this.next += .28;
        }
    }
    sfx(kind: 'step' | 'confirm' | 'back' | 'stamp' | 'reward') {
        const ctx = this.context;
        if (!ctx || !this.settings.sfx || ctx.state !== 'running')
            return;
        const notes = { step: [130], confirm: [520, 660], back: [440, 330], stamp: [180, 240, 520], reward: [523, 659, 784, 1046] }[kind];
        notes.forEach((n, i) => this.tone(n, ctx.currentTime + i * .09, kind === 'step' ? .05 : .25, kind === 'step' ? .06 : .1, kind === 'step' ? 'triangle' : 'sine', this.sfxGain!));
    }
    destroy() {
        if (this.timer)
            clearInterval(this.timer);
        document.removeEventListener('visibilitychange', this.visibility);
        void this.context?.close();
    }
}
