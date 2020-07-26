const DEFAULT_MASTER_GAIN_VOLUME = 0.15;

export let audioContext = new AudioContext();
if (audioContext.state === "suspended") console.warn("AUDIO CONTEXT IS SUSPENDED. MAKE SURE TO RESUME IT BEFORE DOING ANYTHING IMPORTANT!");

export let masterGain = audioContext.createGain();
masterGain.gain.value = DEFAULT_MASTER_GAIN_VOLUME;
masterGain.connect(audioContext.destination);

export let mediaAudioNode = audioContext.createGain();
mediaAudioNode.gain.value = 0.75;
mediaAudioNode.connect(masterGain);

export let soundEffectsNode = audioContext.createGain();
soundEffectsNode.gain.value = 1.0;
soundEffectsNode.connect(masterGain);