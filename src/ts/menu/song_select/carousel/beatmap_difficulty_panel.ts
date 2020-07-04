import { EaseType } from "../../../util/math_util";
import { BEATMAP_DIFFICULTY_PANEL_SNAP_TARGET } from "./beatmap_carousel";
import { Interpolator } from "../../../util/interpolation";
import { BeatmapSetPanel } from "./beatmap_set_panel";
import { BeatmapEntry } from "../../../datamodel/beatmap/beatmap_entry";

export const BEATMAP_DIFFICULTY_PANEL_WIDTH = 650;
export const BEATMAP_DIFFICULTY_PANEL_HEIGHT = 50;
export const BEATMAP_DIFFICULTY_PANEL_MARGIN = 10;

export class BeatmapDifficultyPanel {
	public parentPanel: BeatmapSetPanel;
	public entry: BeatmapEntry;

	public y: number = 0;
	public fadeInInterpolator: Interpolator;
	public hoverInterpolator: Interpolator;
	public expandInterpolator: Interpolator;
	public pressDownInterpolator: Interpolator;

	constructor(parentPanel: BeatmapSetPanel) {
		this.parentPanel = parentPanel;

		this.fadeInInterpolator = new Interpolator({
			duration: 250,
			ease: EaseType.EaseInOutSine
		});
		this.hoverInterpolator = new Interpolator({
			duration: 333,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			beginReversed: true,
			defaultToFinished: true
		});
		this.expandInterpolator = new Interpolator({
			ease: EaseType.EaseOutElastic,
			duration: 500,
			p: 0.9,
			reverseDuration: 500,
			reverseEase: EaseType.EaseInQuart,
			beginReversed: true,
			defaultToFinished: true
		});
		this.pressDownInterpolator = new Interpolator({
			duration: 50,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});
	}

	load(entry: BeatmapEntry) {
		if (entry === this.entry) return;

		this.fadeInInterpolator.start(performance.now());
		this.entry = entry;

		// If this difficulty panel is currently selected, select the corresponding difficulty.
		if (this.parentPanel.carousel.selectedDifficultyPanel === this) this.selectDifficulty();
	}

	update(now: number) {
		// Who knows what this might need to do someday.
	}

	isSelected() {
		return this.parentPanel.carousel.selectedDifficultyPanel === this;
	}

	async select(doSnap = true, selectionTime?: number) {
		if (this.isSelected()) {
			// Selecting it a second time means "Start the play"
			this.trigger();
			return;
		}

		this.parentPanel.carousel.setDifficultyPanel(this, true);

		let now = performance.now();
		this.expandInterpolator.setReversedState(false, selectionTime ?? now);

		if (doSnap) {
			let totalNormalizedY = this.y + this.parentPanel.storedY;
			this.parentPanel.carousel.snapReferencePanelPosition(totalNormalizedY, BEATMAP_DIFFICULTY_PANEL_SNAP_TARGET);
		}

		if (this.entry) this.selectDifficulty();
	}

	private async selectDifficulty() {
		this.parentPanel.carousel.songSelect.selectBeatmapEntry(this.entry);
	}
 
	private trigger() {
		if (!this.entry) return;
		this.parentPanel.carousel.songSelect.triggerSelectedBeatmap();
	}

	deselect() {
		let now = performance.now();
		this.expandInterpolator.setReversedState(true, now);
	}
}