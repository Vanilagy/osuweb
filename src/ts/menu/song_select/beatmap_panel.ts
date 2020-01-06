import { BeatmapSet } from "../../datamodel/beatmap_set";
import { VirtualFile } from "../../file_system/virtual_file";
import { Interpolator } from "../../util/graphics_util";
import { NonTrivialBeatmapMetadata, Beatmap } from "../../datamodel/beatmap";
import { DifficultyAttributes } from "../../datamodel/difficulty/difficulty_calculator";
import { EaseType, MathUtil } from "../../util/math_util";
import { getGlobalScalingFactor, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { startPlayFromBeatmap } from "../../game/play";
import { getBeatmapPanelMask, TEXTURE_MARGIN, getBeatmapPanelMaskInverted, getBeatmapPanelGlowTexture } from "./beatmap_panel_components";
import { getNormalizedOffsetOnCarousel, BEATMAP_PANEL_HEIGHT, beatmapCarouselContainer, carouselInteractionGroup, BEATMAP_PANEL_WIDTH, snapReferencePanel, getSelectedSubpanel, setSelectedSubpanel, BEATMAP_PANEL_SNAP_TARGET } from "./beatmap_carousel";
import { Interactivity, InteractionRegistration } from "../../input/interactivity";
import { renderer } from "../../visuals/rendering";
import { BeatmapSetPanel } from "./beatmap_set_panel";

export class BeatmapPanel {
	public container: PIXI.Container;
	public parentPanel: BeatmapSetPanel;
	private beatmapFile?: VirtualFile = null;
	private fadeInInterpolator: Interpolator;
	private infoContainer: PIXI.Container;
	private background: PIXI.Sprite;
	private mainMask: PIXI.Sprite;
	private primaryText: PIXI.Text;
	private metadata: NonTrivialBeatmapMetadata;
	private difficulty: DifficultyAttributes;
	private starRatingTicks: PIXI.Graphics;
	private currentNormalizedY: number = 0;
	private enabled = true;
	private interaction: InteractionRegistration;
	private hoverInterpolator: Interpolator;
	private expandInterpolator: Interpolator;
	private glowSprite: PIXI.Sprite;

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
			reverseEase: EaseType.EaseInCubic
		});
		this.hoverInterpolator.reverse();
		this.expandInterpolator = new Interpolator({
			ease: EaseType.EaseOutElastic,
			duration: 500,
			p: 0.9,
			reverseDuration: 500,
			reverseEase: EaseType.EaseInQuart
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
		this.starRatingTicks = new PIXI.Graphics();
		
		this.infoContainer.addChild(this.primaryText);
		this.infoContainer.addChild(this.starRatingTicks);
		this.container.addChild(this.infoContainer);

		this.glowSprite = new PIXI.Sprite();
		this.glowSprite.zIndex = -1;
		this.glowSprite.blendMode = PIXI.BLEND_MODES.ADD;
		this.container.addChild(this.glowSprite);

		this.initInteractions();

		this.resize();
	}

	initInteractions() {
		this.interaction = Interactivity.registerDisplayObject(this.container);
		carouselInteractionGroup.add(this.interaction);

		this.interaction.addListener('mouseDown', () => this.select());

		this.interaction.addListener('mouseEnter', () => {
			this.hoverInterpolator.setReversedState(false);
		});

		this.interaction.addListener('mouseLeave', () => {
			this.hoverInterpolator.setReversedState(true);
		});
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

		this.container.hitArea = new PIXI.Rectangle(0, 0, BEATMAP_PANEL_WIDTH * scalingFactor, BEATMAP_PANEL_HEIGHT * scalingFactor);

		this.background.width = BEATMAP_PANEL_WIDTH * scalingFactor;
		this.background.height = BEATMAP_PANEL_HEIGHT * scalingFactor;

		this.mainMask.texture = PIXI.Texture.from(getBeatmapPanelMask());
		this.mainMask.texture.update();
		this.mainMask.position.set(-TEXTURE_MARGIN * scalingFactor, -TEXTURE_MARGIN * scalingFactor);

		this.glowSprite.texture = getBeatmapPanelGlowTexture();
		this.glowSprite.position.copyFrom(this.mainMask.position);

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
		this.container.x = getNormalizedOffsetOnCarousel(normalizedY + BEATMAP_PANEL_HEIGHT/2) * scalingFactor;

		let expansionValue = this.expandInterpolator.getCurrentValue();
		this.container.x += expansionValue * -40 * scalingFactor;

		let hoverValue = this.hoverInterpolator.getCurrentValue() * (1 - this.expandInterpolator.getCurrentCompletion());
		this.container.x += hoverValue * -7 * scalingFactor;

		this.container.x = Math.floor(this.container.x);
		this.container.y = Math.floor(this.container.y);

		this.background.alpha = MathUtil.lerp(0.45, 0.8, expansionValue);

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
		this.interaction.destroy();
	}

	isSelected() {
		return getSelectedSubpanel() === this;
	}

	select() {
		if (this.isSelected()) {
			this.trigger();
			return;
		}

		let currentlySelected = getSelectedSubpanel();
		if (currentlySelected) {
			currentlySelected.deselect();
		}
		setSelectedSubpanel(this);

		this.expandInterpolator.setReversedState(false);
		this.expandInterpolator.start();

		let totalNormalizedY = this.currentNormalizedY + this.parentPanel.currentNormalizedY;
		let diff = BEATMAP_PANEL_SNAP_TARGET - totalNormalizedY;
		snapReferencePanel(this.parentPanel.currentNormalizedY, this.parentPanel.currentNormalizedY + diff);
	}

	trigger() {
		if (!this.beatmapFile) return;

		beatmapCarouselContainer.visible = false;
		carouselInteractionGroup.disable();

		this.beatmapFile.readAsText().then((text) => {
			let map = new Beatmap({
				text: text,
				beatmapSet: this.parentPanel.beatmapSet,
				metadataOnly: false
			});

			startPlayFromBeatmap(map);
		});
	}

	deselect() {
		this.expandInterpolator.setReversedState(true);
		this.expandInterpolator.start();
	}
}
