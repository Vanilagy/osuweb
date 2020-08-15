import { globalState } from "../global_state";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "./ui";
import { getCurrentMousePosition } from "../input/input";
import { TAU } from "../util/math_util";
import { Skin } from "../game/skin/skin";

// Chrome renders a fully invisible cursor as an opaque black thing, for some reason. Therefore we need this:
// We don't use cursor: none, because that's also bugged currently and not reliable.
let almostInvisiblePngUrl: string;
function generateAlmostInvisiblePng() {
	let canvas = document.createElement('canvas');
	canvas.setAttribute('width', "1");
	canvas.setAttribute('height', "1");
	
	let ctx = canvas.getContext('2d');
	ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
	ctx.fillRect(0, 0, 1, 1);
	
	canvas.toBlob((blob) => {
		almostInvisiblePngUrl = URL.createObjectURL(blob);
	});
}
generateAlmostInvisiblePng();

export class Cursor {
	private hardwareCursorCanvas: HTMLCanvasElement;
	private hardwareCursorCtx: CanvasRenderingContext2D;

	public container: PIXI.Container;
	private softwareCursorContainer: PIXI.Container;
	private softwareCursorMain: PIXI.Sprite;
	private softwareCursorMiddle: PIXI.Sprite;
	private lastSkin: Skin = null;

	constructor() {
		this.hardwareCursorCanvas = document.createElement('canvas');
		this.hardwareCursorCanvas.setAttribute('width', '128');
		this.hardwareCursorCanvas.setAttribute('height', '128');
		this.hardwareCursorCtx = this.hardwareCursorCanvas.getContext('2d');
		
		this.container = new PIXI.Container();

		this.softwareCursorContainer = new PIXI.Container();
		this.softwareCursorMain = new PIXI.Sprite();
		this.softwareCursorMiddle = new PIXI.Sprite();
		this.softwareCursorContainer.addChild(this.softwareCursorMain, this.softwareCursorMiddle);
		this.softwareCursorContainer.visible = false;

		this.container.addChild(this.softwareCursorContainer);
	}

	/** Resize and redraw the cursor. */
	refresh() {
		let skin = globalState.skinManager?.currentSkin;
		if (!skin) return;

		let scaling = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT * globalState.settings['cursorSize'];
		let cursorCenter = skin.config.general.cursorCenter;

		if (globalState.settings['useSoftwareCursor']) {
			this.softwareCursorContainer.visible = true;

			let cursorTexture = skin.textures['cursor'];
			cursorTexture.applyToSprite(this.softwareCursorMain, scaling);
			let cursorMiddleTexture = skin.textures['cursorMiddle'];
			cursorMiddleTexture.applyToSprite(this.softwareCursorMiddle, scaling);

			if (cursorCenter) {
				this.softwareCursorMain.anchor.set(0.5, 0.5);
				this.softwareCursorMiddle.anchor.set(0.5, 0.5);
			} else {
				this.softwareCursorMain.anchor.set(0, 0);
				this.softwareCursorMiddle.anchor.set(0, 0);
			}
		} else {
			this.softwareCursorContainer.visible = false;

			let ctx = this.hardwareCursorCtx;
			ctx.clearRect(0, 0, 128, 128);
	
			// Draw cursor
			block: {
				let osuTexture = skin.textures['cursor'];
				let tex = osuTexture.getBest();
				if (!tex) break block;
	
				let img = (tex.baseTexture.resource as any).source as HTMLImageElement;
				let width = osuTexture.getWidth() * scaling;
				let height = osuTexture.getWidth() * scaling;

				let x = cursorCenter? 64 - width/2 : 0;
				let y = cursorCenter? 64 - height/2 : 0;
		
				ctx.drawImage(img, x, y, width, height);
			}
	
			// Draw cursormiddle
			block: {
				let osuTexture = skin.textures['cursorMiddle'];
				let tex = osuTexture.getBest();
				if (!tex) break block;
	
				let img = (tex.baseTexture.resource as any).source as HTMLImageElement;
				let width = osuTexture.getWidth() * scaling;
				let height = osuTexture.getWidth() * scaling;

				let x = cursorCenter? 64 - width/2 : 0;
				let y = cursorCenter? 64 - height/2 : 0;
		
				ctx.drawImage(img, x, y, width, height);
			}
	
			this.hardwareCursorCanvas.toBlob((blob) => {
				let url = URL.createObjectURL(blob);
				let pos = cursorCenter? 64 : 0;
				document.documentElement.style.cursor = `url('${url}') ${pos} ${pos}, auto`;
			});
		}
	}

	update(now: number) {
		let mousePos = getCurrentMousePosition();

		this.softwareCursorContainer.position.set(Math.floor(mousePos.x), Math.floor(mousePos.y));
		if (globalState.skinManager?.currentSkin?.config.general.cursorRotate) {
			this.softwareCursorMain.rotation = (now * 0.0006) % TAU;
		}

		if (globalState.settings['useSoftwareCursor']) {
			if (!globalState.skinManager?.currentSkin) {
				// If there's no skin yet, show the normal cursor.
				document.documentElement.style.cursor = 'auto';
			} else if (globalState.settings['mouseInputMode'] === 'raw' && !document.pointerLockElement) {
				// Show the normal cursor if pointer lock mode hasn't been entered yet.
				document.documentElement.style.cursor = `auto`;
			} else {
				// Otherwise, hide the hardware cursor.
				document.documentElement.style.cursor = `url('${almostInvisiblePngUrl}') 8 8, auto`;
			}
		}

		if (globalState.skinManager?.currentSkin && globalState.skinManager.currentSkin !== this.lastSkin) {
			this.lastSkin = globalState.skinManager.currentSkin;
			this.refresh();
		}
	}
}