import { hudContainer } from "../visuals/rendering";

export let scoreDisplay: PIXI.Text;
export let comboDisplay: PIXI.Text;
export let accuracyDisplay: PIXI.Text;
export let progressIndicator: ProgressIndicator;

// Cheap temporary hack to ensure font load LOL
setTimeout(() => {
    scoreDisplay = new PIXI.Text("00000000", {
        fontFamily: "Bitmap",
        fontSize: 60,
        fill: "#FFFFFF"
    });
    
    scoreDisplay.anchor.x = 1.0;
    scoreDisplay.x = window.innerWidth;
    
    comboDisplay = new PIXI.Text("0x", {
        fontFamily: "Bitmap",
        fontSize: 60,
        fill: "#FFFFFF"
    });
    
    comboDisplay.anchor.y = 1.0;
    comboDisplay.y = window.innerHeight;

    accuracyDisplay = new PIXI.Text("100.00%", {
        fontFamily: "Bitmap",
        fontSize: 40,
        fill: "#FFFFFF"
    });
    
    //accuracyDisplay.pivot.x = accuracyDisplay.width;
    accuracyDisplay.anchor.x = 1.0;
    accuracyDisplay.x = window.innerWidth;
    accuracyDisplay.y = scoreDisplay.height + 5;

    progressIndicator = new ProgressIndicator();
    
    hudContainer.addChild(scoreDisplay);
    hudContainer.addChild(comboDisplay);
    hudContainer.addChild(accuracyDisplay);
    hudContainer.addChild(progressIndicator.container);
}, 500);

const PROGRESS_INDICATOR_DIAMETER = 36;

class ProgressIndicator {
    public container: PIXI.Container;
    private ctx: CanvasRenderingContext2D;

    constructor() {
        let sprite = new PIXI.Sprite();

        let canvas = document.createElement('canvas');
        canvas.setAttribute('width', String(Math.ceil(PROGRESS_INDICATOR_DIAMETER)));
        canvas.setAttribute('height', String(Math.ceil(PROGRESS_INDICATOR_DIAMETER)));
        let ctx = canvas.getContext('2d');
        this.ctx = ctx;

        let texture = PIXI.Texture.from(canvas);
        sprite.texture = texture;

        sprite.width = PROGRESS_INDICATOR_DIAMETER;
        sprite.height = PROGRESS_INDICATOR_DIAMETER;
        sprite.pivot.x = sprite.width / 2;
        sprite.pivot.y = sprite.height / 2;
        // SO UNCLEAN OMG! TEMP! TODO!!
        sprite.x = window.innerWidth - accuracyDisplay.width - 30;
        sprite.y = accuracyDisplay.y + accuracyDisplay.height / 2;

        this.container = sprite;

        this.draw(0, false);
    }

    draw(completion: number, isPrelude: boolean) {
        let ctx = this.ctx;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        let radius = PROGRESS_INDICATOR_DIAMETER / 2;
        let lineWidth = 2;
        let startAngle = -Math.PI / 2; // "North"
        let endAngle = startAngle + Math.PI*2 * completion;

        ctx.strokeStyle = '#AAAAAA';
        if (isPrelude) { // "Invert" the arc
            let temp = startAngle;
            startAngle = endAngle;
            endAngle = temp;

            ctx.strokeStyle = '#799634';
        }

        ctx.lineWidth = radius - lineWidth / 2;
        ctx.beginPath();
        ctx.arc(radius, radius, radius/2, startAngle, endAngle);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(radius, radius, radius - lineWidth/2, 0, Math.PI*2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(radius, radius, radius / 10, 0, Math.PI*2);
        ctx.fill();

        let sprite = this.container as PIXI.Sprite;
        sprite.texture.update();
    }
}