import { Point } from "../util/point";
import { Color, colorToHexString } from "../util/graphics_util";
import { MathUtil } from "../util/math_util";
import { DrawSliderJob } from "../multithreading/job";

export function drawSliderCurve(canvas: HTMLCanvasElement | OffscreenCanvas, shapeData: DrawSliderJob["shapeData"], pixelRatio: number, circleDiameter: number, minX: number, minY: number, color: Color, sliderBodyRadius: number, sliderBorder: Color, sliderTrackOverride: Color) {
    let context = canvas.getContext('2d') as CanvasRenderingContext2D;

    function toCtxCoord(pos: Point): Point {
        return {
            x: (pos.x - minX) * pixelRatio + circleDiameter/2,
            y: (pos.y - minY) * pixelRatio + circleDiameter/2
        };
    }

    context.beginPath();

    if (shapeData.type === 'bézier') {
        let points = shapeData.points;

        let startPoint = toCtxCoord(points[0]);
        context.moveTo(startPoint.x, startPoint.y);
    
        for (let i = 1; i < points.length; i++) {
            let point = points[i];
    
            point = toCtxCoord(point);
            context.lineTo(point.x, point.y);
    
            /*
            if (SLIDER_SETTINGS.debugDrawing) {
                this.slider.baseCtx.beginPath();
                this.slider.baseCtx.arc(point.x, point.y, 1, 0, Math.PI * 2);
                this.slider.baseCtx.fillStyle = "white";
                this.slider.baseCtx.fill();
            }*/
        }
    } else {
        //let pixelRatio = gameState.currentPlay.pixelRatio;
        let centerPos = toCtxCoord(shapeData.centerPos);
        //let angleDifference = this.angleDifference * completion;

        context.beginPath();
        context.arc(centerPos.x, centerPos.y, shapeData.radius * pixelRatio, shapeData.startingAngle, shapeData.startingAngle + shapeData.angleDifference, shapeData.angleDifference < 0);
    }

    




    context.lineWidth = circleDiameter * 0.92;
    context.strokeStyle = colorToHexString(sliderBorder);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalCompositeOperation = "source-over";
    //context.stroke();

    let sliderColor: Color;
    if (sliderTrackOverride) {
        sliderColor = sliderTrackOverride;
    } else {
        sliderColor = color;
    }

    let targetRed = Math.min(255, sliderColor.r * 1.125 + 75),
        targetGreen = Math.min(255, sliderColor.g * 1.125 + 75),
        targetBlue = Math.min(255, sliderColor.b * 1.125 + 75);

    // Gradient
    for (let i = sliderBodyRadius; i > 1; i -= 2) {
        context.lineWidth = i * 2;
        let brightnessCompletion = 1 - (i / sliderBodyRadius); // 0 -> Border, 1 -> Center

        let red = MathUtil.lerp(sliderColor.r, targetRed, brightnessCompletion),
            green = MathUtil.lerp(sliderColor.g, targetGreen, brightnessCompletion),
            blue = MathUtil.lerp(sliderColor.b, targetBlue, brightnessCompletion);

        context.strokeStyle = `rgb(${red | 0},${green | 0},${blue | 0})`;
        context.stroke();
    }
    context.lineWidth = sliderBodyRadius * 2;
    context.strokeStyle = "rgba(255,255,255,0.333)";
    context.globalCompositeOperation = "destination-out"; // Transparency
    //context.stroke();
}