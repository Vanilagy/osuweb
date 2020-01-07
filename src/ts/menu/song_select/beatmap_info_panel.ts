import { BeatmapSet } from "../../datamodel/beatmap_set";
import { Beatmap, NonTrivialBeatmapMetadata } from "../../datamodel/beatmap";
import { getGlobalScalingFactor } from "../../visuals/ui";
import { songSelectContainer } from "./song_select";
import { BeatmapDetailsTab } from "./beatmap_details_tab";
import { addRenderingTask } from "../../visuals/rendering";
import { DifficultyAttributes } from "../../datamodel/difficulty/difficulty_calculator";

export const INFO_PANEL_WIDTH = 520;
export const INFO_PANEL_HEIGHT = 260;

let infoPanelMask = document.createElement('canvas');
let infoPanelMaskCtx = infoPanelMask.getContext('2d');
let infoPanelGradient = document.createElement('canvas');
let infoPanelGradientCtx = infoPanelGradient.getContext('2d');
export let beatmapInfoPanel: BeatmapInfoPanel = null;

export function initBeatmapInfoPanel() {
	beatmapInfoPanel = new BeatmapInfoPanel();
	songSelectContainer.addChild(beatmapInfoPanel.container);

	updateBeatmapInfoPanelSizing();
}

function updateInfoPanelMask() {
	let scalingFactor = getGlobalScalingFactor();
	let slantWidth = INFO_PANEL_HEIGHT/5;

	infoPanelMask.setAttribute('width', String(Math.ceil((INFO_PANEL_WIDTH + slantWidth) * scalingFactor)));
	infoPanelMask.setAttribute('height', String(Math.ceil(INFO_PANEL_HEIGHT * scalingFactor)));

	infoPanelMaskCtx.clearRect(0, 0, infoPanelMask.width, infoPanelMask.height);

	infoPanelMaskCtx.beginPath();
	infoPanelMaskCtx.moveTo(0, 0);
	infoPanelMaskCtx.lineTo(Math.floor(slantWidth * scalingFactor), Math.floor(INFO_PANEL_HEIGHT * scalingFactor));
	infoPanelMaskCtx.lineTo(Math.floor((slantWidth + INFO_PANEL_WIDTH) * scalingFactor), Math.floor(INFO_PANEL_HEIGHT * scalingFactor));
	infoPanelMaskCtx.lineTo(Math.floor(INFO_PANEL_WIDTH * scalingFactor), 0);
	infoPanelMaskCtx.closePath();

	infoPanelMaskCtx.fillStyle = '#ffffff';
	infoPanelMaskCtx.fill();
}

function updateInfoPanelGradient() {
	let scalingFactor = getGlobalScalingFactor();
	let slantWidth = INFO_PANEL_HEIGHT/5;

	infoPanelGradient.setAttribute('width', String(Math.ceil((INFO_PANEL_WIDTH + slantWidth) * scalingFactor)));
	infoPanelGradient.setAttribute('height', String(Math.ceil(INFO_PANEL_HEIGHT * scalingFactor)));

	infoPanelGradientCtx.clearRect(0, 0, infoPanelGradient.width, infoPanelGradient.height);

	let gradient = infoPanelGradientCtx.createLinearGradient(0, infoPanelGradient.height, 0, 0);
	gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
	gradient.addColorStop(0.38, 'rgba(0,0,0,0.0)');
	infoPanelGradientCtx.fillStyle = gradient;
	infoPanelGradientCtx.fillRect(0, 0, infoPanelGradient.width, infoPanelGradient.height);
}

export function updateBeatmapInfoPanelSizing() {
	if (!beatmapInfoPanel) return;

	let scalingFactor = getGlobalScalingFactor();

	beatmapInfoPanel.container.x = Math.floor(40 * scalingFactor);
	beatmapInfoPanel.container.y = Math.floor(130 * scalingFactor);
}

addRenderingTask(() => {
	if (!beatmapInfoPanel) return;
	beatmapInfoPanel.update();
});

export class BeatmapInfoPanel {
	private currentBeatmapSet: BeatmapSet = null;

	public container: PIXI.Container;
	private upperPanelContainer: PIXI.Container;
	private mask: PIXI.Sprite;
	private backgroundImageSprite: PIXI.Sprite;
	private darkening: PIXI.Sprite;
	private titleText: PIXI.Text;
	private artistText: PIXI.Text;
	private mapperTextPrefix: PIXI.Text; // Need to have two separate text thingeys because they have different styling, and PIXI isn't flexible enough
	private mapperText: PIXI.Text;
	private difficultyText: PIXI.Text;
	private detailsTab: BeatmapDetailsTab;

	constructor() {
		this.container = new PIXI.Container();

		this.upperPanelContainer = new PIXI.Container();
		this.container.addChild(this.upperPanelContainer);

		let shadow = new PIXI.filters.DropShadowFilter({
			rotation: 45,
			distance: 6,
			alpha: 0.25,
			blur: 0,
			quality: 10,
			pixelSize: 0.1
		});

		this.mask = new PIXI.Sprite();
		this.upperPanelContainer.addChild(this.mask);
		this.upperPanelContainer.filters = [shadow];
		this.upperPanelContainer.mask = this.mask;

		this.backgroundImageSprite = new PIXI.Sprite();
		//this.backgroundImageSprite.anchor.set(0.0, 0.5);
		this.upperPanelContainer.addChild(this.backgroundImageSprite);

		this.darkening = new PIXI.Sprite();
		this.upperPanelContainer.addChild(this.darkening);

		this.titleText = new PIXI.Text('');
		this.upperPanelContainer.addChild(this.titleText);
		this.artistText = new PIXI.Text('');
		this.upperPanelContainer.addChild(this.artistText);
		this.mapperTextPrefix = new PIXI.Text('');
		this.upperPanelContainer.addChild(this.mapperTextPrefix);
		this.mapperText = new PIXI.Text('');
		this.upperPanelContainer.addChild(this.mapperText);
		this.difficultyText = new PIXI.Text('');
		this.difficultyText.anchor.set(1.0, 0.0);
		this.upperPanelContainer.addChild(this.difficultyText);

		this.detailsTab = new BeatmapDetailsTab();
		this.container.addChild(this.detailsTab.container);

		this.resize();
	}

