import { AnimationParameterList, Animation, AnimationEvent, AnimationPlayer } from "../util/animation";
import { addRenderingTask, stage } from "../visuals/rendering";
import { EaseType } from "../util/math_util";

let container = new PIXI.Container;
container.x = 100;
container.y = 100;
stage.addChild(container);

let parameters = new AnimationParameterList({
	one: 0,
	two: 0
});
let animation = new Animation(parameters);

animation.addEvent(new AnimationEvent('one', {start: 500, duration: 1500, to: 1, ease: EaseType.EaseInOutQuart}));
animation.addEvent(new AnimationEvent('one', {start: 2000, duration: 1000, to: 0.5, ease: EaseType.EaseInOutQuart}));
animation.addEvent(new AnimationEvent('two', {start: 0, duration: 5000, to: 1, ease: EaseType.EaseInOutSine}));

let player = new AnimationPlayer(animation);

let box1 = new PIXI.Sprite(PIXI.Texture.WHITE);
box1.tint = 0xff0000;
box1.width = 50;
box1.height = 50;
box1.y = 0;

let box2 = new PIXI.Sprite(PIXI.Texture.WHITE);
box2.width = 50;
box2.height = 50;
box2.y = 100;

container.addChild(box1, box2);

player.start(performance.now());
addRenderingTask((now) => {
	player.update(now)

	box1.x = player.getParameter('one') * 300;
	box2.x = player.getParameter('two') * 300;
});