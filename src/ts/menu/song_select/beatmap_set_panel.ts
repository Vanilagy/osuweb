import { BeatmapSet } from "../../datamodel/beatmap_set";
import { VirtualFile } from "../../file_system/virtual_file";
import { Interpolator } from "../../util/graphics_util";
import { BeatmapPanel } from "./beatmap_panel";
import { Beatmap } from "../../datamodel/beatmap";
import { EaseType } from "../../util/math_util";
import { getGlobalScalingFactor, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { BackgroundManager } from "../../visuals/background";
import { BeatmapUtils } from "../../datamodel/beatmap_utils";
import { getDarkeningOverlay, getBeatmapSetPanelMask, getBeatmapSetPanelMaskInverted, TEXTURE_MARGIN, getBeatmapSetPanelGlowTexture } from "./beatmap_panel_components";
import { setReferencePanel, getNormalizedOffsetOnCarousel, BEATMAP_SET_PANEL_WIDTH, BEATMAP_PANEL_HEIGHT, BEATMAP_PANEL_MARGIN, BEATMAP_SET_PANEL_HEIGHT, BEATMAP_SET_PANEL_MARGIN, getSelectedPanel, setSelectedPanel, carouselInteractionGroup, getSelectedSubpanel, setSelectedSubpanel } from "./beatmap_carousel";
import { InteractionRegistration, Interactivity } from "../../input/interactivity";
import { mainMusicMediaPlayer } from "../../audio/media_player";
import { audioContext } from "../../audio/audio";
import { beatmapInfoPanel } from "./beatmap_info_panel";
import { getBitmapFromImageFile, BitmapQuality } from "../../util/image_util";
import { fitSpriteIntoContainer } from "../../util/pixi_util";

export class BeatmapSetPanel {
	public beatmapSet: BeatmapSet;
	private beatmapFiles: VirtualFile[];
	public container: PIXI.Container;
	private panelContainer: PIXI.Container;
	public isExpanded: boolean = false;
	private difficultyContainer: PIXI.Container;
	private expandInterpolator: Interpolator;
	private beatmapPanels: BeatmapPanel[] = [];
	private representingBeatmap: Beatmap;
	private mainMask: PIXI.Sprite;
	private backgroundImageSprite: PIXI.Sprite;
	private backgroundImageBitmap: ImageBitmap = null;
	private darkening: PIXI.Sprite;
	private primaryText: PIXI.Text;
	private secondaryText: PIXI.Text;
	private imageLoadingStarted = false;
	private imageFadeIn: Interpolator;
	public currentNormalizedY: number = 0;
	private interaction: InteractionRegistration;
	private hoverInterpolator: Interpolator;
	private imageColorFilter: PIXI.filters.ColorMatrixFilter;
	private glowSprite: PIXI.Sprite;
	public needsResize = true;

	constructor(beatmapSet: BeatmapSet) {
		this.beatmapSet = beatmapSet;
		this.container = new PIXI.Container();
		this.container.sortableChildren = true;

		this.difficultyContainer = new PIXI.Container();
		this.difficultyContainer.sortableChildren = true;
		this.difficultyContainer.zIndex = -2;
		this.container.addChild(this.difficultyContainer);
		this.beatmapFiles = this.beatmapSet.getBeatmapFiles();

		this.panelContainer = new PIXI.Container();
		this.container.addChild(this.panelContainer);

		this.backgroundImageSprite = new PIXI.Sprite();
		//this.backgroundImageSprite.anchor.set(0.0, 0.25);
		this.panelContainer.addChild(this.backgroundImageSprite);

		this.darkening = new PIXI.Sprite(PIXI.Texture.from(getDarkeningOverlay()));
		this.darkening.y = -1;
		this.panelContainer.addChild(this.darkening);

		this.primaryText = new PIXI.Text('');
		this.secondaryText = new PIXI.Text('');
		this.panelContainer.addChild(this.primaryText, this.secondaryText);

		this.imageColorFilter = new PIXI.filters.ColorMatrixFilter();
		this.backgroundImageSprite.filters = [this.imageColorFilter];

		this.glowSprite = new PIXI.Sprite();
		this.glowSprite.zIndex = -1;
		this.glowSprite.blendMode = PIXI.BLEND_MODES.ADD;
		this.container.addChild(this.glowSprite);

		this.mainMask = new PIXI.Sprite();
		this.panelContainer.addChildAt(this.mainMask, 0);
		this.panelContainer.mask = this.mainMask;

		this.expandInterpolator = new Interpolator({
			ease: EaseType.EaseOutCubic,
			duration: 500,
			reverseDuration: 500,
			reverseEase: EaseType.EaseInQuart
		});
		this.imageFadeIn = new Interpolator({
			duration: 250,
			ease: EaseType.EaseInOutSine
		});
		this.hoverInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic
		});
		this.hoverInterpolator.reverse();
		
		this.initInteractions();

		this.load().then(() => {
			this.draw();
		});
	}

	private initInteractions() {
		this.interaction = Interactivity.registerDisplayObject(this.panelContainer, true);
		carouselInteractionGroup.add(this.interaction);

		this.interaction.addListener('mouseDown', () => {
			if (!this.isExpanded) this.expand();
		});

		this.interaction.addListener('mouseEnter', () => {
			this.hoverInterpolator.setReversedState(false);
		});

		this.interaction.addListener('mouseLeave', () => {
			this.hoverInterpolator.setReversedState(true);
		});
	}

	private async load() {
		let representingBeatmap = new Beatmap({
			text: await this.beatmapFiles[0].readAsText(),
			beatmapSet: this.beatmapSet,
			metadataOnly: true
		});
		this.representingBeatmap = representingBeatmap;
	}

	private async loadImage() {
		let scalingFactor = getGlobalScalingFactor();

		let imageFile = await this.representingBeatmap.getBackgroundImageFile();
		if (imageFile) this.backgroundImageBitmap = await getBitmapFromImageFile(imageFile, BitmapQuality.Medium);

		if (this.backgroundImageBitmap) {
			let texture = PIXI.Texture.from(this.backgroundImageBitmap as any);
			this.backgroundImageSprite.texture = texture;
			fitSpriteIntoContainer(this.backgroundImageSprite, BEATMAP_SET_PANEL_WIDTH * scalingFactor, BEATMAP_SET_PANEL_HEIGHT * scalingFactor, new PIXI.Point(0.0, 0.25));

			this.imageFadeIn.start();
		}
	}

	private draw() {
		this.primaryText.text = this.representingBeatmap.title + ' '; // Adding the extra space so that the canvas doesn't cut off the italics
		this.secondaryText.text = this.representingBeatmap.artist + ' | ' + this.representingBeatmap.creator + ' ';
	}

	private resize() {
		this.needsResize = false;

		let scalingFactor = getGlobalScalingFactor();

		this.panelContainer.hitArea = new PIXI.Rectangle(0, 0, BEATMAP_SET_PANEL_WIDTH * scalingFactor, BEATMAP_SET_PANEL_HEIGHT * scalingFactor);

		this.mainMask.texture = PIXI.Texture.from(getBeatmapSetPanelMask());
		this.mainMask.texture.update();
		this.mainMask.pivot.set(TEXTURE_MARGIN * scalingFactor, TEXTURE_MARGIN * scalingFactor);

		this.glowSprite.texture = getBeatmapSetPanelGlowTexture();
		this.glowSprite.pivot.copyFrom(this.mainMask.pivot);

		this.difficultyContainer.x = Math.floor(50 * scalingFactor);
		
		fitSpriteIntoContainer(this.backgroundImageSprite, BEATMAP_SET_PANEL_WIDTH * scalingFactor, BEATMAP_SET_PANEL_HEIGHT * scalingFactor, new PIXI.Point(0.0, 0.25));

		this.darkening.texture.update();

		this.primaryText.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(22 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.secondaryText.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(14 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};

		this.primaryText.position.set(Math.floor(35 * scalingFactor), Math.floor(10 * scalingFactor));
		this.secondaryText.position.set(Math.floor(35 * scalingFactor), Math.floor(35 * scalingFactor));

		for (let i = 0; i < this.beatmapPanels.length; i++) {
			this.beatmapPanels[i].resize();
		}
	}

	update(newY: number, lastCalculatedHeight: number) {
		this.currentNormalizedY = newY;

		if (!this.imageLoadingStarted) {
			// If the top of the panel is at most a full screen height away
			let isClose = this.currentNormalizedY >= -REFERENCE_SCREEN_HEIGHT && this.currentNormalizedY <= (REFERENCE_SCREEN_HEIGHT * 2);

			if (isClose && this.representingBeatmap) {
				this.imageLoadingStarted = true;
				this.loadImage();
			}
		}

		if (this.currentNormalizedY + lastCalculatedHeight < 0 || this.currentNormalizedY > REFERENCE_SCREEN_HEIGHT) {
			// Culling!

			this.container.visible = false;
			this.interaction.disable();
			return;
		} else {
			this.container.visible = true;
			this.interaction.enable();
		}

		if (this.needsResize) this.resize();

		let scalingFactor = getGlobalScalingFactor();
		this.container.y = this.currentNormalizedY * scalingFactor;

		this.backgroundImageSprite.alpha = this.imageFadeIn.getCurrentValue();

		this.panelContainer.x = 0;

		let combinedPanelHeight = BEATMAP_PANEL_HEIGHT + BEATMAP_PANEL_MARGIN;
		let expansionValue = this.expandInterpolator.getCurrentValue();

		this.panelContainer.x -= 99 * expansionValue * scalingFactor;

		// Remove beatmap panel elements if there's no need to keep them
		if (!this.isExpanded && expansionValue === 0 && this.beatmapPanels.length > 0) {
			this.beatmapPanels.length = 0;
			this.difficultyContainer.removeChildren();
		}

		for (let i = 0; i < this.beatmapPanels.length; i++) {
			let panel = this.beatmapPanels[i];

			let y = BEATMAP_SET_PANEL_HEIGHT/2 + combinedPanelHeight * expansionValue + combinedPanelHeight * i * expansionValue;
			panel.update(y);

			if (!this.isExpanded) {
				panel.container.alpha = this.expandInterpolator.getCurrentValue();
			}
		}

		this.panelContainer.x += getNormalizedOffsetOnCarousel(this.currentNormalizedY + BEATMAP_SET_PANEL_HEIGHT/2) * scalingFactor;

		let hoverValue = this.hoverInterpolator.getCurrentValue() * (1 - this.expandInterpolator.getCurrentCompletion());
		this.panelContainer.x += hoverValue * -15 * scalingFactor;
		this.imageColorFilter.brightness(1 + hoverValue * 0.2, false);

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

	getTotalHeight() {
		let combinedSetPanelHeight = BEATMAP_SET_PANEL_HEIGHT + BEATMAP_SET_PANEL_MARGIN;
		let combinedPanelHeight = BEATMAP_PANEL_HEIGHT + BEATMAP_PANEL_MARGIN;

		return combinedSetPanelHeight + this.expandInterpolator.getCurrentValue() * combinedPanelHeight * this.beatmapFiles.length;
	}

	private async expand() {
		if (this.isExpanded) return;
		this.isExpanded = true;

		this.beatmapPanels.length = 0;
		this.difficultyContainer.removeChildren();

		let selectedPanel = getSelectedPanel();
		if (selectedPanel) {
			selectedPanel.collapse();
		}

		setSelectedPanel(this);
		setReferencePanel(this, this.currentNormalizedY);

		this.expandInterpolator.setReversedState(false);
		this.expandInterpolator.start();

		beatmapInfoPanel.loadBeatmapSet(this.representingBeatmap);

		for (let i = 0; i < this.beatmapFiles.length; i++) {
			let beatmapPanel = new BeatmapPanel(this);
			beatmapPanel.container.zIndex = -i;

			this.difficultyContainer.addChild(beatmapPanel.container);
			this.beatmapPanels.push(beatmapPanel);
		}

		let backgroundImage = await this.representingBeatmap.getBackgroundImageFile();
		if (backgroundImage) BackgroundManager.setImage(backgroundImage);

		let audioFile = await this.representingBeatmap.getAudioFile();
		if (audioFile) {
			await mainMusicMediaPlayer.loadFromVirtualFile(audioFile);

			let startTime = this.representingBeatmap.getAudioPreviewTimeInSeconds();
			mainMusicMediaPlayer.start(startTime)
			mainMusicMediaPlayer.setLoopBehavior(true, startTime);
		}

		let data = await BeatmapUtils.getBeatmapMetadataAndDifficultyFromFiles(this.beatmapFiles);
		let map: Map<typeof data[0], VirtualFile> = new Map();
		for (let i = 0; i < this.beatmapFiles.length; i++) {
			map.set(data[i], this.beatmapFiles[i]);
		}

		data.sort((a, b) => {
			if (a.status === 'fulfilled' && b.status === 'fulfilled') {
				return a.value.difficulty.starRating - b.value.difficulty.starRating;
			}
			return 0;
		});

		for (let i = 0; i < this.beatmapPanels.length; i++) {
			let result = data[i];
			if (result.status === 'fulfilled') {
				this.beatmapPanels[i].load(result.value.metadata, result.value.difficulty, map.get(result));
			}
		}

		this.beatmapPanels[0].select(false);
	}

	private collapse() {
		if (!this.isExpanded) return;

		let currentlySelectedSubpanel = getSelectedSubpanel();
		if (currentlySelectedSubpanel) {
			currentlySelectedSubpanel.deselect();
			setSelectedSubpanel(null);
		}

		this.expandInterpolator.setReversedState(true);
		this.isExpanded = false;

		for (let i = 0; i < this.beatmapPanels.length; i++) {
			this.beatmapPanels[i].disable();
		}
	}
}