	async load(beatmapSet: BeatmapSet, beatmap?: Beatmap, metadata?: NonTrivialBeatmapMetadata, difficulty?: DifficultyAttributes) {
		if (!beatmap) {
			let beatmapFiles = beatmapSet.getBeatmapFiles();

			beatmap = new Beatmap({
				text: await beatmapFiles[0].readAsText(),
				beatmapSet: beatmapSet,
				metadataOnly: true
			});
		}

		if (beatmapSet !== this.currentBeatmapSet) {
			this.currentBeatmapSet = beatmapSet;

			let imageFile = await beatmap.getBackgroundImageFile();
			let bitmap: ImageBitmap = null;
			if (imageFile) {
				let img = new Image();
				img.src = await imageFile.readAsResourceUrl();
	
				await new Promise((resolve) => img.onload = resolve);
	
				bitmap = await (createImageBitmap as any)(await imageFile.getBlob(), {
					resizeWidth: 1024,
					resizeHeight: 1024 * img.height/img.width
				});
			}
	
			if (bitmap) {
				let scalingFactor = getGlobalScalingFactor();
	
				let texture = PIXI.Texture.from(bitmap as any);
				this.backgroundImageSprite.texture = texture;
	
				let ratio = texture.height/texture.width;
				let containerWidth = (INFO_PANEL_WIDTH + INFO_PANEL_HEIGHT/5) * scalingFactor;
				let containerHeight = INFO_PANEL_HEIGHT * scalingFactor;
	
				if (containerWidth * ratio >= containerHeight) {
					this.backgroundImageSprite.width = containerWidth;
					this.backgroundImageSprite.height = containerWidth * ratio;
					
					let spare = containerWidth * ratio - containerHeight;
					this.backgroundImageSprite.y = -spare / 2;
				} else {
					this.backgroundImageSprite.height = containerHeight;
					this.backgroundImageSprite.width = containerHeight / ratio;
	
					let spare = containerHeight / ratio - containerWidth;
					this.backgroundImageSprite.x = -spare / 2;
				}
			}
		}

		this.titleText.text = beatmap.title + ' ';
		this.artistText.text = beatmap.artist + ' ';
		this.mapperTextPrefix.text = 'Mapped by ';
		this.mapperText.text = beatmap.creator + ' ';
		this.difficultyText.text = beatmap.version + ' ';

		this.positionMapperText();

		if (metadata) {
			this.detailsTab.loadBeatmap(beatmap, metadata, difficulty);
		}
	}

	private positionMapperText() {
		this.mapperText.x = this.mapperTextPrefix.x + this.mapperTextPrefix.width;
		this.mapperText.y = this.mapperTextPrefix.y - (this.mapperText.height - this.mapperTextPrefix.height) / 2;
	}

	resize() {
		let scalingFactor = getGlobalScalingFactor();

		updateInfoPanelMask();
		this.mask.texture = PIXI.Texture.from(infoPanelMask);
		this.mask.texture.update();

		updateInfoPanelGradient();
		this.darkening.texture = PIXI.Texture.from(infoPanelGradient);
		this.darkening.texture.update();

		this.titleText.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(22 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.titleText.position.set((INFO_PANEL_HEIGHT/5 + 12) * scalingFactor, (INFO_PANEL_HEIGHT - 80) * scalingFactor);
		this.titleText.x = Math.floor(this.titleText.x);
		this.titleText.y = Math.floor(this.titleText.y);

		this.artistText.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(14 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.artistText.position.set((INFO_PANEL_HEIGHT/5 + 12) * scalingFactor, (INFO_PANEL_HEIGHT - 57) * scalingFactor);
		this.artistText.x = Math.floor(this.artistText.x);
		this.artistText.y = Math.floor(this.artistText.y);

		this.mapperTextPrefix.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(12 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.mapperTextPrefix.position.set((INFO_PANEL_HEIGHT/5 + 12) * scalingFactor, (INFO_PANEL_HEIGHT - 27) * scalingFactor);
		this.mapperTextPrefix.x = Math.floor(this.mapperTextPrefix.x);
		this.mapperTextPrefix.y = Math.floor(this.mapperTextPrefix.y);

		this.mapperText.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontWeight: 'bold',
			fontSize: Math.floor(12 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.mapperText.position.set((INFO_PANEL_HEIGHT/5 + 12) * scalingFactor, (INFO_PANEL_HEIGHT - 27) * scalingFactor);
		this.mapperText.x = Math.floor(this.mapperText.x);
		this.mapperText.y = Math.floor(this.mapperText.y);

		this.difficultyText.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(12 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.difficultyText.position.set((INFO_PANEL_WIDTH + INFO_PANEL_HEIGHT/5 - 20) * scalingFactor, (INFO_PANEL_HEIGHT - 27) * scalingFactor);
		this.difficultyText.x = Math.floor(this.difficultyText.x);
		this.difficultyText.y = Math.floor(this.difficultyText.y);

		this.detailsTab.resize();
		this.detailsTab.container.x = Math.floor((INFO_PANEL_HEIGHT/5) * scalingFactor);
		this.detailsTab.container.y = Math.floor((INFO_PANEL_HEIGHT + 10) * scalingFactor);
	}

	update() {
		this.detailsTab.update();
	}
}