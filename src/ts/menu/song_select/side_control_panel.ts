import { SongSelect } from "./song_select";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { scale } from "gl-matrix/src/gl-matrix/vec2";
import { createPolygonTexture, svgToTexture } from "../../util/pixi_util";
import { addRenderingTask } from "../../visuals/rendering";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { AnalyserNodeWrapper } from "../../audio/analyser_node_wrapper";
import { calculateRatioBasedScalingFactor, lerpColors, Colors, colorToHexNumber } from "../../util/graphics_util";
import { globalState } from "../../global_state";
import { EMPTY_FUNCTION } from "../../util/misc_util";
import { THEME_COLORS } from "../../util/constants";

const PULSAR_IDLE_RADIUS = 60;
const SIDE_CONTROL_PANEL_WIDTH = 42;
const SIDE_CONTROL_PANEL_HEIGHT = 290;

let sideControlPanelBg = document.createElement('canvas');
let sideControlPanelBgCtx = sideControlPanelBg.getContext('2d');
let randomButtonTexture = svgToTexture(document.querySelector('#svg-shuffle'), true);
let modsButtonTexture = svgToTexture(document.querySelector('#svg-options'), true);
let cdTexture = svgToTexture(document.querySelector('#svg-cd'), true);

function createPanelBackgroundTexture(scalingFactor: number) {
    let slantHeight = SIDE_CONTROL_PANEL_WIDTH / 5;

    return createPolygonTexture(SIDE_CONTROL_PANEL_WIDTH, SIDE_CONTROL_PANEL_HEIGHT + 2*slantHeight, 
        [new PIXI.Point(0, slantHeight), new PIXI.Point(SIDE_CONTROL_PANEL_WIDTH, 0), new PIXI.Point(SIDE_CONTROL_PANEL_WIDTH, SIDE_CONTROL_PANEL_HEIGHT + slantHeight), new PIXI.Point(0, SIDE_CONTROL_PANEL_HEIGHT + 2*slantHeight)],
    scalingFactor);
}

function createPanelButtonTexture(scalingFactor: number) {
    let slantHeight = SIDE_CONTROL_PANEL_WIDTH / 5;

    return createPolygonTexture(SIDE_CONTROL_PANEL_WIDTH, SIDE_CONTROL_PANEL_WIDTH + 2*slantHeight, 
        [new PIXI.Point(0, slantHeight), new PIXI.Point(SIDE_CONTROL_PANEL_WIDTH, 0), new PIXI.Point(SIDE_CONTROL_PANEL_WIDTH, SIDE_CONTROL_PANEL_WIDTH + slantHeight), new PIXI.Point(0, SIDE_CONTROL_PANEL_WIDTH + 2*slantHeight)],
    scalingFactor);
}

