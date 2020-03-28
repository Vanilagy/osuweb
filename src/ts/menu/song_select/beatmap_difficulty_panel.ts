import { VirtualFile } from "../../file_system/virtual_file";
import { colorToHexNumber } from "../../util/graphics_util";
import { EaseType, MathUtil } from "../../util/math_util";
import { getBeatmapDifficultyPanelMask, TEXTURE_MARGIN, getBeatmapDifficultyPanelGlowTexture, getDifficultyColorBar } from "./beatmap_panel_components";
import { getNormalizedOffsetOnCarousel, BEATMAP_DIFFICULTY_PANEL_HEIGHT, BEATMAP_DIFFICULTY_PANEL_WIDTH, BEATMAP_DIFFICULTY_PANEL_SNAP_TARGET, BEATMAP_DIFFICULTY_PANEL_MARGIN } from "./beatmap_carousel";
import { InteractionRegistration } from "../../input/interactivity";
import { BeatmapSetPanel } from "./beatmap_set_panel";
import { DifficultyUtil } from "../../datamodel/difficulty/difficulty_util";
import { Interpolator } from "../../util/interpolation";
import { ExtendedBeatmapData } from "../../util/beatmap_util";

export class BeatmapDifficultyPanel {
	public container: PIXI.Container;
	public parentPanel: BeatmapSetPanel;
	private registration: InteractionRegistration;

	private beatmapFile?: VirtualFile = null;
	private extendedBeatmapData?: ExtendedBeatmapData;

	private infoContainer: PIXI.Container;
	private background: PIXI.Sprite;
	private mainMask: PIXI.Sprite;
	private primaryText: PIXI.Text;
	private starRatingTicks: PIXI.Graphics;
	private glowSprite: PIXI.Sprite;
	private colorBar: PIXI.Sprite;

	private enabled = true;
	private currentNormalizedY: number = 0;
	private fadeInInterpolator: Interpolator;
	private hoverInterpolator: Interpolator;
	private expandInterpolator: Interpolator;
	private pressDownInterpolator: Interpolator;

	constructor(parentPanel: BeatmapSetPanel) {
		this.parentPanel = parentPanel;
		this.container = new PIXI.Container();
		this.container.sortableChildren = true;

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

		this.mainMask = new PIXI.Sprite();
		this.container.addChild(this.mainMask);

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.5;
		this.background.mask = this.mainMask;
		this.container.addChild(this.background);

		this.infoContainer = new PIXI.Container();
		this.primaryText = new PIXI.Text('');
		this.primaryText.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontStyle: 'italic'
		};
		this.starRatingTicks = new PIXI.Graphics();
		
		this.infoContainer.addChild(this.primaryText);
		this.infoContainer.addChild(this.starRatingTicks);
		this.container.addChild(this.infoContainer);

		this.glowSprite = new PIXI.Sprite();
		this.glowSprite.zIndex = -1;
		this.container.addChild(this.glowSprite);

		this.colorBar = new PIXI.Sprite();
		this.colorBar.mask = this.mainMask;
		this.infoContainer.addChild(this.colorBar);

		this.initInteractions();

