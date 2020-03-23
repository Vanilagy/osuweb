import { BeatmapSet } from "../../datamodel/beatmap_set";
import { VirtualFile } from "../../file_system/virtual_file";
import { BeatmapDifficultyPanel } from "./beatmap_difficulty_panel";
import { EaseType, MathUtil } from "../../util/math_util";
import { currentWindowDimensions } from "../../visuals/ui";
import { BackgroundManager } from "../../visuals/background";
import { getDarkeningOverlay, getBeatmapSetPanelMask, TEXTURE_MARGIN, getBeatmapSetPanelGlowTexture } from "./beatmap_panel_components";
import { getNormalizedOffsetOnCarousel, BEATMAP_SET_PANEL_WIDTH, BEATMAP_DIFFICULTY_PANEL_HEIGHT, BEATMAP_DIFFICULTY_PANEL_MARGIN, BEATMAP_SET_PANEL_HEIGHT, BEATMAP_SET_PANEL_MARGIN, BeatmapCarouselSortingType, BeatmapCarousel } from "./beatmap_carousel";
import { InteractionRegistration, InteractionGroup } from "../../input/interactivity";
import { getBitmapFromImageFile, BitmapQuality } from "../../util/image_util";
import { fitSpriteIntoContainer } from "../../util/pixi_util";
import { JobUtil } from "../../multithreading/job_util";
import { Interpolator } from "../../util/interpolation";
import { globalState } from "../../global_state";

export class BeatmapSetPanel {
	public carousel: BeatmapCarousel;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;

	public beatmapSet: BeatmapSet;
	private beatmapFiles: VirtualFile[];

	private panelContainer: PIXI.Container;
	private mainMask: PIXI.Sprite;
	private darkening: PIXI.Sprite;
	private primaryText: PIXI.Text;
	private secondaryText: PIXI.Text;
	private glowSprite: PIXI.Sprite;

	private backgroundImageSprite: PIXI.Sprite;
	private backgroundImageBitmap: ImageBitmap = null;
	private imageLoadingStarted = false;
	private imageFadeIn: Interpolator;
	private imageColorFilter: PIXI.filters.ColorMatrixFilter;

	private difficultyContainer: PIXI.Container;
	private beatmapDifficultyPanels: BeatmapDifficultyPanel[] = [];
	
	public isExpanded: boolean = false;
	public currentNormalizedY: number = 0;
	public needsResize = true;
	private expandInterpolator: Interpolator;
	private hoverInterpolator: Interpolator;
	private mouseDownBrightnessInterpolator: Interpolator;

