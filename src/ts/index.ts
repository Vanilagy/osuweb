import './visuals/ui';
import './visuals/simple_beatmap_selector';
import { initHud } from './game/hud';
import { baseSkin } from './game/skin';

const osu: string | null = 'ORERU!';

async function init() {
    await baseSkin.init();
    await initHud();

    console.log(osu!); // Love the syntax <3
}

window.addEventListener('load', init);