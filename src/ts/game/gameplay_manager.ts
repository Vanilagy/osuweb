import { Hud } from "./hud/hud";

export class GameplayManager {
    public container: PIXI.Container;
    public hud: Hud;

    public hitObjectContainer: PIXI.Container;  
    public approachCircleContainer: PIXI.Container;
    public followPointContainer: PIXI.Container;
    public lowerScorePopupContainer: PIXI.Container; // The parts of score popups shown BELOW hit objects
    public upperScorePopupContainer: PIXI.Container; // The parts of score popups shown ABOVE hit objects

    constructor() {
        this.container = new PIXI.Container();
        this.hud = new Hud();

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
    }
}