export function updateSideControlPanelBg(scalingFactor: number) {
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

export class SongSelectSideControlPanel {
	public songSelect: SongSelect;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number = 1.0;

    private pulsar: SideControlPulsar;
    private background: PIXI.Sprite;
	private buttons: SideControlPanelButton[];
	
	public randomButton: SideControlPanelButton;
	public modSelectionButton: SideControlPanelButton;

    constructor(songSelect: SongSelect) {
		this.songSelect = songSelect;
        this.container = new PIXI.Container();
		this.container.sortableChildren = true;
		this.interactionGroup = new InteractionGroup();
		this.interactionGroup.setZIndex(4);

        this.pulsar = new SideControlPulsar(this);
		this.container.addChild(this.pulsar.container);
		this.pulsar.container.zIndex = 10;

        this.background = new PIXI.Sprite();
        this.background.tint = 0x000000;
        this.background.alpha = 0.8;
        this.container.addChild(this.background);

        this.randomButton = new SideControlPanelButton(this, 'random', randomButtonTexture, () => {
			this.songSelect.carousel.selectRandom();
		});
        this.modSelectionButton = new SideControlPanelButton(this, 'mods', modsButtonTexture, () => {
			this.songSelect.modSelector.show();
		});
		this.buttons = [this.randomButton, this.modSelectionButton];
		for (let b of this.buttons) this.container.addChild(b.container);

		let interaction = new InteractionRegistration(this.background);
		this.interactionGroup.add(interaction);
		interaction.setZIndex(-1);
		interaction.enableEmptyListeners(['wheel']);
    }

    resize() {
		this.scalingFactor = calculateRatioBasedScalingFactor(currentWindowDimensions.width, currentWindowDimensions.height, 16/9, REFERENCE_SCREEN_HEIGHT);

		this.container.x = currentWindowDimensions.width;
    	this.container.y = Math.floor(currentWindowDimensions.height / 2);
        
        this.background.texture = createPanelBackgroundTexture(this.scalingFactor);
        this.background.pivot.set(Math.floor(SIDE_CONTROL_PANEL_WIDTH/2 * this.scalingFactor), Math.floor((SIDE_CONTROL_PANEL_HEIGHT + 2*SIDE_CONTROL_PANEL_WIDTH/5) /2 * this.scalingFactor));

		this.container.pivot.x = Math.floor(SIDE_CONTROL_PANEL_WIDTH/2 * this.scalingFactor);
		
		this.pulsar.resize();

        for (let i = 0; i < this.buttons.length; i++) {
            let b = this.buttons[i];

            b.container.pivot.y = Math.floor((SIDE_CONTROL_PANEL_WIDTH + 2*SIDE_CONTROL_PANEL_WIDTH/5) / 2 * this.scalingFactor);
            b.container.y = Math.floor(Math.pow(-1, i+1) * SIDE_CONTROL_PANEL_HEIGHT * 0.4 * this.scalingFactor); // stupid math hack
            b.container.x = -Math.floor(SIDE_CONTROL_PANEL_WIDTH/2 * this.scalingFactor);
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
	private parent: SongSelectSideControlPanel;
	public container: PIXI.Container;

    private label: string;
    private text: PIXI.Text;
	private background: PIXI.Sprite;
	private icon: PIXI.Sprite;
	private hoverInterpolator: Interpolator;
	private pressdownInterpolator: Interpolator;
	private highlightInterpolator: Interpolator;

    constructor(parent: SongSelectSideControlPanel, label: string, iconTexture: PIXI.Texture, onclick: () => any) {
		this.parent = parent;
        this.label = label;
        this.container = new PIXI.Container();

        this.background = new PIXI.Sprite();
        this.container.addChild(this.background);

		this.text = new PIXI.Text(this.label);
		this.text.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			textBaseline: 'alphabetic'
        };
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
		this.pressdownInterpolator = new Interpolator({
			duration: 50,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});
		this.highlightInterpolator = new Interpolator({
			duration: 150,
			defaultToFinished: true,
			beginReversed: true
		});

		let registration = new InteractionRegistration(this.background);
		this.parent.interactionGroup.add(registration);

		registration.addButtonHandlers(
			onclick,
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.pressdownInterpolator.setReversedState(false, performance.now()),
			() => this.pressdownInterpolator.setReversedState(true, performance.now())
		);
	}

    resize() {
		let scalingFactor = this.parent.scalingFactor;

		this.background.texture = createPanelButtonTexture(scalingFactor);

        this.text.style.fontSize = Math.floor(9 * scalingFactor);
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
		let hoverCompletion = this.hoverInterpolator.getCurrentValue(now);
		let pressdownCompletion = this.pressdownInterpolator.getCurrentValue(now);

		this.background.alpha = hoverCompletion * 0.08 + pressdownCompletion * 0.12;

		let highlightCompletion = this.highlightInterpolator.getCurrentValue(now);
		let tint = lerpColors(Colors.White, THEME_COLORS.PrimaryBlue, highlightCompletion);
		this.text.tint = colorToHexNumber(tint);
		this.icon.tint = this.text.tint;
	}

	highlight() {
		this.highlightInterpolator.setReversedState(false, performance.now());
	}

	unhighlight() {
		this.highlightInterpolator.setReversedState(true, performance.now());
	}
}

class SideControlPulsar {
	private parent: SongSelectSideControlPanel;
	public container: PIXI.Container;
	
	private graphics: PIXI.Graphics;
	private hitbox: PIXI.Circle;
	private icon: PIXI.Sprite;

	private lastBeatTime: number = -Infinity;
    private analyser: AnalyserNodeWrapper;
	private hoverInterpolator: Interpolator;
	private pulseInterpolator: Interpolator;	

	constructor(parent: SongSelectSideControlPanel) {
		this.parent = parent;
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
        
        this.analyser = globalState.basicMediaPlayer.createAnalyser(2**15);

		this.initInteraction();
	}

	private initInteraction() {
		let interaction = new InteractionRegistration(this.container);
		this.parent.interactionGroup.add(interaction);
		interaction.enableEmptyListeners(['wheel']);
		interaction.setZIndex(1);

		interaction.addListener('mouseEnter', () => {
			this.hoverInterpolator.setReversedState(false, performance.now());
		});
		interaction.addListener('mouseLeave', () => {
			this.hoverInterpolator.setReversedState(true, performance.now());
		});
		interaction.addListener('mouseDown', () => {
			this.parent.songSelect.triggerSelectedBeatmap();
		});
	}

	resize() {
		let scalingFactor = this.parent.scalingFactor;

		let g = this.graphics;
        g.clear();

        g.beginFill(0xFF4572);
        g.drawCircle(0, 0, PULSAR_IDLE_RADIUS * scalingFactor);
        g.endFill();
        g.beginFill(0xffffff);
		g.drawCircle(0, 0, PULSAR_IDLE_RADIUS * 0.92 * scalingFactor);

		this.icon.scale.set(scalingFactor * 0.15);

		let shadowFilter = this.container.filters[0] as PIXI.filters.DropShadowFilter;
		shadowFilter.distance = 4 * scalingFactor;
	}

	update(now: number) {
		let currentExtendedData = this.parent.songSelect.selectedExtendedBeatmapData;

		if (currentExtendedData && currentExtendedData.msPerBeatTimings.length > 0) {
            let { msPerBeatTimings } = currentExtendedData;

			let currentTime = globalState.basicMediaPlayer.getCurrentTime() * 1000;
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

                    this.analyser.updateByteTimeDomainData();
					let timeDomainData = this.analyser.getByteTimeDomainBuffer();
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
		this.hitbox.radius = pulsarScale * PULSAR_IDLE_RADIUS * this.parent.scalingFactor;
	}

	resetLastBeatTime() {
		this.lastBeatTime = globalState.basicMediaPlayer.getCurrentTime() * 1000;
	}
}