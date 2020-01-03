import { BeatmapSet } from "../../datamodel/beatmap_set";
import { VirtualFile } from "../../file_system/virtual_file";
import { Interpolator } from "../../util/graphics_util";
import { NonTrivialBeatmapMetadata, Beatmap } from "../../datamodel/beatmap";
import { DifficultyAttributes } from "../../datamodel/difficulty/difficulty_calculator";
import { EaseType } from "../../util/math_util";
import { getGlobalScalingFactor, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { startPlayFromBeatmap } from "../../game/play";
import { getBeatmapPanelMask } from "./beatmap_panel_components";
import { getNormalizedOffsetOnCarousel, BEATMAP_PANEL_HEIGHT, beatmapCarouselContainer } from "./beatmap_carousel";

export class BeatmapPanel {
	public container: PIXI.Container;
	private beatmapSet: BeatmapSet;
	private beatmapFile?: VirtualFile = null;
	private fadeInInterpolator: Interpolator;
	private infoContainer: PIXI.Container;
	private mainMask: PIXI.Graphics;
	private primaryText: PIXI.Text;
	private metadata: NonTrivialBeatmapMetadata;
	private difficulty: DifficultyAttributes;
	private starRatingTicks: PIXI.Graphics;
	private currentNormalizedY: number = 0;

	constructor(beatmapSet: BeatmapSet) {
		this.beatmapSet = beatmapSet;
		this.container = new PIXI.Container();
		this.fadeInInterpolator = new Interpolator({
			from: 0,
			to: 1,
			duration: 250,
			ease: EaseType.EaseInOutSine,
			defaultToFinished: false
		});

		this.infoContainer = new PIXI.Container();
		this.primaryText = new PIXI.Text('');
		this.starRatingTicks = new PIXI.Graphics();
		
		this.infoContainer.addChild(this.primaryText);
		this.infoContainer.addChild(this.starRatingTicks);
		this.container.addChild(this.infoContainer);

		this.resize();
	}

	draw() {
		this.primaryText.text = this.metadata.version + ' ';
		this.drawStarRatingTicks();
	}

	private drawStarRatingTicks() {
		if (!this.difficulty) return;
	
		let g = this.starRatingTicks;
		let scalingFactor = getGlobalScalingFactor();
		
		g.clear();
		g.beginFill(0xffffff);

		function addStarRatingTick(percent: number, index: number) {
			let width = Math.floor(15 * percent * scalingFactor) || 1;
			let x = Math.floor(20 * index * scalingFactor);

			g.drawPolygon([
				new PIXI.Point(x + 2, 0),
				new PIXI.Point(x + Math.floor(2 * scalingFactor) + width, 0),
				new PIXI.Point(x + width, Math.floor(3 * scalingFactor)),
				new PIXI.Point(x + 0, Math.floor(3 * scalingFactor))
			]);
		}

		let flooredSr = Math.floor(this.difficulty.starRating);
		for (let i = 0; i < flooredSr; i++) {
			addStarRatingTick(1.0, i);
		}
		if (this.difficulty.starRating !== flooredSr) {
			addStarRatingTick(this.difficulty.starRating - flooredSr, flooredSr);
		}

		g.endFill();		
	}

	resize() {
		let scalingFactor = getGlobalScalingFactor();

		if (this.mainMask) {
			this.mainMask.destroy();
			this.container.removeChild(this.mainMask);
		}
		this.mainMask = getBeatmapPanelMask().clone();
		this.container.addChildAt(this.mainMask, 0);

		this.primaryText.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(16 * scalingFactor)
		};

		this.primaryText.position.set(Math.floor(30 * scalingFactor), Math.floor(10 * scalingFactor));

		this.drawStarRatingTicks();
		this.starRatingTicks.y = Math.floor(35 * scalingFactor);
		this.starRatingTicks.x = Math.floor(30 * scalingFactor);
	}

	load(metadata: NonTrivialBeatmapMetadata, difficulty: DifficultyAttributes, beatmapFile: VirtualFile) {
		this.fadeInInterpolator.start();
		this.beatmapFile = beatmapFile;
		this.metadata = metadata;
		this.difficulty = difficulty;

		this.draw();
	}

	update(newY?: number) {
		let scalingFactor = getGlobalScalingFactor();

		if (newY !== undefined) this.currentNormalizedY = newY;
		this.container.y = this.currentNormalizedY * scalingFactor;

		this.infoContainer.alpha = this.fadeInInterpolator.getCurrentValue();

		let normalizedY = this.container.getGlobalPosition().y / scalingFactor;
		this.container.x = getNormalizedOffsetOnCarousel(normalizedY + BEATMAP_PANEL_HEIGHT/2);
	}

	click(x: number, y: number) {
		if (!this.beatmapFile) return false;

		let bounds = this.container.getBounds();
		if (x >= bounds.x && y >= bounds.y && y <= bounds.y + bounds.height) {
			beatmapCarouselContainer.visible = false;

			this.beatmapFile.readAsText().then((text) => {
				let map = new Beatmap({
					text: text,
					beatmapSet: this.beatmapSet,
					metadataOnly: false
				});

				startPlayFromBeatmap(map);
			});

			return true;
		}

		return false;
	}
}