	constructor(carousel: BeatmapCarousel, beatmapSet: BeatmapSet) {
		this.carousel = carousel;
		this.beatmapSet = beatmapSet;
		this.container = new PIXI.Container();
		this.container.sortableChildren = true;
		this.interactionGroup = new InteractionGroup();
		this.carousel.interactionGroup.add(this.interactionGroup);

		this.difficultyContainer = new PIXI.Container();
		this.difficultyContainer.sortableChildren = true;
		this.difficultyContainer.zIndex = -2;
		this.container.addChild(this.difficultyContainer);
		this.beatmapFiles = this.beatmapSet.getBeatmapFiles();

		this.panelContainer = new PIXI.Container();
		this.container.addChild(this.panelContainer);

		this.backgroundImageSprite = new PIXI.Sprite();
		this.panelContainer.addChild(this.backgroundImageSprite);

		this.darkening = new PIXI.Sprite();
		this.darkening.y = -1;
		this.panelContainer.addChild(this.darkening);

		this.primaryText = new PIXI.Text('');
		this.secondaryText = new PIXI.Text('');
		this.panelContainer.addChild(this.primaryText, this.secondaryText);

		this.imageColorFilter = new PIXI.filters.ColorMatrixFilter();
		this.backgroundImageSprite.filters = [this.imageColorFilter];

		this.glowSprite = new PIXI.Sprite();
		this.glowSprite.zIndex = -1;
		this.container.addChild(this.glowSprite);

		this.mainMask = new PIXI.Sprite();
		this.panelContainer.addChildAt(this.mainMask, 0);
		this.panelContainer.mask = this.mainMask;

		this.expandInterpolator = new Interpolator({
			ease: EaseType.EaseOutCubic,
			duration: 500,
			reverseDuration: 500,
			reverseEase: EaseType.EaseInQuart,
			beginReversed: true,
			defaultToFinished: true
		});
		this.imageFadeIn = new Interpolator({
			duration: 250,
			ease: EaseType.EaseInOutSine
		});
		this.hoverInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			beginReversed: true,
			defaultToFinished: true
		});
		this.mouseDownBrightnessInterpolator = new Interpolator({
			duration: 50,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});
		
		this.initInteractions();
		this.draw();
	}

	private initInteractions() {
		let registration = new InteractionRegistration(this.panelContainer);
		this.interactionGroup.add(registration);

		registration.addButtonHandlers(
			() => this.expand(),
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.mouseDownBrightnessInterpolator.setReversedState(false, performance.now()),
			() => this.mouseDownBrightnessInterpolator.setReversedState(true, performance.now())
		);
	}

	private async loadImage() {
		let scalingFactor = this.carousel.scalingFactor;

		let imageFile = await this.beatmapSet.representingBeatmap.getBackgroundImageFile();
		if (imageFile) this.backgroundImageBitmap = await getBitmapFromImageFile(imageFile, BitmapQuality.Medium);

		if (this.backgroundImageBitmap) {
			let texture = PIXI.Texture.from(this.backgroundImageBitmap as any);
			this.backgroundImageSprite.texture = texture;
			fitSpriteIntoContainer(this.backgroundImageSprite, BEATMAP_SET_PANEL_WIDTH * scalingFactor, BEATMAP_SET_PANEL_HEIGHT * scalingFactor, new PIXI.Point(0.0, 0.25));

			this.imageFadeIn.start(performance.now());
		}
	}

	private draw() {
		let beatmap = this.beatmapSet.representingBeatmap;

		this.primaryText.text = beatmap.title + ' '; // Adding the extra space so that the canvas doesn't cut off the italics
		this.secondaryText.text = beatmap.artist + ' | ' + beatmap.creator + ' ';
	}

	private resize() {
		this.needsResize = false;

		let scalingFactor = this.carousel.scalingFactor;

		this.panelContainer.hitArea = new PIXI.Rectangle(0, 0, BEATMAP_SET_PANEL_WIDTH * scalingFactor, BEATMAP_SET_PANEL_HEIGHT * scalingFactor);

		this.mainMask.texture = getBeatmapSetPanelMask();
		this.mainMask.pivot.set(TEXTURE_MARGIN * scalingFactor, TEXTURE_MARGIN * scalingFactor);

		this.glowSprite.texture = getBeatmapSetPanelGlowTexture();
		this.glowSprite.pivot.copyFrom(this.mainMask.pivot);

		this.difficultyContainer.x = Math.floor(50 * scalingFactor);
		
		fitSpriteIntoContainer(this.backgroundImageSprite, BEATMAP_SET_PANEL_WIDTH * scalingFactor, BEATMAP_SET_PANEL_HEIGHT * scalingFactor, new PIXI.Point(0.0, 0.25));

		this.darkening.texture = getDarkeningOverlay();

		this.primaryText.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(22 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.secondaryText.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(14 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};

		this.primaryText.position.set(Math.floor(35 * scalingFactor), Math.floor(10 * scalingFactor));
		this.secondaryText.position.set(Math.floor(35 * scalingFactor), Math.floor(35 * scalingFactor));

		for (let i = 0; i < this.beatmapDifficultyPanels.length; i++) {
			this.beatmapDifficultyPanels[i].resize();
		}
	}

	update(now: number, newY: number, lastCalculatedHeight: number) {
		this.currentNormalizedY = newY;
		let scalingFactor = this.carousel.scalingFactor;

		if (!this.imageLoadingStarted) {
			// If the top of the panel is at most a full screen height away
			let isClose = this.currentNormalizedY * scalingFactor >= -currentWindowDimensions.height && this.currentNormalizedY * scalingFactor <= (currentWindowDimensions.height * 2);

			if (isClose) {
				this.imageLoadingStarted = true;
				this.loadImage();
			}
		}

		if (this.currentNormalizedY + lastCalculatedHeight < 0 || (this.currentNormalizedY - 10) * scalingFactor > currentWindowDimensions.height) { // Subtract 10 'cause of the glow
			// Culling!

			this.container.visible = false;
			this.interactionGroup.disable();
			return;
		} else {
			this.container.visible = true;
			this.interactionGroup.enable();
		}

		if (this.needsResize) this.resize();

		this.container.y = this.currentNormalizedY * scalingFactor;

		this.backgroundImageSprite.alpha = this.imageFadeIn.getCurrentValue(now);

		this.panelContainer.x = 0;

		let combinedPanelHeight = BEATMAP_DIFFICULTY_PANEL_HEIGHT + BEATMAP_DIFFICULTY_PANEL_MARGIN;
		let expansionValue = this.expandInterpolator.getCurrentValue(now);

		this.panelContainer.x -= 95 * expansionValue * scalingFactor;

		// Remove beatmap panel elements if there's no need to keep them
		if (!this.isExpanded && expansionValue === 0 && this.beatmapDifficultyPanels.length > 0) {
			this.beatmapDifficultyPanels.length = 0;
			this.difficultyContainer.removeChildren();
		}

		for (let i = 0; i < this.beatmapDifficultyPanels.length; i++) {
			let panel = this.beatmapDifficultyPanels[i];

			let y = BEATMAP_SET_PANEL_HEIGHT/2 + combinedPanelHeight * expansionValue + combinedPanelHeight * i * expansionValue;
			panel.update(now, y);

			if (!this.isExpanded) {
				panel.container.alpha = this.expandInterpolator.getCurrentValue(now);
			}
		}

		this.panelContainer.x += getNormalizedOffsetOnCarousel((this.currentNormalizedY + BEATMAP_SET_PANEL_HEIGHT/2) * scalingFactor)  * scalingFactor;

		let hoverValue = this.hoverInterpolator.getCurrentValue(now) * MathUtil.lerp(1, 0.2, this.expandInterpolator.getCurrentCompletion(now));
		this.panelContainer.x += hoverValue * -15 * scalingFactor;

		this.imageColorFilter.brightness(1 + this.mouseDownBrightnessInterpolator.getCurrentValue(now) * 0.2, false);

		this.container.x = Math.floor(this.container.x);
		this.container.y = Math.floor(this.container.y);

		if (expansionValue === 0) {
			this.glowSprite.visible = false;
		} else {
			this.glowSprite.visible = true;
			this.glowSprite.alpha = expansionValue;
			this.glowSprite.x = this.panelContainer.x;
		}
	}

	getTotalHeight(now: number) {
		let combinedSetPanelHeight = BEATMAP_SET_PANEL_HEIGHT + BEATMAP_SET_PANEL_MARGIN;
		return combinedSetPanelHeight + this.getAdditionalExpansionHeight(now);
	}

	getAdditionalExpansionHeight(now: number) {
		let combinedDifficultyPanelHeight = BEATMAP_DIFFICULTY_PANEL_HEIGHT + BEATMAP_DIFFICULTY_PANEL_MARGIN;
		return this.expandInterpolator.getCurrentValue(now) * combinedDifficultyPanelHeight * this.beatmapFiles.length;
	}

	private async expand() {
		if (this.isExpanded) return;
		this.isExpanded = true;

		this.beatmapDifficultyPanels.length = 0;
		this.difficultyContainer.removeChildren();

		let selectedPanel = this.carousel.selectedPanel;
		if (selectedPanel) {
			selectedPanel.collapse();
		}

		this.carousel.selectedPanel = this;
		this.carousel.setReferencePanel(this, this.currentNormalizedY);

		this.expandInterpolator.setReversedState(false, performance.now());

		let representingBeatmap = this.beatmapSet.representingBeatmap;
		this.carousel.songSelect.infoPanel.loadBeatmapSet(representingBeatmap);

		for (let i = 0; i < this.beatmapFiles.length; i++) {
			let difficultyPanel = new BeatmapDifficultyPanel(this);
			difficultyPanel.container.zIndex = -i;

			this.difficultyContainer.addChild(difficultyPanel.container);
			this.beatmapDifficultyPanels.push(difficultyPanel);
		}

		representingBeatmap.getBackgroundImageFile().then((backgroundImage) => {
			if (backgroundImage) globalState.backgroundManager.setImage(backgroundImage);
		});

		this.carousel.songSelect.startAudio(representingBeatmap);

		let data = await JobUtil.getBeatmapMetadataAndDifficultyFromFiles(this.beatmapFiles);
		let map: Map<typeof data[0], VirtualFile> = new Map();
		for (let i = 0; i < this.beatmapFiles.length; i++) {
			map.set(data[i], this.beatmapFiles[i]);
		}

		data.sort((a, b) => {
			if (a.status === 'fulfilled' && b.status === 'fulfilled') {
				return a.value.difficultyAttributes.starRating - b.value.difficultyAttributes.starRating;
			}
			return 0;
		});

		for (let i = 0; i < this.beatmapDifficultyPanels.length; i++) {
			let result = data[i];
			if (result.status === 'fulfilled') {
				this.beatmapDifficultyPanels[i].load(map.get(result), result.value);
			}
		}

		this.beatmapDifficultyPanels[0].select(false);
	}

	private collapse() {
		if (!this.isExpanded) return;

		let currentlySelectedSubpanel = this.carousel.selectedSubpanel;
		if (currentlySelectedSubpanel) {
			currentlySelectedSubpanel.deselect();
			this.carousel.selectedSubpanel = null;
		}

		this.expandInterpolator.setReversedState(true, performance.now());
		this.isExpanded = false;

		for (let i = 0; i < this.beatmapDifficultyPanels.length; i++) {
			this.beatmapDifficultyPanels[i].disable();
		}
	}
}