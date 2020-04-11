import { StoryboardParser } from "../game/storyboard/storyboard_parser";

let storyboardText = `
[Variables]
$test=9
[Events]
//Background and Video events
//Storyboard Layer 0 (Background)
//Storyboard Layer 1 (Fail)
//Storyboard Layer 2 (Pass)
//Storyboard Layer 3 (Foreground)
Sprite,Foreground,Centre,"cb1b75ddbfde4e8cdde980d06b5db037.png",320,240
 M,1,25,932,299.0546,230.6909,91.55424,115.4144
 M,2,932,1499,91.55424,115.4144,502.1091,164.3636
 L,0,$test
  M,1,25,932,299.0546,230.6909,91.55424,115.4144
Animation,Foreground,Centre,"cb1b75ddbfde4e8cdde980d06b5db037.png",320,240,6,300,LoopForever
Sample,1234,Foreground,"audio.wav",100
//Storyboard Layer 4 (Overlay)
//Storyboard Sound Samples
`;

//let input = prompt();
let input = storyboardText;

console.time()
console.log(StoryboardParser.parse(input));
console.timeEnd();