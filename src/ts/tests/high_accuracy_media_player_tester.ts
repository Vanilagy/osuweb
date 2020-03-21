import { HighAccuracyMediaPlayer } from "../audio/high_accuracy_media_player";
import { mediaAudioNode, audioContext } from "../audio/audio";
import { AudioUtil } from "../util/audio_util";

async function tester() {
	let request = await fetch('./assets/test_maps/KillerBeast/audio.mp3');
	let arrayBuffer = await request.arrayBuffer();

	let player = new HighAccuracyMediaPlayer(mediaAudioNode);
	player.loadBuffer(arrayBuffer);
	player.setTempo(1.0);
	player.setPitch(1.0);
	await player.start(0);

	setInterval(() => {
		console.log(player.getCurrentTime());
	}, 50);

	setTimeout(() => {
		player.pause();

		setTimeout(() => {
			player.unpause();
		}, 50);
	}, 500);

	return;

	setTimeout(() => {
		player.pause();

		setTimeout(() => {
			player.unpause();
		}, 1000);
	}, 2000);

	setInterval(() => {
		//console.log(player.getCurrentTime());
	}, 50);
}
window.addEventListener('mousedown', tester);