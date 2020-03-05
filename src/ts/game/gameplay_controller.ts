import { Hud } from "./hud/hud";
import { Beatmap } from "../datamodel/beatmap";
import { ProcessedBeatmap } from "../datamodel/processed/processed_beatmap";
import { IGNORE_BEATMAP_SKIN } from "./skin/skin";
import { Play } from "./play";
import { PauseScreen } from "../menu/gameplay/pause_screen";
import { InteractionGroup, Interactivity } from "../input/interactivity";

export class GameplayController {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public hud: Hud;
	public pauseScreen: PauseScreen;

    public hitObjectContainer: PIXI.Container;  
    public approachCircleContainer: PIXI.Container;
    public followPointContainer: PIXI.Container;
    public lowerScorePopupContainer: PIXI.Container; // The parts of score popups shown BELOW hit objects
	public upperScorePopupContainer: PIXI.Container; // The parts of score popups shown ABOVE hit objects
	
	public currentPlay: Play = null;

    constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = Interactivity.createGroup();
		this.hud = new Hud(this);
		this.pauseScreen = new PauseScreen(this);

        this.hitObjectContainer = new PIXI.Container();
        this.hitObjectContainer.sortableChildren = true;
        this.approachCircleContainer = new PIXI.Container();
        this.followPointContainer = new PIXI.Container();
        this.lowerScorePopupContainer = new PIXI.Container();
        this.upperScorePopupContainer = new PIXI.Container();

        // The order of these is important, 'cause z-index 'n' stuff.
        this.container.addChild(this.lowerScorePopupContainer);
        this.container.addChild(this.followPointContainer);
        this.container.addChild(this.hitObjectContainer);
        this.container.addChild(this.approachCircleContainer);
        this.container.addChild(this.upperScorePopupContainer);
		this.container.addChild(this.hud.container);
		this.container.addChild(this.pauseScreen.container);

		this.interactionGroup.add(this.pauseScreen.interactionGroup);
		
		this.resize();
	}
	
	async startPlayFromBeatmap(beatmap: Beatmap) {
		let processedBeatmap = new ProcessedBeatmap(beatmap, !IGNORE_BEATMAP_SKIN);
	
		let newPlay = new Play(this, processedBeatmap);
		this.currentPlay = newPlay;
	
		await newPlay.init();
		this.hud.init();

		await newPlay.start();
	}

	resize() {
		this.hud.resize();
		this.pauseScreen.resize();
	}

	pause() {
		if (!this.currentPlay || this.currentPlay.paused) return;

		this.pauseScreen.show();
		this.currentPlay.pause();
	}

	unpause() {
		if (!this.currentPlay || !this.currentPlay.paused) return;

		this.pauseScreen.hide();
		this.currentPlay.unpause();
	}

	restart() {
		if (!this.currentPlay) return;

		this.pauseScreen.hide();
		this.currentPlay.restart();
	}
}