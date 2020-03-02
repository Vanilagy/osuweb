import './visuals/ui';
import './visuals/simple_beatmap_selector';
import './menu/song_select/beatmap_carousel';
import { baseSkin } from './game/skin/skin';
import { showChooseFile } from './visuals/simple_beatmap_selector';
import { initSongSelect } from './menu/song_select/song_select';
//import './tests/interactivity_playground';
//import './tests/high_accuracy_media_player_tester';

const osu: string | null = 'ORERU!';

async function init() {
	await baseSkin.init();
	showChooseFile();
	initSongSelect();
	
	console.log(osu!); // Love the syntax <3
}

window.addEventListener('load', init);