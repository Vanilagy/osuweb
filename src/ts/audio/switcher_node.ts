import { audioContext } from "./audio";

export class SwitcherNode {
	public gain1: GainNode;
	public gain2: GainNode;
	public currentSwitch = false;

	constructor() {
		this.gain1 = audioContext.createGain();
		this.gain2 = audioContext.createGain();

		this.gain1.gain.value = 1;
		this.gain2.gain.value = 0;
	}

	connect(node: AudioNode) {
		this.gain1.connect(node);
		this.gain2.connect(node);
	}

	disconnect() {
		this.gain1.disconnect();
		this.gain2.disconnect();
	}

	setSwitch(b: boolean, duration: number) {
		if (this.currentSwitch === b) return;

		if (!b) {
			this.gain1.gain.setValueAtTime(0, audioContext.currentTime);
			this.gain2.gain.setValueAtTime(1, audioContext.currentTime);

			this.gain1.gain.linearRampToValueAtTime(1, audioContext.currentTime + duration);
			this.gain2.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
		} else {
			this.gain1.gain.setValueAtTime(1, audioContext.currentTime);
			this.gain2.gain.setValueAtTime(0, audioContext.currentTime);

			this.gain1.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
			this.gain2.gain.linearRampToValueAtTime(1, audioContext.currentTime + duration);
		}

		this.currentSwitch = b;
	}
}