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
import { FolderSelector } from './menu/import/folder_selector';
import { NotificationPanel } from './menu/notifications/notification_panel';
import { TaskManager } from './multithreading/task_manager';
import { SettingsPanel } from './menu/settings/settings_panel';
import { FpsMeter } from './menu/misc/fps_meter';
import { applySettings, loadSettings } from './menu/settings/settings';
import { Cursor } from './visuals/cursor';
import { loadKeybindings } from './input/key_bindings';
import { GlobalInputListener } from './input/global_input_listener';
import { VolumeController } from './menu/misc/volume_controller';
import { launchButton } from './menu/song_select/simple_songs_selector';
import { ToastManager } from './menu/notifications/toasts';
import { Database } from './storage/database';
import { ImportedFolderRequester } from './menu/import/imported_folder_requester';
import { PopupManager } from './menu/misc/popup_manager';
//import './tests/interactivity_playground';
//import './tests/high_accuracy_audio_player_tester';
//import './tests/polygon_tests';
//import './tests/animation_tests';
//import './tests/storyboard_parser_tests';
//import './tests/audio_player_tests';
//import './tests/file_system_tests';

const osu: string | null = 'ORERU!';

window.addEventListener('load', init);
async function init() {
	//return;

	await initMisc();
	initAudio();
	initBackground();
	initBeatmapLibrary();
	initToolbar(); // This should be called before most other UI elements
	initNotificationPanel();
	initSettingsPanel();
	initImport();
	initSongSelect();
	initVolumeController();
	initGameplay();
	initScoreGrades();
	initScoreScreen();
	setZIndexes();

	applySettings();
	launchButton.click(); // temp!
	globalState.beatmapLibrary.loadStoredBeatmaps();

	if (await globalState.database.get('directoryHandle', 'permissionGranted', true)) globalState.importedFolderRequester.show();
	
	await initBaseSkin();
	showChooseFile();

	globalState.cursor.refresh();

	console.log(osu!); // Love the syntax <3
}

async function initBaseSkin() {
	let defaultSkinPath = "./assets/skins/default";
	let defaultSkinDirectory = new VirtualDirectory("root");
	defaultSkinDirectory.networkFallbackUrl = defaultSkinPath;
	
	let defaultSkin = new Skin(defaultSkinDirectory);
	await defaultSkin.init(false);
	defaultSkin.allowSliderBallExtras = true;

	let selectedSkinPath = "./assets/skins/yugen";
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
	stage.addChild(toolbar.screenDim);
	stage.addChild(toolbar.container);
	rootInteractionGroup.add(toolbar.screenDimRegistration);
	rootInteractionGroup.add(toolbar.interactionGroup);

	uiEventEmitter.addListener('resize', () => toolbar.resize());
	addRenderingTask((now) => toolbar.update(now));

	globalState.toolbar = toolbar;
	globalState.musicPlayer = toolbar.getMusicPlayer();
}

function initNotificationPanel() {
	let panel = new NotificationPanel();
	stage.addChild(panel.container);
	rootInteractionGroup.add(panel.interactionGroup);

	uiEventEmitter.addListener('resize', () => panel.resize());
	addRenderingTask((now) => panel.update(now));

	globalState.notificationPanel = panel;
}

function initSettingsPanel() {
	let panel = new SettingsPanel();
	stage.addChild(panel.container);
	rootInteractionGroup.add(panel.interactionGroup);

	uiEventEmitter.addListener('resize', () => panel.resize());
	addRenderingTask((now) => panel.update(now));

	globalState.settingsPanel = panel;
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

function initImport() {
	let folderSelector = new FolderSelector();
	stage.addChild(folderSelector.container);
	rootInteractionGroup.add(folderSelector.interactionGroup);
	uiEventEmitter.addListener('resize', () => folderSelector.resize());
	addRenderingTask((now) => folderSelector.update(now));
	globalState.folderSelector = folderSelector;

	let requester = new ImportedFolderRequester();
	stage.addChild(requester.container);
	rootInteractionGroup.add(requester.interactionGroup);
	uiEventEmitter.addListener('resize', () => requester.resize());
	addRenderingTask((now) => requester.update(now));
	globalState.importedFolderRequester = requester;
}

async function initMisc() {
	globalState.database = new Database();

	globalState.taskManager = new TaskManager();
	globalState.settings = await loadSettings();
	globalState.keybindings = await loadKeybindings();

	let fpsMeter = new FpsMeter();
	stage.addChild(fpsMeter.container);
	uiEventEmitter.addListener('resize', () => fpsMeter.resize());
	addRenderingTask((now) => fpsMeter.update(now));
	globalState.fpsMeter = fpsMeter;

	let cursor = new Cursor();
	stage.addChild(cursor.container);
	uiEventEmitter.addListener('resize', () => cursor.refresh());
	addRenderingTask((now) => cursor.update(now));
	globalState.cursor = cursor;

	let globalInputListener = new GlobalInputListener();
	rootInteractionGroup.add(globalInputListener.registration);
	globalState.globalInputListener = globalInputListener;

	let toastManager = new ToastManager();
	stage.addChild(toastManager.container);
	uiEventEmitter.addListener('resize', () => toastManager.resize());
	addRenderingTask((now) => toastManager.update(now));
	globalState.toastManager = toastManager;

	let popupManager = new PopupManager();
	stage.addChild(popupManager.container);
	rootInteractionGroup.add(popupManager.interactionGroup);
	uiEventEmitter.addListener('resize', () => popupManager.resize());
	addRenderingTask((now) => popupManager.update(now));
	globalState.popupManager = popupManager;
}

function initVolumeController() {
	let volumeController = new VolumeController()

	stage.addChild(volumeController.container);
	rootInteractionGroup.add(volumeController.interactionGroup);
	uiEventEmitter.addListener('resize', () => volumeController.resize());
	addRenderingTask((now) => volumeController.update(now));

	globalState.volumeController = volumeController;
}

function setZIndexes() {
	globalState.backgroundManager.container.zIndex = -10;
	globalState.gameplayController.container.zIndex = 0;
	globalState.scoreScreen.container.zIndex = 1;
	globalState.songSelect.container.zIndex = 2;
	globalState.toolbar.screenDim.zIndex = 3;
	globalState.notificationPanel.container.zIndex = 3.3;
	globalState.settingsPanel.container.zIndex = 3.4;
	globalState.toolbar.container.zIndex = 3.9;
	globalState.folderSelector.container.zIndex = 4;
	globalState.importedFolderRequester.container.zIndex = 4;
	globalState.popupManager.container.zIndex = 8;
	globalState.volumeController.container.zIndex = 9;
	globalState.toastManager.container.zIndex = 9.5;
	globalState.fpsMeter.container.zIndex = 10;
	globalState.cursor.container.zIndex = 100;

	globalState.gameplayController.interactionGroup.setZIndex(0);
	globalState.songSelect.interactionGroup.setZIndex(1);
	globalState.scoreScreen.interactionGroup.setZIndex(2);
	globalState.toolbar.screenDimRegistration.setZIndex(3);
	globalState.notificationPanel.interactionGroup.setZIndex(3.3);	
	globalState.settingsPanel.interactionGroup.setZIndex(3.4);
	globalState.toolbar.interactionGroup.setZIndex(3.9);
	globalState.folderSelector.interactionGroup.setZIndex(4);
	globalState.importedFolderRequester.interactionGroup.setZIndex(4);
	globalState.popupManager.interactionGroup.setZIndex(8);
	globalState.volumeController.interactionGroup.setZIndex(9);
	globalState.globalInputListener.registration.setZIndex(100);
}