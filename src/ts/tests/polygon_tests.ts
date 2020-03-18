import { createPolygonTexture } from "../util/pixi_util";
import { stage } from "../visuals/rendering";

let points = [
	new PIXI.Point(200, 200), new PIXI.Point(300, 200), new PIXI.Point(350, 280), new PIXI.Point(500, 230), new PIXI.Point(500, 500), new PIXI.Point(200, 500)
];
//points.reverse();

let polygonTexture = createPolygonTexture(1000, 1000, points, 1.0, 0, false, 30);
let sprite = new PIXI.Sprite(polygonTexture);
let polygonTextureRaw = createPolygonTexture(1000, 1000, points, 1.0, 0, false);
let spriteRaw = new PIXI.Sprite(polygonTextureRaw);
spriteRaw.tint = 0xff0000;
spriteRaw.alpha = 0.0;

stage.addChild(sprite, spriteRaw);