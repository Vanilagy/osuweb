import { SongSelect } from "./menu/song_select/song_select";
import { GameplayController } from "./game/gameplay_controller";
import { HighAccuracyAudioPlayer } from "./audio/high_accuracy_audio_player";
import { BackgroundManager } from "./visuals/background";
import { Skin } from "./game/skin/skin";
import { ScoreScreen } from "./menu/score/score_screen";
import { Toolbar } from "./menu/toolbar/toolbar";
import { BeatmapLibrary } from "./datamodel/beatmap/beatmap_library";
import { FolderSelector } from "./menu/import/folder_selector";
import { NotificationPanel } from "./menu/notifications/notification_panel";
import { TaskManager } from "./multithreading/task_manager";
import { SettingsPanel } from "./menu/settings/settings_panel";
import { FpsMeter } from "./menu/misc/fps_meter";
import { Settings } from "./menu/settings/settings";
import { Cursor } from "./visuals/cursor";
import { Keybindings } from "./input/key_bindings";
import { GlobalInputListener } from "./input/global_input_listener";
import { VolumeController } from "./menu/misc/volume_controller";
import { MusicPlayer } from "./menu/music_player/music_player";
import { ToastManager } from "./menu/notifications/toasts";
import { Database } from "./storage/database";

export const globalState = {
	beatmapLibrary: null as BeatmapLibrary,
	toolbar: null as Toolbar,
	notificationPanel: null as NotificationPanel,
	songSelect: null as SongSelect,
	gameplayController: null as GameplayController,
	gameplayAudioPlayer: null as HighAccuracyAudioPlayer,
	backgroundManager: null as BackgroundManager,
	baseSkin: null as Skin,
	scoreScreen: null as ScoreScreen,
	folderSelector: null as FolderSelector,
	taskManager: null as TaskManager,
	settingsPanel: null as SettingsPanel,
	fpsMeter: null as FpsMeter,
	settings: null as Settings,
	cursor: null as Cursor,
	keybindings: null as Keybindings,
	globalInputListener: null as GlobalInputListener,
	volumeController: null as VolumeController,
	musicPlayer: null as MusicPlayer,
	toastManager: null as ToastManager,
	database: null as Database
};