import { songSelectContainer } from "./song_select";
import { currentWindowDimensions } from "../../visuals/ui";
import { getBeatmapInfoPanelScalingFactor } from "./beatmap_info_panel";
import { scale } from "gl-matrix/src/gl-matrix/vec2";
import { createPolygonTexture } from "../../util/pixi_util";

const PULSAR_IDLE_RADIUS = 60;
const SIDE_CONTROL_PANEL_WIDTH = 42;
const SIDE_CONTROL_PANEL_HEIGHT = 290;

let sideControlPanel: SongSelectSideControlPanel = null;
let sideControlPanelScalingFactor = 1.0;
let sideControlPanelBg = document.createElement('canvas');
let sideControlPanelBgCtx = sideControlPanelBg.getContext('2d');

export function getSideControlPanelScalingFactor() {
	return sideControlPanelScalingFactor;
}

export function initSideControlPanel() {
    sideControlPanel = new SongSelectSideControlPanel();
    songSelectContainer.addChild(sideControlPanel.container);

    updateSideControlPanelSizing();
}

export function updateSideControlPanelSizing() {
    if (!sideControlPanel) return;

    sideControlPanelScalingFactor = getBeatmapInfoPanelScalingFactor(); // TEMP for now
    
    sideControlPanel.container.x = currentWindowDimensions.width;
    sideControlPanel.container.y = Math.floor(currentWindowDimensions.height / 2);

    sideControlPanel.resize();
}

function createPanelBackgroundTexture() {
    let slantHeight = SIDE_CONTROL_PANEL_WIDTH / 5;
    let scalingFactor = getSideControlPanelScalingFactor();

    return createPolygonTexture(SIDE_CONTROL_PANEL_WIDTH, SIDE_CONTROL_PANEL_HEIGHT + 2*slantHeight, 
        [new PIXI.Point(0, slantHeight), new PIXI.Point(SIDE_CONTROL_PANEL_WIDTH, 0), new PIXI.Point(SIDE_CONTROL_PANEL_WIDTH, SIDE_CONTROL_PANEL_HEIGHT + slantHeight), new PIXI.Point(0, SIDE_CONTROL_PANEL_HEIGHT + 2*slantHeight)],
    scalingFactor);
}

function createPanelButtonTexture() {
    let slantHeight = SIDE_CONTROL_PANEL_WIDTH / 5;
    let scalingFactor = getSideControlPanelScalingFactor();

    return createPolygonTexture(SIDE_CONTROL_PANEL_WIDTH, SIDE_CONTROL_PANEL_WIDTH + 2*slantHeight, 
        [new PIXI.Point(0, slantHeight), new PIXI.Point(SIDE_CONTROL_PANEL_WIDTH, 0), new PIXI.Point(SIDE_CONTROL_PANEL_WIDTH, SIDE_CONTROL_PANEL_WIDTH + slantHeight), new PIXI.Point(0, SIDE_CONTROL_PANEL_WIDTH + 2*slantHeight)],
    scalingFactor);
}

export function updateSideControlPanelBg() {
    let scalingFactor = getSideControlPanelScalingFactor();
	let slantHeight = SIDE_CONTROL_PANEL_WIDTH/5;

	sideControlPanelBg.setAttribute('width', String(Math.ceil(SIDE_CONTROL_PANEL_WIDTH * scalingFactor)));
	sideControlPanelBg.setAttribute('height', String(Math.ceil((SIDE_CONTROL_PANEL_HEIGHT + slantHeight * 2) * scalingFactor)));

	sideControlPanelBgCtx.clearRect(0, 0, sideControlPanelBg.width, sideControlPanelBg.height);

	sideControlPanelBgCtx.beginPath();
    sideControlPanelBgCtx.moveTo(0, Math.floor(slantHeight * scalingFactor));
    sideControlPanelBgCtx.lineTo(Math.floor(SIDE_CONTROL_PANEL_WIDTH * scalingFactor), 0);
    sideControlPanelBgCtx.lineTo(Math.floor(SIDE_CONTROL_PANEL_WIDTH * scalingFactor), Math.floor((SIDE_CONTROL_PANEL_HEIGHT + slantHeight) * scalingFactor));
    sideControlPanelBgCtx.lineTo(0, Math.floor((SIDE_CONTROL_PANEL_HEIGHT + 2*slantHeight) * scalingFactor));

	sideControlPanelBgCtx.fillStyle = '#ffffff';
	sideControlPanelBgCtx.fill();
}

