import { OsuTexture } from "./texture";
import { MathUtil } from "../../util/math_util";

export class AnimatedOsuSprite {
    public sprite: PIXI.Sprite;
    public loop: boolean = true;
    private fps: number = 1;
    private osuTexture: OsuTexture;
    private scalingFactor: number;
    private startTime: number = null;
    private currentFrame: number;

    constructor(osuTexture: OsuTexture, scalingFactor: number) {
        this.osuTexture = osuTexture;
        this.scalingFactor = scalingFactor;

        this.sprite = new PIXI.Sprite();
        this.sprite.anchor.set(0.5, 0.5);

        this.setFrame(0);
    }

    getFrameCount() {
        return this.osuTexture.getAnimationFrameCount();
    }

    setFrame(frame: number) {
        if (frame === this.currentFrame) return;
        this.currentFrame = frame;

        let resolution = this.osuTexture.getOptimalResolution(this.osuTexture.getBiggestDimension(this.scalingFactor, frame), frame);
        let tex = this.osuTexture.getForResolution(resolution, frame);
        let width = this.osuTexture.getWidthForResolution(resolution, frame) * this.scalingFactor;
        let height = this.osuTexture.getHeightForResolution(resolution, frame) * this.scalingFactor;

        this.sprite.texture = tex;
        this.sprite.width = width;
        this.sprite.height = height;
    }

    setFps(fps: number) {
        this.fps = fps || 1;
    }

    play(time: number) {
        this.startTime = time;
    }

    stop() {
        this.startTime = null;
    }

    update(time: number) {
        let frameCount = this.osuTexture.getAnimationFrameCount();
        if (this.startTime === null || frameCount === 0) return;

        let elapsed = time - this.startTime;
        let frame = Math.floor(this.fps * (elapsed / 1000));
        frame = Math.max(0, frame);

        if (this.loop) {
            frame = frame % frameCount;
        } else {
            frame = MathUtil.clamp(frame, 0, frameCount-1);
        }
        
        this.setFrame(frame);
    }
}