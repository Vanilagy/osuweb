import { SongSelect } from "./menu/song_select/song_select";
import { GameplayController } from "./game/gameplay_controller";
import { HighAccuracyAudioPlayer } from "./audio/high_accuracy_audio_player";
import { BackgroundManager } from "./visuals/background";
import { Skin } from "./game/skin/skin";
import { ScoreScreen } from "./menu/score/score_screen";
import { AudioMediaPlayer } from "./audio/audio_media_player";

export const globalState = {
	songSelect: null as SongSelect,
	gameplayController: null as GameplayController,
	basicSongPlayer: null as AudioMediaPlayer,
	gameplayAudioPlayer: null as HighAccuracyAudioPlayer,
	backgroundManager: null as BackgroundManager,
	baseSkin: null as Skin,
	scoreScreen: null as ScoreScreen
};