class SongSelectSideControlPanel {
    public container: PIXI.Container;
    private pulsar: PIXI.Container;
    private graphics: PIXI.Graphics;
    private background: PIXI.Sprite;
    private buttons: SideControlPanelButton[] = [];

    constructor() {
        this.container = new PIXI.Container();
        this.container.sortableChildren = true;
        this.pulsar = new PIXI.Container();
        this.container.addChild(this.pulsar);

        this.graphics = new PIXI.Graphics();
        this.pulsar.addChild(this.graphics);
        this.pulsar.zIndex = 10;

        this.background = new PIXI.Sprite();
        this.background.tint = 0x000000;
        this.background.alpha = 0.6;
        this.container.addChild(this.background);

        // omg give this a more descriptive name
        let b1 = new SideControlPanelButton('random');
        this.container.addChild(b1.container);
        this.buttons.push(b1);
        let b2 = new SideControlPanelButton('mods');
        this.container.addChild(b2.container);
        this.buttons.push(b2);
    }

    resize() {
        let scalingFactor = getSideControlPanelScalingFactor();

        let g = this.graphics;
        g.clear();

        g.beginFill(0xFF4572);
        g.drawCircle(0, 0, PULSAR_IDLE_RADIUS * scalingFactor);
        g.endFill();
        g.beginFill(0xffffff);
        g.drawCircle(0, 0, PULSAR_IDLE_RADIUS * 0.92 * scalingFactor);
        
        this.background.texture = createPanelBackgroundTexture();
        this.background.pivot.set(Math.floor(SIDE_CONTROL_PANEL_WIDTH/2 * scalingFactor), Math.floor((SIDE_CONTROL_PANEL_HEIGHT + 2*SIDE_CONTROL_PANEL_WIDTH/5) /2 * scalingFactor));

        this.container.pivot.x = Math.floor(SIDE_CONTROL_PANEL_WIDTH/2 * scalingFactor);

        for (let i = 0; i < this.buttons.length; i++) {
            let b = this.buttons[i];

            b.container.pivot.y = Math.floor((SIDE_CONTROL_PANEL_WIDTH + 2*SIDE_CONTROL_PANEL_WIDTH/5) / 2 * scalingFactor);
            b.container.y = Math.floor(Math.pow(-1, i+1) * SIDE_CONTROL_PANEL_HEIGHT * 0.4 * scalingFactor); // stupid math hack
            b.container.x = -Math.floor(SIDE_CONTROL_PANEL_WIDTH/2 * scalingFactor);
            b.resize();
        }
    }
}

class SideControlPanelButton {
    private label: string;
    public container: PIXI.Container;
    private text: PIXI.Text;
    private background: PIXI.Sprite;

    constructor(label: string) {
        this.label = label;
        this.container = new PIXI.Container();

        this.background = new PIXI.Sprite();
        this.background.alpha = 0.2;
        this.container.addChild(this.background);

        this.text = new PIXI.Text(this.label);
        this.container.addChild(this.text);
    }

    resize() {
        let scalingFactor = getSideControlPanelScalingFactor();

        this.text.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			textBaseline: 'alphabetic',
			fontSize: Math.floor(11 * scalingFactor)
        };
        this.text.pivot.x = Math.floor(this.text.width / 2);
        this.text.x = Math.floor(SIDE_CONTROL_PANEL_WIDTH / 2 * scalingFactor);
        this.text.y = Math.floor(SIDE_CONTROL_PANEL_WIDTH * 0.75 * scalingFactor);

        this.background.texture = createPanelButtonTexture();
    }
}