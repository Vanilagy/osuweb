import { VirtualDirectory } from "../file_system/virtual_directory";
import { BeatmapSet } from "../datamodel/beatmap_set";
import { stage, addRenderingTask } from "../visuals/rendering";
import { Beatmap } from "../datamodel/beatmap";
import { inputEventEmitter } from "../input/input";
import { startPlayFromBeatmap } from "../game/play";
import { Interpolator } from "../util/graphics_util";
import { EaseType } from "../util/math_util";
import { VirtualFile } from "../file_system/virtual_file";
import { BackgroundManager } from "../visuals/background";
import { ProcessedBeatmap } from "../datamodel/processed/processed_beatmap";
import { DifficultyCalculator, DifficultyAttributes } from "../datamodel/difficulty/difficulty_calculator";
import { processJob } from "../multithreading/job_system";
import { JobTask } from "../multithreading/job";
import { promiseAllSettled } from "../util/misc_util";

const songFolderSelect = document.querySelector('#songs-folder-select') as HTMLInputElement;
const songSelectContainer = new PIXI.Container();
stage.addChild(songSelectContainer);

let scroll = 0;

songFolderSelect.addEventListener('change', () => {
	let directory = VirtualDirectory.fromFileList(songFolderSelect.files);
	
	directory.forEach((entry) => {
		if (!(entry instanceof VirtualDirectory)) return;

		let beatmapSet = new BeatmapSet(entry);
		let panel = new BeatmapSetPanel(beatmapSet);
		songSelectContainer.addChild(panel.container);

		panels.push(panel);
	});
});

let panels: BeatmapSetPanel[] = [];

let canvasThing = document.createElement('canvas');
canvasThing.setAttribute('width', String(500));
canvasThing.setAttribute('height', String(100));
let ctx = canvasThing.getContext('2d');
let gradient = ctx.createLinearGradient(200, 0, 500, 100);
gradient.addColorStop(0, 'rgba(0,0,0,0.6)');
gradient.addColorStop(1, 'rgba(0,0,0,0.0)');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 500, 100);

class BeatmapSetPanel {
	private beatmapSet: BeatmapSet;
	private beatmapFiles: VirtualFile[];
	public container: PIXI.Container;
	public isExpanded: boolean = false;
	private difficultyContainer: PIXI.Container;
	private expandInterpolator: Interpolator;
	private beatmapPanels: BeatmapPanel[] = [];
	private representingBeatmap: Beatmap;

	constructor(beatmapSet: BeatmapSet) {
		this.beatmapSet = beatmapSet;
		this.container = new PIXI.Container();
		this.difficultyContainer = new PIXI.Container();
		this.difficultyContainer.y = 0;
		this.difficultyContainer.x = 50;
		this.difficultyContainer.sortableChildren = true;
		this.container.addChild(this.difficultyContainer);

		this.beatmapFiles = this.beatmapSet.getBeatmapFiles();

		this.expandInterpolator = new Interpolator({
			ease: EaseType.EaseOutCubic,
			duration: 500,
			from: 0,
			to: 1,
			defaultToFinished: false
		});

		this.load();
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
				let a = this.beatmapPanels[i].container;

				let bounds = a.getBounds();
				if (x >= bounds.x && y >= bounds.y && y <= bounds.y + bounds.height) {
					songSelectContainer.visible = false;

					this.beatmapFiles[i].readAsText().then((text) => {
						let map = new Beatmap({
							text: text,
							beatmapSet: this.beatmapSet,
							metadataOnly: false
						});

						startPlayFromBeatmap(map);
					});

					return true;
				}
			}
		}

		return false;
	}

	update() {
		if (this.isExpanded) {
			for (let i = 0; i < this.beatmapPanels.length; i++) {
				let container = this.beatmapPanels[i].container;

				container.y = 50 + 60 * this.expandInterpolator.getCurrentValue() + 60 * i * this.expandInterpolator.getCurrentValue();
			}
		}

		return 120 + this.expandInterpolator.getCurrentValue() * 60 * this.beatmapFiles.length;
	}

	async load() {
		let representingBeatmap = new Beatmap({
			text: await this.beatmapFiles[0].readAsText(),
			beatmapSet: this.beatmapSet,
			metadataOnly: true
		});
		this.representingBeatmap = representingBeatmap;

		let mask = new PIXI.Graphics();
		mask.beginFill(0xff0000);
		mask.drawPolygon([
			new PIXI.Point(0, 0),
			new PIXI.Point(20, 100),
			new PIXI.Point(500, 100),
			new PIXI.Point(500, 0)
		]);
		mask.endFill();
		this.container.addChild(mask);

		console.log(this.container);

		let imageFile = await representingBeatmap.getBackgroundImageFile();
		if (imageFile) {
			let imageSprite = new PIXI.Sprite();
			imageSprite.anchor.set(0.0, 0.25);
			imageSprite.mask = mask;
			this.container.addChild(imageSprite);
	
			let img = new Image();
			img.src = await imageFile.readAsResourceUrl();
			img.onload = () => {
				(createImageBitmap as any)(img, {
					resizeWidth: 500,
					resizeHeight: 500 * img.height/img.width
				}).then(async (bitmap: ImageBitmap) => {
					imageSprite.texture = PIXI.Texture.from(bitmap as any);
					imageSprite.width = 500;
					imageSprite.height = 500 * img.height/img.width;
				});
			};
		}

		let shiiit = new PIXI.Sprite(PIXI.Texture.from(canvasThing));
		shiiit.mask = mask;
		this.container.addChild(shiiit);

		let shitty = new PIXI.Text(representingBeatmap.title + ' ', { // Adding the extra space so that the canvas doesn't cut off the italics
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: 22
		});
		shitty.position.set(35, 10);
		this.container.addChild(shitty);

		let shitty2 = new PIXI.Text(representingBeatmap.artist + ' | ' + representingBeatmap.creator + ' ', {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: 14
		});
		shitty2.position.set(35, 35);
		this.container.addChild(shitty2);

		this.container.x = window.innerWidth - 500;
	}

	async expand() {
		if (this.isExpanded) return;
		this.isExpanded = true;

		let wackShit: Promise<any>[] = [];

		this.expandInterpolator.start();

		for (let i = 0; i < this.beatmapFiles.length; i++) {
			let beatmapFile = this.beatmapFiles[i];
			let beatmapPanel = new BeatmapPanel(beatmapFile, this.beatmapSet);

			wackShit.push(processJob({
				job: {
					task: JobTask.GetBeatmapMetadata,
					beatmapFile: await beatmapFile.getBlob()
				},
				transfer: []
			}));

			//beatmapPanel.container.x = i * 10;
			beatmapPanel.container.zIndex = -i;

			this.difficultyContainer.addChild(beatmapPanel.container);
			this.beatmapPanels.push(beatmapPanel);
		}

		let results = await promiseAllSettled(wackShit);

		for (let i = 0; i < this.beatmapPanels.length; i++) {
			let result = results[i];
			if (result.status === 'fulfilled') {
				this.beatmapPanels[i].load(result.value.beatmapMetadata, result.value.difficulty);
			}

			// .load(result.)
		}

		let backgroundImage = await this.representingBeatmap.getBackgroundImageFile();
		if (backgroundImage) {
			let url = await backgroundImage.readAsResourceUrl();
			BackgroundManager.setImage(url);
		}
	}
}

