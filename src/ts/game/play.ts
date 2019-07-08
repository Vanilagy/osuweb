import { ProcessedBeatmap } from "./processed_beatmap";
import { Beatmap } from "../datamodel/beatmap";
import { audioCtx, playbackRate, audioOffset, files, renderer, stage } from "../main";
import { DrawableCircle } from "./drawable_circle";
import { DrawableSlider } from "./drawable_slider";

export class Play {
    public processedBeatmap: ProcessedBeatmap;
    public audioStartTime: number | null;
    public currentHitObjectId: number;
    public onscreenObjects: { [s: string]: any };
    public pixelRatio: number | null;
    public circleDiameter: number | null;
    public ARMs: number;
    public audioOffset: number = 0;

    constructor(beatmap: Beatmap) {
        this.processedBeatmap = new ProcessedBeatmap(beatmap);

        this.audioStartTime = null;
        this.currentHitObjectId = 0;
        this.onscreenObjects = {};

        this.pixelRatio = null;
        this.circleDiameter = null;
        this.ARMs = this.processedBeatmap.beatmap.difficulty.getApproachTime();
    }
    
    init() {
        let screenHeight = window.innerHeight * 0.95;
        let screenWidth = screenHeight * (640 / 480);
        this.pixelRatio = screenHeight / 480;

        let osuCircleDiameter = this.processedBeatmap.beatmap.difficulty.getCirclePixelSize();
        this.circleDiameter = Math.round(osuCircleDiameter * this.pixelRatio);

        console.time("Beatmap init");
        this.processedBeatmap.init();
        console.timeEnd("Beatmap init");
        console.time("Beatmap draw");
        this.processedBeatmap.draw();
        console.timeEnd("Beatmap draw");
    }

    async start() {
        let audioBuffer = await this.getSongAudioBuffer();

        let gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.05, 0);
        gainNode.connect(audioCtx.destination);
        
        let sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.playbackRate.value = playbackRate;
        sourceNode.connect(gainNode);

        this.audioStartTime = audioCtx.currentTime;
        this.audioOffset = audioOffset;
        sourceNode.start(0, audioOffset / 1000);

        this.render();
    }

    getSongAudioBuffer() {
        let songFile = files!.find((file) => file.name === this.processedBeatmap.beatmap.audioFilename);

        return new Promise<AudioBuffer>((resolve) => {
            let reader = new FileReader();
            reader.onload = (result) => {
                let arrayBuffer = reader.result as ArrayBuffer;

                audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
                    resolve(buffer);
                });
            };
            reader.readAsArrayBuffer(songFile!);
        });
    }

    render() {
        //console.time("Render");

        let currentTime = this.getCurrentSongTime();

        for (let id in this.onscreenObjects) {
            let hitObject = this.onscreenObjects[id];
    
            hitObject.update(currentTime);

            if (hitObject instanceof DrawableCircle) {
                if (currentTime >= hitObject.hitObject.time) {
                    hitObject.remove(); 
                    delete this.onscreenObjects[id];
                }
            } else if (hitObject instanceof DrawableSlider) {
                if (currentTime >= hitObject.endTime) {
                    hitObject.remove();
                    delete this.onscreenObjects[id];
                }
            }
    
            
        }
    
        let hitObject = this.processedBeatmap.hitObjects[this.currentHitObjectId];
        while (hitObject && currentTime >= hitObject.hitObject.time - this.ARMs) {
            this.onscreenObjects[this.currentHitObjectId] = hitObject;
            hitObject.show(currentTime);
    
            hitObject = this.processedBeatmap.hitObjects[++this.currentHitObjectId];
        }
    
        renderer.render(stage);

        requestAnimationFrame(this.render.bind(this));

       // console.timeEnd("Render");
    }

    getCurrentSongTime() {
        return (audioCtx.currentTime - this.audioStartTime!) * 1000 * playbackRate + this.audioOffset;
    }
}