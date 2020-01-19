import { stage } from "../visuals/rendering";
import { Interactivity } from "../input/interactivity";

let playgroundContainer = new PIXI.Container();
stage.addChild(playgroundContainer);

let obj1 = new PIXI.Graphics();
obj1.beginFill(0xffffff);
obj1.drawRect(0, 0, 500, 500);
obj1.endFill();

let obj2 = new PIXI.Graphics();
obj2.beginFill(0xff0000);
obj2.drawRect(0, 0, 200, 200);
obj2.endFill();

obj1.position.set(200, 200);
obj2.position.set(300, 300);

playgroundContainer.addChild(obj1, obj2);

let reg1 = Interactivity.registerDisplayObject(obj1);
let group = Interactivity.createGroup();
let reg2 = Interactivity.registerDisplayObject(obj2);
group.add(reg2);
//group.passThrough = true;

reg1.addListener('mouseEnter', () => {
	obj1.alpha = 0.5;
});

reg1.addListener('mouseLeave', () => {
	obj1.alpha = 1.0;
});

reg2.addListener('mouseEnter', () => {
	//console.log(2);
});