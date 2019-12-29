import { VirtualDirectory } from "../file_system/virtual_directory";
import { BeatmapSet } from "../datamodel/beatmap_set";
import { stage, addRenderingTask } from "../visuals/rendering";
import { Beatmap } from "../datamodel/beatmap";
import { inputEventEmitter } from "../input/input";
import { startPlay } from "../game/play";

const songFolderSelect = document.querySelector('#songsFolderSelect') as HTMLInputElement;
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
	public container: PIXI.Container;
	public isExpanded: boolean = false;
	private difficultyContainer: PIXI.Container;

	constructor(beatmapSet: BeatmapSet) {
		this.beatmapSet = beatmapSet;
		this.container = new PIXI.Container();
		this.difficultyContainer = new PIXI.Container();
		this.difficultyContainer.y = 110;
		this.difficultyContainer.x = 50;
		this.container.addChild(this.difficultyContainer);

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
			for (let i = 0; i < this.difficultyContainer.children.length; i++) {
				let a = this.difficultyContainer.children[i];

				let bounds = a.getBounds();
				if (x >= bounds.x && y >= bounds.y && y <= bounds.y + bounds.height) {
					songSelectContainer.visible = false;

					this.beatmapSet.getBeatmapFiles()[i].readAsText().then((text) => {
						let map = new Beatmap({
							text: text,
							beatmapSet: this.beatmapSet,
							metadataOnly: false
						});

						startPlay(map);
					});

					return true;
				}
			}
		}

		return false;
	}

	getHeight() {
		return this.container.height + 20;
	}

	async load() {
		let representingBeatmap = new Beatmap({
			text: await this.beatmapSet.getBeatmapFiles()[0].readAsText(),
			beatmapSet: this.beatmapSet,
			metadataOnly: true
		});

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

		let beatmaps = this.beatmapSet.getBeatmapFiles();

		for (let i = 0; i < beatmaps.length; i++) {
			let beatmapFile = beatmaps[i];
			let beatmap = new Beatmap({
				text: await beatmapFile.readAsText(),
				beatmapSet: this.beatmapSet,
				metadataOnly: true
			});

			let container = new PIXI.Container();

			let mask = new PIXI.Graphics();
			mask.beginFill(0xff2052);
			mask.drawPolygon([
				new PIXI.Point(0, 0),
				new PIXI.Point(10, 50),
				new PIXI.Point(450, 50),
				new PIXI.Point(450, 0)
			]);
			mask.endFill();
			container.addChild(mask);
			container.y = i * 60;

			let shitty = new PIXI.Text(beatmap.version + ' ', { // Adding the extra space so that the canvas doesn't cut off the italics
				fontFamily: 'Exo2',
				fill: 0xffffff,
				fontStyle: 'italic',
				fontSize: 16
			});
			shitty.position.set(30, 10);
			container.addChild(shitty);

			this.difficultyContainer.addChild(container);
		}
	}
}

addRenderingTask(() => {
	let currentHeight = 0;

	for (let i = 0; i < panels.length; i++) {
		let panel = panels[i];

		panel.container.y = currentHeight - scroll;
		currentHeight += panel.getHeight();
	}
});

inputEventEmitter.addListener('wheel', (data) => {
	let wheelEvent = data as WheelEvent;

	scroll += wheelEvent.deltaY;
});

inputEventEmitter.addListener('mousedown', (data) => {
	let mouseEvent = data as MouseEvent;

	for (let i = 0; i < panels.length; i++) {
		let panel = panels[i];

		let actionTaken = panel.click(mouseEvent.clientX, mouseEvent.clientY);
		if (actionTaken) break;
	}
});