		this.resize();
	}

	private initInteractions() {
		this.registration = new InteractionRegistration(this.container);
		this.parentPanel.interactionGroup.add(this.registration);

		this.registration.addButtonHandlers(
			() => this.select(),
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.pressDownInterpolator.setReversedState(false, performance.now()),
			() => this.pressDownInterpolator.setReversedState(true, performance.now())
		);
	}

	private draw() {
		this.primaryText.text = this.extendedBeatmapData.version + ' ';
		this.drawStarRatingTicks();
		this.colorBar.tint = colorToHexNumber(DifficultyUtil.getColorForStarRating(this.extendedBeatmapData.difficultyAttributes.starRating));
		this.glowSprite.tint = this.colorBar.tint;
	}

	private drawStarRatingTicks() {
		if (!this.extendedBeatmapData) return;
	
		let difficultyAttributes = this.extendedBeatmapData.difficultyAttributes;
		let g = this.starRatingTicks;
		let scalingFactor = this.parentPanel.carousel.scalingFactor;
		
		g.clear();
		g.beginFill(0xffffff);

		function addStarRatingTick(percent: number, index: number) {
			let width = Math.floor(15 * percent * scalingFactor);
			if (width === 0) return;
			let x = Math.floor(20 * index * scalingFactor);

			g.drawPolygon([
				new PIXI.Point(x + 2, 0),
				new PIXI.Point(x + Math.floor(2 * scalingFactor) + width, 0),
				new PIXI.Point(x + width, Math.floor(3 * scalingFactor)),
				new PIXI.Point(x + 0, Math.floor(3 * scalingFactor))
			]);
		}

		let flooredSr = Math.floor(difficultyAttributes.starRating);
		for (let i = 0; i < flooredSr; i++) {
			addStarRatingTick(1.0, i);
		}
		if (difficultyAttributes.starRating !== flooredSr) {
			addStarRatingTick(difficultyAttributes.starRating - flooredSr, flooredSr);
		}

		g.endFill();		
	}

	resize() {
		let scalingFactor = this.parentPanel.carousel.scalingFactor;

		this.container.hitArea = new PIXI.Rectangle(0, 0, BEATMAP_DIFFICULTY_PANEL_WIDTH * scalingFactor, BEATMAP_DIFFICULTY_PANEL_HEIGHT * scalingFactor);

		this.background.width = BEATMAP_DIFFICULTY_PANEL_WIDTH * scalingFactor;
		this.background.height = BEATMAP_DIFFICULTY_PANEL_HEIGHT * scalingFactor;

		this.mainMask.texture = getBeatmapDifficultyPanelMask();
		this.mainMask.position.set(-TEXTURE_MARGIN * scalingFactor, -TEXTURE_MARGIN * scalingFactor);

		this.glowSprite.texture = getBeatmapDifficultyPanelGlowTexture();
		this.glowSprite.position.copyFrom(this.mainMask.position);

		this.primaryText.style.fontSize = Math.floor(16 * scalingFactor);
		this.primaryText.position.set(Math.floor(30 * scalingFactor), Math.floor(10 * scalingFactor));

		this.drawStarRatingTicks();
		this.starRatingTicks.y = Math.floor(35 * scalingFactor);
		this.starRatingTicks.x = Math.floor(30 * scalingFactor);

		this.colorBar.texture = getDifficultyColorBar();
	}

	load(beatmapFile: VirtualFile,  extendedData: ExtendedBeatmapData) {
		this.fadeInInterpolator.start(performance.now());
		this.beatmapFile = beatmapFile;
		this.extendedBeatmapData = extendedData;

		this.draw();

		if (this.parentPanel.carousel.selectedSubpanel === this) this.selectDifficulty();
	}

	update(now: number, newY: number) {
		let scalingFactor = this.parentPanel.carousel.scalingFactor;

		this.currentNormalizedY = newY;
		this.container.y = this.currentNormalizedY * scalingFactor;

		this.infoContainer.alpha = this.fadeInInterpolator.getCurrentValue(now);

		let normalizedY = this.container.getGlobalPosition().y / scalingFactor;
		this.container.x = getNormalizedOffsetOnCarousel((normalizedY + BEATMAP_DIFFICULTY_PANEL_HEIGHT/2) * scalingFactor) * scalingFactor;

		let expansionValue = this.expandInterpolator.getCurrentValue(now);
		this.container.x += expansionValue * -40 * scalingFactor;

		let hoverValue = this.hoverInterpolator.getCurrentValue(now) * MathUtil.lerp(1, 0.5, this.expandInterpolator.getCurrentCompletion(now));
		this.container.x += hoverValue * -7 * scalingFactor;

		this.container.x = Math.floor(this.container.x);
		this.container.y = Math.floor(this.container.y);

		let bonusAlpha = this.pressDownInterpolator.getCurrentValue(now) * 0.1;
		this.background.alpha = MathUtil.lerp(0.45, 0.8, expansionValue) + bonusAlpha;
		this.colorBar.alpha = 1 - expansionValue;

		if (expansionValue === 0) {
			this.glowSprite.visible = false;
		} else {
			this.glowSprite.visible = true;
			this.glowSprite.alpha = expansionValue;
		}
	}

	disable() {
		if (!this.enabled) return;

		this.enabled = false;
		this.registration.detach();
	}

	isSelected() {
		return this.parentPanel.carousel.selectedSubpanel === this;
	}

	async select(doSnap = true) {
		if (this.isSelected()) {
			this.trigger();
			return;
		}

		let currentlySelected = this.parentPanel.carousel.selectedSubpanel;
		if (currentlySelected) {
			currentlySelected.deselect();
		}
		this.parentPanel.carousel.selectedSubpanel = this;

		let now = performance.now();
		this.expandInterpolator.setReversedState(false, now);

		if (doSnap) {
			let totalNormalizedY = this.currentNormalizedY + this.parentPanel.currentNormalizedY;
			let diff = BEATMAP_DIFFICULTY_PANEL_SNAP_TARGET - totalNormalizedY;

			this.parentPanel.carousel.snapToReferencePanel(this.parentPanel.currentNormalizedY, this.parentPanel.currentNormalizedY + diff);
		}

		if (this.beatmapFile) this.selectDifficulty();
	}

	private selectDifficulty() {
		this.parentPanel.carousel.songSelect.selectBeatmapDifficulty(this.beatmapFile, this.parentPanel.beatmapSet, this.extendedBeatmapData);
	}
 
	private trigger() {
		this.parentPanel.carousel.songSelect.triggerSelectedBeatmap();
	}

	deselect() {
		let now = performance.now();
		this.expandInterpolator.setReversedState(true, now);
	}
}