import { hudContainer } from "../visuals/rendering";

export let scoreDisplay: PIXI.Text;
export let comboDisplay: PIXI.Text;

// Cheap temporary hack to ensure font load LOL
setTimeout(() => {
    scoreDisplay = new PIXI.Text("00000000", {
        fontFamily: "Bitmap",
        fontSize: 60,
        fill: "#FFFFFF"
    });
    
    scoreDisplay.pivot.x = scoreDisplay.width;
    scoreDisplay.x = window.innerWidth;
    
    comboDisplay = new PIXI.Text("0x", {
        fontFamily: "Bitmap",
        fontSize: 60,
        fill: "#FFFFFF"
    });
    
    comboDisplay.pivot.y = comboDisplay.height;
    comboDisplay.y = window.innerHeight;
    
    hudContainer.addChild(scoreDisplay);
    hudContainer.addChild(comboDisplay);
}, 500)
