import { songSelectContainer, songSelectInteractionGroup, triggerSelectedBeatmap, getSelectedExtendedBeatmapData } from "./song_select";
import { currentWindowDimensions } from "../../visuals/ui";
import { getBeatmapInfoPanelScalingFactor } from "./beatmap_info_panel";
import { scale } from "gl-matrix/src/gl-matrix/vec2";
import { createPolygonTexture, svgToTexture } from "../../util/pixi_util";
import { addRenderingTask } from "../../visuals/rendering";
import { Interactivity } from "../../input/interactivity";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { mainMusicMediaPlayer } from "../../audio/media_player";

const PULSAR_IDLE_RADIUS = 60;
const SIDE_CONTROL_PANEL_WIDTH = 42;
const SIDE_CONTROL_PANEL_HEIGHT = 290;

let sideControlPanel: SongSelectSideControlPanel = null;
let sideControlPanelInteractionGroup = Interactivity.createGroup();
sideControlPanelInteractionGroup.setZIndex(4);
setTimeout(() => songSelectInteractionGroup.add(sideControlPanelInteractionGroup)); // TEMP TEEEEEEEMp

let sideControlPanelScalingFactor = 1.0;
let sideControlPanelBg = document.createElement('canvas');
let sideControlPanelBgCtx = sideControlPanelBg.getContext('2d');
let randomButtonTexture = svgToTexture(document.querySelector('#svg-shuffle'), true);
let modsButtonTexture = svgToTexture(document.querySelector('#svg-options'), true);
let cdTexture = svgToTexture(document.querySelector('#svg-cd'), true);

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

addRenderingTask((now) => {
	if (!sideControlPanel) return;
	sideControlPanel.update(now);
});

export function resetLastBeatTime() {
	sideControlPanel.resetLastBeatTime();
}

class SongSelectSideControlPanel {
    public container: PIXI.Container;
    private pulsar: SideControlPulsar;
    private background: PIXI.Sprite;
    private buttons: SideControlPanelButton[] = [];

    constructor() {
        this.container = new PIXI.Container();
        this.container.sortableChildren = true;
        this.pulsar = new SideControlPulsar();
		this.container.addChild(this.pulsar.container);
		this.pulsar.container.zIndex = 10;

        this.background = new PIXI.Sprite();
        this.background.tint = 0x000000;
        this.background.alpha = 0.6;
        this.container.addChild(this.background);

        // omg give this a more descriptive name
        let b1 = new SideControlPanelButton('random', randomButtonTexture);
        this.container.addChild(b1.container);
        this.buttons.push(b1);
        let b2 = new SideControlPanelButton('mods', modsButtonTexture);
        this.container.addChild(b2.container);
		this.buttons.push(b2);

		let interaction = Interactivity.registerDisplayObject(this.background);
		sideControlPanelInteractionGroup.add(interaction);
		interaction.setZIndex(-1);
		interaction.enableEmptyListeners();
    }

    resize() {
        let scalingFactor = getSideControlPanelScalingFactor();
        
        this.background.texture = createPanelBackgroundTexture();
        this.background.pivot.set(Math.floor(SIDE_CONTROL_PANEL_WIDTH/2 * scalingFactor), Math.floor((SIDE_CONTROL_PANEL_HEIGHT + 2*SIDE_CONTROL_PANEL_WIDTH/5) /2 * scalingFactor));

		this.container.pivot.x = Math.floor(SIDE_CONTROL_PANEL_WIDTH/2 * scalingFactor);
		
		this.pulsar.resize();

        for (let i = 0; i < this.buttons.length; i++) {
            let b = this.buttons[i];

            b.container.pivot.y = Math.floor((SIDE_CONTROL_PANEL_WIDTH + 2*SIDE_CONTROL_PANEL_WIDTH/5) / 2 * scalingFactor);
            b.container.y = Math.floor(Math.pow(-1, i+1) * SIDE_CONTROL_PANEL_HEIGHT * 0.4 * scalingFactor); // stupid math hack
            b.container.x = -Math.floor(SIDE_CONTROL_PANEL_WIDTH/2 * scalingFactor);
            b.resize();
        }
	}
	
	update(now: number) {
		this.pulsar.update(now);
		for (let b of this.buttons) b.update(now);
	}
	
	resetLastBeatTime() {
		this.pulsar.resetLastBeatTime();
	}
}

class SideControlPanelButton {
    private label: string;
    public container: PIXI.Container;
    private text: PIXI.Text;
	private background: PIXI.Sprite;
	private icon: PIXI.Sprite;
	private hoverInterpolator: Interpolator;

    constructor(label: string, iconTexture: PIXI.Texture) {
        this.label = label;
        this.container = new PIXI.Container();

        this.background = new PIXI.Sprite();
        this.background.alpha = 0.1;
        this.container.addChild(this.background);

        this.text = new PIXI.Text(this.label);
		this.container.addChild(this.text);
		
		this.icon = new PIXI.Sprite();
		this.icon.texture = iconTexture;
		this.container.addChild(this.icon);

		this.hoverInterpolator = new Interpolator({
			duration: 150,
			ease: EaseType.EaseInOutSine,
			beginReversed: true,
			defaultToFinished: true
		});

		this.initInteraction();
	}
	
