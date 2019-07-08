import { Beatmap } from "./datamodel/beatmap";
import { Play } from "./game/play";
import { gameState } from "./game/game_state";

const beatmapFileSelect = document.querySelector('#beatmapSelect') as HTMLInputElement;
const mainCanvas = document.querySelector('#mainCanvas') as HTMLCanvasElement;

export let audioCtx = new AudioContext();
export let files: File[] = [];

export const playfieldDimensions = {
    width: 512,
    height: 384
};

beatmapFileSelect.addEventListener('change', (e) => {
    let fileArr = [...beatmapFileSelect.files!];
    files.push(...fileArr);

    let beatmapNames: string[] = [];
    for (let file of fileArr) {
        if (file.name.endsWith('.osu')) {
            beatmapNames.push(file.name);
        }
    }

    let selectedId: number = null;
    if (beatmapNames.length === 1) selectedId = 0;
    else {
        let promptStr = 'Select a beatmap by entering the number:\n';
        beatmapNames.forEach((value, index) => {
            promptStr += index + ': ' + value + '\n';
        });

        let selection = prompt(promptStr);
        if (selection !== null) selectedId = Number(selection);
    }

    if (selectedId === null) return;

    new Beatmap(fileArr.find((file) => file.name === beatmapNames[selectedId])!, (map) => {
        console.log("Beatmap parsed.", map);
        startPlay(map);
    });
});

export const playbackRate = 1;
export const audioOffset = 0;

function startPlay(beatmap: Beatmap) {
    audioCtx.resume();
    beatmapFileSelect.style.display = 'none';

    let newPlay = new Play(beatmap);
    gameState.currentPlay = newPlay;

    newPlay.init();
    newPlay.start();
}

let context = mainCanvas.getContext('webgl2', {
    stencil: true,
    alpha: true,
    powerPreference: 'high-performance',
    desynchronized: true
});

export let renderer = new PIXI.Renderer({
    width: window.innerWidth,
    height: window.innerHeight,
    context: context
});
export let stage = new PIXI.Container();

export let mainHitObjectContainer = new PIXI.Container();
export let approachCircleContainer = new PIXI.Container();

stage.addChild(mainHitObjectContainer);
stage.addChild(approachCircleContainer);

export let approachCircleTexture = PIXI.Texture.from("./assets/img/approach_circle.png");

function onResize() {
    let width = window.innerWidth,
        height = window.innerHeight;

    mainCanvas.setAttribute('width', String(width));
    mainCanvas.setAttribute('height', String(height));

    renderer.resize(width, height);
}
onResize();

window.addEventListener('resize', onResize);