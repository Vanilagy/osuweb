import { addTickingTask } from "../util/ticker";
import { windowFocused } from "../visuals/ui";
import { globalState } from "../global_state";

const DEFAULT_MASTER_GAIN_VOLUME = 0.15;

export let audioContext = new AudioContext();
if (audioContext.state === "suspended") console.warn("AUDIO CONTEXT IS SUSPENDED. MAKE SURE TO RESUME IT BEFORE DOING ANYTHING IMPORTANT!");

export let globalGain = audioContext.createGain();
globalGain.connect(audioContext.destination);

export let masterGain = audioContext.createGain();
masterGain.gain.value = DEFAULT_MASTER_GAIN_VOLUME;
masterGain.connect(globalGain);

export let mediaAudioNode = audioContext.createGain();
mediaAudioNode.gain.value = 0.75;
mediaAudioNode.connect(masterGain);

export let soundEffectsNode = audioContext.createGain();
soundEffectsNode.gain.value = 1.0;
soundEffectsNode.connect(masterGain);

let lastWindowFocusedState: boolean = null;
addTickingTask(() => {
	if (!globalState.settings) return;

	if (windowFocused === lastWindowFocusedState) return;
	lastWindowFocusedState = windowFocused;

	if (windowFocused) {
		globalGain.gain.setValueAtTime(globalGain.gain.value, audioContext.currentTime);
		globalGain.gain.exponentialRampToValueAtTime(1, audioContext.currentTime + 0.333);
	} else {
		let blurredValue = (() => {
			switch (globalState.settings['backgroundAudioBehavior']) {
				case 'none': return 1;
				case 'quiet': return 0.03;
				case 'mute': return 0.00001; // So that the exponential ramp up doesn't complain
			}
		})();

		globalGain.gain.setValueAtTime(globalGain.gain.value, audioContext.currentTime);
		globalGain.gain.exponentialRampToValueAtTime(blurredValue, audioContext.currentTime + 0.333);
	}
});