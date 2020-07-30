import { SongSelect } from "./menu/song_select/song_select";
import { GameplayController } from "./game/gameplay_controller";
import { HighAccuracyAudioPlayer } from "./audio/high_accuracy_audio_player";
import { BackgroundManager } from "./visuals/background";
import { Skin } from "./game/skin/skin";
import { ScoreScreen } from "./menu/score/score_screen";
import { AudioMediaPlayer } from "./audio/audio_media_player";
import { Toolbar } from "./menu/toolbar/toolbar";
import { BeatmapLibrary } from "./datamodel/beatmap/beatmap_library";
import { FolderSelector } from "./menu/import/folder_selector";
import { NotificationPanel } from "./menu/notifications/notification_panel";
import { TaskManager } from "./multithreading/task_manager";
import { SettingsPanel } from "./menu/settings/settings_panel";
import { FpsMeter } from "./menu/misc/fps_meter";
import { Settings } from "./menu/settings/settings";

export const globalState = {
	beatmapLibrary: null as BeatmapLibrary,
	toolbar: null as Toolbar,
	notificationPanel: null as NotificationPanel,
	songSelect: null as SongSelect,
	gameplayController: null as GameplayController,
	basicSongPlayer: null as AudioMediaPlayer,
	gameplayAudioPlayer: null as HighAccuracyAudioPlayer,
	backgroundManager: null as BackgroundManager,
	baseSkin: null as Skin,
	scoreScreen: null as ScoreScreen,
	folderSelector: null as FolderSelector,
	taskManager: null as TaskManager,
	settingsPanel: null as SettingsPanel,
	fpsMeter: null as FpsMeter,
	settings: null as Settings
};