let beatmapPanelMask = new PIXI.Graphics();
beatmapPanelMask.beginFill(0x000000, 0.5);
beatmapPanelMask.drawPolygon([
	new PIXI.Point(0, 0),
	new PIXI.Point(10, 50),
	new PIXI.Point(450, 50),
	new PIXI.Point(450, 0)
]);
beatmapPanelMask.endFill();

class BeatmapPanel {
	public container: PIXI.Container;
	private beatmapFile: VirtualFile;
	private beatmapSet: BeatmapSet;

	constructor(beatmapFile: VirtualFile, beatmapSet: BeatmapSet) {
		this.beatmapFile = beatmapFile;
		this.beatmapSet = beatmapSet;
		this.container = new PIXI.Container();

		let mask = beatmapPanelMask.clone();

		this.container.addChild(mask);

		//this.load();
	}

	load(metadata: any, difficulty: DifficultyAttributes) {
/*
		let beatmap = new Beatmap({
			text: await this.beatmapFile.readAsText(),
			beatmapSet: this.beatmapSet,
			metadataOnly: false
		});
		let processedBeatmap = new ProcessedBeatmap(beatmap, true);
		processedBeatmap.init();
		processedBeatmap.applyStackShift();
		let difficulty = DifficultyCalculator.calculate(processedBeatmap, new Set(), 1.0);*/

		let rnd = Math.random().toString();

		//console.time(rnd)
		/*
		let shit = await processJob({
			job: {
				task: JobTask.GetBeatmapMetadata,
				beatmapFile: await this.beatmapFile.getBlob()
			},
			transfer: []
		});*/
		//console.timeEnd(rnd)

		let shitty = new PIXI.Text(metadata.version + ' ', { // Adding the extra space so that the canvas doesn't cut off the italics
			fontFamily: 'Exo2',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: 16
		});
		shitty.position.set(30, 10);
		this.container.addChild(shitty);

		function addThing(percent: number, index: number) {
			let width = 15 * percent || 1;

			let g = new PIXI.Graphics();
			g.beginFill(0xffffff);
			g.drawPolygon([
				new PIXI.Point(2, 0),
				new PIXI.Point(2 + width, 0),
				new PIXI.Point(width, 3),
				new PIXI.Point(0, 3)
			]);
			g.endFill();

			g.x = index * 20;
			starRatingContainer.addChild(g);
		}

		let starRatingContainer = new PIXI.Container();
		let floored = Math.floor(difficulty.starRating);
		for (let i = 0; i < floored; i++) {
			addThing(1.0, i);
		}
		if (difficulty.starRating !== floored) {
			addThing(difficulty.starRating - floored, floored);
		}

		this.container.addChild(starRatingContainer);
		starRatingContainer.y = 35;
		starRatingContainer.x = 30;
	}
}

addRenderingTask(() => {
	let currentHeight = 0;

	for (let i = 0; i < panels.length; i++) {
		let panel = panels[i];

		panel.container.y = currentHeight - scroll;
		currentHeight += panel.update();
	}
});

inputEventEmitter.addListener('wheel', (data) => {
	let wheelEvent = data as WheelEvent;

	scroll += wheelEvent.deltaY;
});

inputEventEmitter.addListener('mousedown', (data) => {
	let mouseEvent = data as MouseEvent;

	if (songSelectContainer.visible === false) return; // eh yes duh

	for (let i = 0; i < panels.length; i++) {
		let panel = panels[i];

		let actionTaken = panel.click(mouseEvent.clientX, mouseEvent.clientY);
		if (actionTaken) break;
	}
});