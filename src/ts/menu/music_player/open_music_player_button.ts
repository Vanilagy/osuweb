import { ToolbarButton } from "../toolbar/toolbar_button";
import { Toolbar } from "../toolbar/toolbar";
import { svgToTexture } from "../../util/pixi_util";
import { MusicPlayer } from "./music_player";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";

const noteTexture = svgToTexture(document.querySelector('#svg-music-note'), true);

export class OpenMusicPlayerButton extends ToolbarButton {
	public musicPlayer: MusicPlayer;
	private dropdownInterpolator: Interpolator;

	constructor(parent: Toolbar) {
		super(parent, noteTexture);

		this.musicPlayer = new MusicPlayer(this);
		this.container.addChild(this.musicPlayer.container);
		this.interactionGroup.add(this.musicPlayer.interactionGroup);

		this.dropdownInterpolator = new Interpolator({
			duration: 500,
			reverseDuration: 250,
			ease: EaseType.EaseOutElasticHalf,
			reverseEase: EaseType.EaseInQuint,
			beginReversed: true,
			defaultToFinished: true
		});
	}

	onClick() {
		this.dropdownInterpolator.reverse(performance.now());
	}

	resize() {
		super.resize();

		this.musicPlayer.resize();
		this.musicPlayer.container.x = -this.musicPlayer.background.width + this.entryContainer.width;
	}

	update(now: number) {
		super.update(now);

		let dropdownCompletion = this.dropdownInterpolator.getCurrentValue(now);
		
		this.musicPlayer.update(now, dropdownCompletion === 0);
		this.musicPlayer.container.y = (this.parent.currentHeight) * MathUtil.lerp(0.8, 1.0, dropdownCompletion);
		this.musicPlayer.container.alpha = MathUtil.clamp(dropdownCompletion, 0, 1);
		this.musicPlayer.container.scale.y = MathUtil.lerp(0.75, 1.0, dropdownCompletion);

		if (dropdownCompletion >= 0.75) {
			this.musicPlayer.interactionGroup.enable();
		} else {
			this.musicPlayer.interactionGroup.disable();
		}
	}
}