import { BeatmapSet } from "../../datamodel/beatmap_set";
import { VirtualFile } from "../../file_system/virtual_file";
import { Interpolator } from "../../util/graphics_util";
import { BeatmapPanel } from "./beatmap_panel";
import { Beatmap } from "../../datamodel/beatmap";
import { EaseType } from "../../util/math_util";
import { getGlobalScalingFactor } from "../../visuals/ui";
import { BackgroundManager } from "../../visuals/background";
import { BeatmapUtils } from "../../datamodel/beatmap_utils";
import { getDarkeningOverlay, getBeatmapSetPanelMask } from "./beatmap_panel_components";
import { BEATMAP_SET_PANEL_WIDTH, BEATMAP_SET_PANEL_HEIGHT, BEATMAP_SET_PANEL_MARGIN, BEATMAP_PANEL_HEIGHT, BEATMAP_PANEL_MARGIN, getSelectedPanel, setSelectedPanel } from "./song_select_data";

export class BeatmapSetPanel {
	private beatmapSet: BeatmapSet;
	private beatmapFiles: VirtualFile[];
	public container: PIXI.Container;
	private panelContainer: PIXI.Container;
	public isExpanded: boolean = false;
	private difficultyContainer: PIXI.Container;
	private expandInterpolator: Interpolator;
	private beatmapPanels: BeatmapPanel[] = [];
	private representingBeatmap: Beatmap;
	private mainMask: PIXI.Graphics;
	private backgroundImageSprite: PIXI.Sprite;
	private backgroundImageBitmap: ImageBitmap = null;
	private darkening: PIXI.Sprite;
	private primaryText: PIXI.Text;
	private secondaryText: PIXI.Text;
	private imageLoadingStarted = false;
	private imageFadeIn: Interpolator;

	constructor(beatmapSet: BeatmapSet) {
		this.beatmapSet = beatmapSet;
		this.container = new PIXI.Container();

		this.difficultyContainer = new PIXI.Container();
		this.difficultyContainer.sortableChildren = true;
		this.container.addChild(this.difficultyContainer);
		this.beatmapFiles = this.beatmapSet.getBeatmapFiles();

		this.panelContainer = new PIXI.Container();
		this.container.addChild(this.panelContainer);

		this.backgroundImageSprite = new PIXI.Sprite();
		this.backgroundImageSprite.anchor.set(0.0, 0.25);
		this.panelContainer.addChild(this.backgroundImageSprite);

		this.darkening = new PIXI.Sprite(PIXI.Texture.from(getDarkeningOverlay()));
		this.panelContainer.addChild(this.darkening);

		this.primaryText = new PIXI.Text('');
		this.secondaryText = new PIXI.Text('');
		this.panelContainer.addChild(this.primaryText, this.secondaryText);

		this.expandInterpolator = new Interpolator({
			ease: EaseType.EaseOutCubic,
			duration: 500,
			from: 0,
			to: 1,
			defaultToFinished: false
		});
		this.imageFadeIn = new Interpolator({
			from: 0,
			to: 1,
			duration: 255,
			ease: EaseType.EaseInOutSine,
			defaultToFinished: false
		});

		this.resize();
		this.load().then(() => {
			this.draw();
		});
	}

	async load() {
		let representingBeatmap = new Beatmap({
			text: await this.beatmapFiles[0].readAsText(),
			beatmapSet: this.beatmapSet,
			metadataOnly: true
		});
		this.representingBeatmap = representingBeatmap;
	}

	async loadImage() {
		let scalingFactor = getGlobalScalingFactor();

		let imageFile = await this.representingBeatmap.getBackgroundImageFile();
		if (imageFile) {
			let img = new Image();
			img.src = await imageFile.readAsResourceUrl();

			await new Promise((resolve) => img.onload = resolve);

			this.backgroundImageBitmap = await (createImageBitmap as any)(await imageFile.getBlob(), {
				resizeWidth: 1024,
				resizeHeight: 1024 * img.height/img.width
			});
		}

		if (this.backgroundImageBitmap) {
			let texture = PIXI.Texture.from(this.backgroundImageBitmap as any);
			this.backgroundImageSprite.texture = texture;
			this.backgroundImageSprite.width = BEATMAP_SET_PANEL_WIDTH * scalingFactor;
			this.backgroundImageSprite.height = this.backgroundImageSprite.width * texture.height/texture.width;

			this.imageFadeIn.start();
		}
	}

	draw() {
		this.primaryText.text = this.representingBeatmap.title + ' '; // Adding the extra space so that the canvas doesn't cut off the italics
		this.secondaryText.text = this.representingBeatmap.artist + ' | ' + this.representingBeatmap.creator + ' ';
	}

