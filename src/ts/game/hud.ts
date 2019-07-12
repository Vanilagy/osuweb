import { hudContainer } from "../visuals/rendering";

export let scoreDisplay: PIXI.Text;
export let comboDisplay: PIXI.Text;
export let accuracyDisplay: PIXI.Text;

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
    accuracyDisplay.y = scoreDisplay.height;
    
    hudContainer.addChild(scoreDisplay);
    hudContainer.addChild(comboDisplay);
    hudContainer.addChild(accuracyDisplay);
}, 500)
