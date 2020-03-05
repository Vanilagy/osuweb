import { SongSelect } from "./menu/song_select/song_select";
import { GameplayController } from "./game/gameplay_controller";
import { MediaPlayer } from "./audio/media_player";
import { HighAccuracyMediaPlayer } from "./audio/high_accuracy_media_player";
import { BackgroundManager } from "./visuals/background";

export const globalState = {
	songSelect: null as SongSelect,
	gameplayController: null as GameplayController,
	basicMediaPlayer: null as MediaPlayer,
	gameplayMediaPlayer: null as HighAccuracyMediaPlayer,
	backgroundManager: null as BackgroundManager
};