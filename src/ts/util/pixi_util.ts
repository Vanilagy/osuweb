import { MathUtil, TAU } from "./math_util";
import { pointAngle } from "./point";

// The definition of "basic" is kind of ambiguous here, but I don't know what else to call it.
export function transferBasicProperties(source: PIXI.Container, target: PIXI.Container) {
	target.position.copyFrom(source.position);
	target.rotation = source.rotation;
	target.scale.copyFrom(source.scale);
	target.pivot.copyFrom(source.pivot);
}

export function transferBasicSpriteProperties(source: PIXI.Sprite, target: PIXI.Sprite) {
	target.texture = source.texture;
	target.width = source.width;
	target.height = source.height;
	target.anchor.copyFrom(source.anchor);
}

export function fitSpriteIntoContainer(sprite: PIXI.Sprite, containerWidth: number, containerHeight: number, anchorPoint = new PIXI.Point(0.5, 0.5)) {
	let texture = sprite.texture;
	let ratio = texture.height/texture.width;

	if (containerWidth * ratio >= containerHeight) {
		sprite.width = containerWidth;
		sprite.height = containerWidth * ratio;
		
		let spare = containerWidth * ratio - containerHeight;
		sprite.y = -spare * anchorPoint.y;
		sprite.x = 0;
	} else {
		sprite.height = containerHeight;
		sprite.width = containerHeight / ratio;

		let spare = containerHeight / ratio - containerWidth;
		sprite.x = -spare * anchorPoint.x;
		sprite.y = 0;
	}
}

export function createPolygonTexture(width: number, height: number, polygon: PIXI.Point[], scalingFactor = 1.0, margin = 0, invert = false, cornerRadius = 0) {
	let canvas = document.createElement('canvas');
	let ctx = canvas.getContext('2d');

	canvas.setAttribute('width', String(Math.ceil((width + 2*margin) * scalingFactor)));
	canvas.setAttribute('height', String(Math.ceil((height + 2*margin) * scalingFactor)));

	let points = polygon;

	// Shrink the polygon points based on corner radius
	if (cornerRadius > 0) {
		let newPoints: PIXI.Point[] = [];

		let clockwiseSum = 0,
			counterClockwiseSum = 0;
		for (let i = 0; i < points.length; i++) {
			let p0 = points[MathUtil.adjustedMod(i-1, points.length)],
				p1 = points[i],
				p2 = points[(i+1) % points.length];
			
			let a1 = pointAngle(p0, p1),
				a2 = pointAngle(p1, p2);
			let angle = Math.PI - MathUtil.getNormalizedAngleDelta(a1, a2);

			clockwiseSum += angle;
			counterClockwiseSum += TAU - angle;
		}

		// If the points are wound clockwise, then the clockwise sum of angles will be smaller than the counter-clockwise one. Thus, we can conclude that if this is not the case, the points must be wound counter-clockwise.
		let isCounterClockwise = clockwiseSum > counterClockwiseSum;

		for (let i = 0; i < points.length; i++) {
			let p0 = points[MathUtil.adjustedMod(i-1, points.length)],
				p1 = points[i],
				p2 = points[(i+1) % points.length];
			
			let a1 = pointAngle(p0, p1),
				a2 = pointAngle(p1, p2);
			let angle = Math.PI - MathUtil.getNormalizedAngleDelta(a1, a2);

			let bisectorAngle = a2 + angle/2;
			let requiredDistance = Math.abs(cornerRadius / Math.sin(angle / 2));
			if (isCounterClockwise) requiredDistance *= -1;
			
			newPoints.push(new PIXI.Point(
				p1.x + Math.cos(bisectorAngle) * requiredDistance,
				p1.y + Math.sin(bisectorAngle) * requiredDistance
			));
		}

		points = newPoints;
	}

	ctx.beginPath();
	for (let i = 0; i < points.length; i++) {
		let p = points[i];

		let x = Math.floor((p.x + margin) * scalingFactor),
			y = Math.floor((p.y + margin) * scalingFactor);
		
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}

	ctx.closePath();
	ctx.fillStyle = '#ffffff';
	ctx.fill();

	if (cornerRadius > 0) {
		ctx.strokeStyle = '#ffffff';
		ctx.lineJoin = 'round';
		ctx.lineWidth = cornerRadius*2 * scalingFactor;
		ctx.stroke();
	}

	if (invert) {
		ctx.globalCompositeOperation = 'source-out';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

	return PIXI.Texture.from(canvas);
}

export function createLinearGradientTexture(width: number, height: number, start: PIXI.Point, end: PIXI.Point, colorStops: [number, string][], scalingFactor = 1.0) {
	let canvas = document.createElement('canvas');
	let ctx = canvas.getContext('2d');

	canvas.setAttribute('width', String(Math.ceil(width * scalingFactor)));
	canvas.setAttribute('height', String(Math.ceil(height * scalingFactor)));

	let gradient = ctx.createLinearGradient(start.x * scalingFactor, start.y * scalingFactor, end.x * scalingFactor, end.y * scalingFactor);
	for (let cs of colorStops) gradient.addColorStop(MathUtil.clamp(cs[0], 0, 1), cs[1]);

	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	return PIXI.Texture.from(canvas);
}

// TODO: Support non-square SVGs
export function svgToTexture(svgImageElement: HTMLImageElement, makeWhite = false) {
	let canvas = document.createElement('canvas');
	let ctx = canvas.getContext('2d');

	canvas.setAttribute('width', '256');
	canvas.setAttribute('height', '256');

	ctx.drawImage(svgImageElement, 0, 0, 256, 256);

	if (makeWhite) {
		ctx.fillStyle = '#ffffff';
		ctx.globalCompositeOperation = 'source-in';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

	return PIXI.Texture.from(canvas);
}