	private initInteraction() {
		let interaction = Interactivity.registerDisplayObject(this.background);
		sideControlPanelInteractionGroup.add(interaction);

		interaction.addListener('mouseEnter', () => {
			this.hoverInterpolator.setReversedState(false, performance.now());
		});
		interaction.addListener('mouseLeave', () => {
			this.hoverInterpolator.setReversedState(true, performance.now());
		});
	}

    resize() {
		let scalingFactor = getSideControlPanelScalingFactor();
		
		this.background.texture = createPanelButtonTexture();

        this.text.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			textBaseline: 'alphabetic',
			fontSize: Math.floor(9 * scalingFactor)
        };
        this.text.pivot.x = Math.floor(this.text.width / 2);
        this.text.x = Math.floor(SIDE_CONTROL_PANEL_WIDTH / 2 * scalingFactor);
        this.text.y = Math.floor(SIDE_CONTROL_PANEL_WIDTH * 0.85 * scalingFactor);

		this.icon.width = Math.floor(26 * scalingFactor);
		this.icon.height = this.icon.width;
		this.icon.anchor.set(0.5, 0.0);
		this.icon.x = this.text.x;
		this.icon.y = Math.floor(SIDE_CONTROL_PANEL_WIDTH * 0.25 * scalingFactor);
	}
	
	update(now: number) {
		this.background.alpha = this.hoverInterpolator.getCurrentValue(now) * 0.10;
	}
}

class SideControlPulsar {
	public container: PIXI.Container;
	private graphics: PIXI.Graphics;
	private hoverInterpolator: Interpolator;
	private hitbox: PIXI.Circle;
	private icon: PIXI.Sprite;
	private pulseInterpolator: Interpolator;
	private lastBeatTime: number = -Infinity;

	constructor() {
		this.container = new PIXI.Container();
		this.graphics = new PIXI.Graphics();
		this.container.addChild(this.graphics);

		this.hitbox = new PIXI.Circle(0, 0, 0);
		this.container.hitArea = this.hitbox;

		this.icon = new PIXI.Sprite();
		this.icon.anchor.set(0.5, 0.5);
		this.icon.texture = cdTexture;
		this.icon.tint = 0x000000;
		this.container.addChild(this.icon);

		let shadow = new PIXI.filters.DropShadowFilter({
			rotation: 180,
			distance: 6,
			alpha: 0.25,
			blur: 0,
			quality: 10,
			pixelSize: 0.1
		});
		this.container.filters = [shadow];

		this.hoverInterpolator = new Interpolator({
			duration: 350,
			ease: EaseType.EaseOutElastic,
			p: 0.4,
			reverseEase: EaseType.EaseInCubic,
			beginReversed: true,
			defaultToFinished: true
		});

		this.pulseInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutCubic,
			defaultToFinished: true,
			from: 0.2,
			to: 0.0
		});

		this.initInteraction();
	}

	private initInteraction() {
		let interaction = Interactivity.registerDisplayObject(this.container);
		sideControlPanelInteractionGroup.add(interaction);
		interaction.enableEmptyListeners();
		interaction.setZIndex(1);

		interaction.addListener('mouseEnter', () => {
			this.hoverInterpolator.setReversedState(false, performance.now());
		});
		interaction.addListener('mouseLeave', () => {
			this.hoverInterpolator.setReversedState(true, performance.now());
		});
		interaction.addListener('mouseDown', () => {
			triggerSelectedBeatmap();
		});
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

		this.icon.scale.set(scalingFactor * 0.15);
	}

	update(now: number) {
		let currentExtendedData = getSelectedExtendedBeatmapData();

		outer: if (currentExtendedData) {
			let msPerBeatTimings = currentExtendedData.msPerBeatTimings;
			if (msPerBeatTimings.length === 0) break outer;

			let currentTime = mainMusicMediaPlayer.getCurrentTime() * 1000;
			let latest = msPerBeatTimings[0];

			for (let i = 0; i < msPerBeatTimings.length; i++) {
				let timing = msPerBeatTimings[i];

				if (timing[0] > currentTime) break;

				latest = timing;
			}

			let elapsed = currentTime - latest[0];
			if (elapsed >= 0) {
				let beatTime = latest[0] + Math.floor(elapsed / latest[1]) * latest[1];

				if (beatTime > this.lastBeatTime || beatTime < this.lastBeatTime - latest[1]) {
					this.lastBeatTime = beatTime;
					let beatElapsed = elapsed % latest[1];

					this.pulseInterpolator.start(now - beatElapsed);

					let timeDomainData = mainMusicMediaPlayer.getTimeDomainData();
					let normalized: number[] = [];

					for (let i = 0; i < timeDomainData.length; i++) {
						normalized.push(Math.abs(timeDomainData[i] - 128) / 128);
					}

					let averageAmplitude = Math.min(0.25, MathUtil.getPercentile(normalized, 85, true) * 0.4);
					this.pulseInterpolator.setValueRange(averageAmplitude, 0);
				}
			}
		}

		let pulsarScale = 1 + this.hoverInterpolator.getCurrentValue(now) * 0.1 + this.pulseInterpolator.getCurrentValue(now);

		this.container.scale.set(pulsarScale);
		this.hitbox.radius = pulsarScale * PULSAR_IDLE_RADIUS * getSideControlPanelScalingFactor();
	}

	resetLastBeatTime() {
		this.lastBeatTime = mainMusicMediaPlayer.getCurrentTime() * 1000;
	}
}