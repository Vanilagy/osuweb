import { HighAccuracyMediaPlayer } from "../audio/high_accuracy_media_player";
import { mediaAudioNode, audioContext } from "../audio/audio";
import { AudioUtil } from "../util/audio_util";

async function tester() {
	let request = await fetch('./assets/test_maps/SeashoreOnTheMoon/audio.mp3');
	let arrayBuffer = await request.arrayBuffer();

	let player = new HighAccuracyMediaPlayer(mediaAudioNode);
	player.loadBuffer(arrayBuffer);
	player.setTempo(1.0);
	player.setPitch(1.0);
	player.setMinimumBeginningSliceDuration(10);
	await player.start(8);

	setTimeout(() => {
		//player.doThing();
	}, 2000);

	setInterval(() => {
		player.getCurrentTime();
	}, 0);

	return;

	setTimeout(() => {
		player.pause();

		setTimeout(() => {
			player.unpause();
		}, 1000);
	}, 2000);

	return;

	setInterval(() => {
		//console.log(player.getCurrentTime());
	}, 50);
}
window.addEventListener('mousedown', tester);