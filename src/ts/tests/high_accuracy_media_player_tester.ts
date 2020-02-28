import { HighAccuracyMediaPlayer } from "../audio/high_accuracy_media_player";
import { mediaAudioNode } from "../audio/audio";

async function tester() {
	let request = await fetch('./assets/test_maps/NowOnStage/audio.mp3');
	let arrayBuffer = await request.arrayBuffer();

	let player = new HighAccuracyMediaPlayer(mediaAudioNode);
	player.loadBuffer(arrayBuffer);
	await player.start(0);

	setTimeout(() => {
		player.stop();

		setTimeout(() => {
			player.start(20)
		}, 1000);
	}, 1500);

	setInterval(() => {
		console.log(player.getCurrentTime());
	}, 0);
}
window.addEventListener('mousedown', tester);