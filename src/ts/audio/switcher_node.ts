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

		this.gain1.gain.cancelScheduledValues(audioContext.currentTime);
		this.gain2.gain.cancelScheduledValues(audioContext.currentTime);

		let gain1Target = b? 0 : 1;
		
		this.gain1.gain.setValueAtTime(1 - gain1Target, audioContext.currentTime);
		this.gain2.gain.setValueAtTime(gain1Target, audioContext.currentTime);
		this.gain1.gain.linearRampToValueAtTime(gain1Target, audioContext.currentTime + duration);
		this.gain2.gain.linearRampToValueAtTime(1 - gain1Target, audioContext.currentTime + duration);
		// We set the values here again because there's some rare WebAudio bug (that causes the gains to be at 10% volume randomly) happening sometimes? Idk...
		this.gain1.gain.setValueAtTime(gain1Target, audioContext.currentTime + duration);
		this.gain2.gain.setValueAtTime(1 - gain1Target, audioContext.currentTime + duration);

		this.currentSwitch = b;
	}
}