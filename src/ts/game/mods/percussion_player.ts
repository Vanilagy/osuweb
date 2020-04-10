import { Play } from "../play";
import { TimingPoint } from "../../datamodel/beatmap";
import { MathUtil } from "../../util/math_util";
import { SkinSoundType } from "../skin/skin";

export class PercussionPlayer {
	private play: Play;
	private lastSoundTime: number;

	constructor(play: Play) {
		this.play = play;
	}

	reset() {
		this.lastSoundTime = -Infinity;
	}

	tick(currentTime: number) {
		let beatmap = this.play.processedBeatmap.beatmap;
		let skin = this.play.skin;
		let currentInheritableTimingPoint: TimingPoint = null;

		// Find the current inheritable timing point we're in
		for (let i = 0; i < beatmap.timingPoints.length; i++) {
			let timingPoint = beatmap.timingPoints[i];
			if (!timingPoint.inheritable) continue;
			if (currentTime >= timingPoint.offset) {
				currentInheritableTimingPoint = timingPoint;
				continue;
			}

			break;
		}

		if (!currentInheritableTimingPoint) return;

		let elapsedTime = currentTime - currentInheritableTimingPoint.offset;
		let barLength = currentInheritableTimingPoint.msPerBeat * currentInheritableTimingPoint.meter;
		if (!barLength) return;

		let timeBetweenSounds = currentInheritableTimingPoint.msPerBeat / beatmap.difficulty.TR;

		let currentBar = Math.floor(elapsedTime / barLength);
		let timeInCurrentBar = elapsedTime % barLength;
		let beatInCurrentBar = Math.floor(timeInCurrentBar / timeBetweenSounds) / beatmap.difficulty.TR;
		beatInCurrentBar = Number(beatInCurrentBar.toFixed(2)); // Make sure we round floaty stuff like 0.99999999994 to 1.0
		
		let soundTime = currentInheritableTimingPoint.offset + currentBar * barLength + MathUtil.floorToMultiple(timeInCurrentBar, timeBetweenSounds);
		if (soundTime > this.lastSoundTime) {
			this.lastSoundTime = soundTime;

			let soundType: SkinSoundType;
			if (beatInCurrentBar % 1 !== 0) {
				// Play hi-hat sounds inbetween beats
				soundType = SkinSoundType.NightcoreHat;
			} else {
				soundType = (beatInCurrentBar % 2 === 0)? SkinSoundType.NightcoreKick : SkinSoundType.NightcoreClap;
			}

			let sound = skin.sounds[soundType];
			sound.clone().start(0);

			// Every 4 bars, play a finish sound at the start of the bar
			if (currentBar % 4 === 0 && beatInCurrentBar === 0) {
				let finishSound = skin.sounds[SkinSoundType.NightcoreFinish];
				finishSound.clone().start(0);
			}
		}
	}
}