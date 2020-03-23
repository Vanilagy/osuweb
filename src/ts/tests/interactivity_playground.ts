import { stage } from "../visuals/rendering";
import { rootInteractionGroup, InteractionRegistration, InteractionGroup } from "../input/interactivity";

let playgroundContainer = new PIXI.Container();
stage.addChild(playgroundContainer);

let obj = new PIXI.Graphics();
obj.beginFill(0xffffff);
obj.drawRect(0, 0, 500, 500);
obj.endFill();
playgroundContainer.addChild(obj);

let reg = new InteractionRegistration(obj);
rootInteractionGroup.add(reg);
reg.allowAllMouseButtons();

reg.addListener('mouseClick', (e) => {
	console.log("clicked")
});

reg.addListener('mouseDown', (e) => {
	console.log(e.button)
});