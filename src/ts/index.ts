import './visuals/ui';
import './visuals/simple_beatmap_selector';
import './menu/song_select/simple_songs_selector';
import './menu/song_select/song_select';
import { Skin, joinSkins } from './game/skin/skin';
import { showChooseFile } from './visuals/simple_beatmap_selector';
import { SongSelect } from './menu/song_select/song_select';
import { stage, addRenderingTask } from './visuals/rendering';
import { rootInteractionGroup } from './input/interactivity';
import { globalState } from './global_state';
import { uiEventEmitter } from './visuals/ui';
import { mediaAudioNode } from './audio/audio';
import { HighAccuracyAudioPlayer } from './audio/high_accuracy_audio_player';
import { GameplayController } from './game/gameplay_controller';
import { addTickingTask } from './util/ticker';
import { BackgroundManager } from './visuals/background';
import { VirtualDirectory } from './file_system/virtual_directory';
import { ScoreScreen } from './menu/score/score_screen';
import { initScoreGrades } from './menu/components/score_grade_icon';
import { AudioMediaPlayer } from './audio/audio_media_player';
import { Toolbar } from './menu/toolbar/toolbar';
import { BeatmapLibrary } from './datamodel/beatmap/beatmap_library';
//import './tests/interactivity_playground';
//import './tests/high_accuracy_audio_player_tester';
//import './tests/polygon_tests';
//import './tests/animation_tests';
//import './tests/storyboard_parser_tests';
//import './tests/audio_player_tests';

const osu: string | null = 'ORERU!';

window.addEventListener('load', init);
async function init() {
	//return;

	initAudio();
	initBackground();
	initBeatmapLibrary();
	initToolbar();
	initSongSelect();
	await initBaseSkin();
	initGameplay();
	initScoreGrades();
	initScoreScreen();
	setZIndexes();
	showChooseFile();

	console.log(osu!); // Love the syntax <3
}

async function initBaseSkin() {
	let defaultSkinPath = "./assets/skins/default";
	let defaultSkinDirectory = new VirtualDirectory("root");
	defaultSkinDirectory.networkFallbackUrl = defaultSkinPath;
	
	let defaultSkin = new Skin(defaultSkinDirectory);
	await defaultSkin.init(false);
	defaultSkin.allowSliderBallExtras = true;

	let selectedSkinPath = "./assets/skins/seoul";
	let selectedSkinDirectory = new VirtualDirectory("root");
	selectedSkinDirectory.networkFallbackUrl = selectedSkinPath;

	let selectedSkin = new Skin(selectedSkinDirectory);
	await selectedSkin.init(false);
	if (selectedSkinPath === defaultSkinPath) selectedSkin.allowSliderBallExtras = true; // Kinda tempy

	let baseSkin = joinSkins([defaultSkin, selectedSkin], true, true, true);
	await baseSkin.readyAssets();

	globalState.baseSkin = baseSkin;
}

function initBeatmapLibrary() {
	let library = new BeatmapLibrary();
	globalState.beatmapLibrary = library;
}

function initToolbar() {
	let toolbar = new Toolbar();
	stage.addChild(toolbar.container);
	rootInteractionGroup.add(toolbar.interactionGroup);

	uiEventEmitter.addListener('resize', () => toolbar.resize());
	addRenderingTask((now) => toolbar.update(now));

	globalState.toolbar = toolbar;
}

function initSongSelect() {
	let songSelect = new SongSelect();
	stage.addChild(songSelect.container);
	rootInteractionGroup.add(songSelect.interactionGroup);

	uiEventEmitter.addListener('resize', () => songSelect.resize());
	addRenderingTask((now, dt) => songSelect.update(now, dt));

	globalState.songSelect = songSelect;
}

function initAudio() {
	globalState.basicSongPlayer = new AudioMediaPlayer(mediaAudioNode);
	globalState.gameplayAudioPlayer = new HighAccuracyAudioPlayer(mediaAudioNode);
	globalState.gameplayAudioPlayer.disableTimeCap(); // For beatmaps where the last object is RIGHT when the song file ends, this is handy to have, because then, animations can keep playing.
}

function initBackground() {
	let manager = new BackgroundManager();
	stage.addChild(manager.container);

	uiEventEmitter.addListener('resize', () => manager.resize());
	addRenderingTask((now) => manager.update(now));
	
	globalState.backgroundManager = manager;
}

function initGameplay() {
	let controller = new GameplayController();
	stage.addChild(controller.container);
	rootInteractionGroup.add(controller.interactionGroup);

	uiEventEmitter.addListener('resize', () => controller.resize());
	addRenderingTask((now) => controller.render(now));
	addTickingTask(() => controller.tick());

	globalState.gameplayController = controller;
}

function initScoreScreen() {
	let scoreScreen = new ScoreScreen();
	stage.addChild(scoreScreen.container);
	rootInteractionGroup.add(scoreScreen.interactionGroup);

	uiEventEmitter.addListener('resize', () => scoreScreen.resize());
	addRenderingTask((now) => scoreScreen.update(now));

	globalState.scoreScreen = scoreScreen;
}

function setZIndexes() {
	globalState.backgroundManager.container.zIndex = -10;
	globalState.gameplayController.container.zIndex = 0;
	globalState.scoreScreen.container.zIndex = 1;
	globalState.songSelect.container.zIndex = 2;
	globalState.toolbar.container.zIndex = 3;
}