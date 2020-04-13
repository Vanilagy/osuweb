import { AudioBufferPlayer } from "../audio/audio_buffer_player";
import { mediaAudioNode } from "../audio/audio";

window.addEventListener('mousedown', run);
async function run() {
	let request = await fetch("./assets/test_maps/NowOnStage/audio.mp3");
	let arrayBuffer = await request.arrayBuffer();

	let player = new AudioBufferPlayer(mediaAudioNode);
	await player.loadBuffer(arrayBuffer);

	player.setPlaybackRate(1.0);
	player.start(5);

	setInterval(() => {
		console.log(player.getCurrentTime());
	}, 0);

	setTimeout(() => {
		player.pause();

		setTimeout(() => {
			player.unpause();
		}, 1000);
	}, 2000);
}