	resize() {
		let scalingFactor = getGlobalScalingFactor();

		if (this.mainMask) {
			this.mainMask.destroy();
			this.panelContainer.removeChild(this.mainMask);
		}
		this.mainMask = getBeatmapSetPanelMask().clone();
		this.panelContainer.addChildAt(this.mainMask, 0);
		this.panelContainer.mask = this.mainMask;

		this.difficultyContainer.x = Math.floor(50 * scalingFactor);
		
		let texture = this.backgroundImageSprite.texture;
		this.backgroundImageSprite.width = BEATMAP_SET_PANEL_WIDTH * scalingFactor;
		this.backgroundImageSprite.height = this.backgroundImageSprite.width * texture.height/texture.width;

		this.darkening.texture.update();

		this.primaryText.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(22 * scalingFactor)
		};
		this.secondaryText.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(14 * scalingFactor)
		};

		this.primaryText.position.set(Math.floor(35 * scalingFactor), Math.floor(10 * scalingFactor));
		this.secondaryText.position.set(Math.floor(35 * scalingFactor), Math.floor(35 * scalingFactor));

		for (let i = 0; i < this.beatmapPanels.length; i++) {
			this.beatmapPanels[i].resize();
		}
	}

	click(x: number, y: number): boolean {
		if (!this.isExpanded) {
			let bounds = this.container.getBounds();

			if (x >= bounds.x && y >= bounds.y && y <= bounds.y + bounds.height) {
				this.expand();
				return true;
			}
		} else {
			for (let i = 0; i < this.beatmapPanels.length; i++) {
				if (this.beatmapPanels[i].click(x, y)) return true;
			}
		}

		return false;
	}

	update() {
		let scalingFactor = getGlobalScalingFactor();

		if (!this.imageLoadingStarted) {
			let isInView = (this.container.y + BEATMAP_SET_PANEL_HEIGHT * scalingFactor) >= 0 && this.container.y <= window.innerHeight;
			if (isInView && this.representingBeatmap) {
				this.imageLoadingStarted = true;
				this.loadImage();
			}
		}

		this.backgroundImageSprite.alpha = this.imageFadeIn.getCurrentValue();

		let combinedSetPanelHeight = BEATMAP_SET_PANEL_HEIGHT + BEATMAP_SET_PANEL_MARGIN;
		let combinedPanelHeight = BEATMAP_PANEL_HEIGHT + BEATMAP_PANEL_MARGIN;

		if (this.isExpanded) {
			let expansionValue = this.expandInterpolator.getCurrentValue();

			this.panelContainer.pivot.x = Math.floor(50 * expansionValue * scalingFactor);

			for (let i = 0; i < this.beatmapPanels.length; i++) {
				this.beatmapPanels[i].update();
				let container = this.beatmapPanels[i].container;

				container.y = Math.floor((BEATMAP_SET_PANEL_HEIGHT/2 + combinedPanelHeight * expansionValue + combinedPanelHeight * i * expansionValue) * scalingFactor);
			}
		}

		let normalizedDistanceToCenter = (this.container.y + BEATMAP_SET_PANEL_MARGIN - window.innerHeight/2) / (window.innerHeight/2);

		let circleHeight = -Math.sqrt(1 - (normalizedDistanceToCenter * 0.75)**2) + 1;
		this.panelContainer.x = Math.floor(circleHeight * 150 * scalingFactor);

		return combinedSetPanelHeight + this.expandInterpolator.getCurrentValue() * combinedPanelHeight * this.beatmapFiles.length;
	}

	async expand() {
		if (this.isExpanded) return;
		this.isExpanded = true;

		if (getSelectedPanel()) {
			// selectedPanel.collapse();
		}

		setSelectedPanel(this);

		this.expandInterpolator.start();

		for (let i = 0; i < this.beatmapFiles.length; i++) {
			let beatmapPanel = new BeatmapPanel(this.beatmapSet);
			beatmapPanel.container.zIndex = -i;

			this.difficultyContainer.addChild(beatmapPanel.container);
			this.beatmapPanels.push(beatmapPanel);
		}

		let backgroundImage = await this.representingBeatmap.getBackgroundImageFile();
		if (backgroundImage) {
			let url = await backgroundImage.readAsResourceUrl();
			BackgroundManager.setImage(url);
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
	}

	collapse() {
		this.expandInterpolator.reset();
		this.beatmapPanels.length = 0;
		this.isExpanded = false;
		this.difficultyContainer.removeChildren();
	}
}