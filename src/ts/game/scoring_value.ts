export enum ScoringValue {
    NotHit = null, // Maybe rename this. Because logically, not hit = missed. But I mean like "Not hit yet" or "Has not tried to hit"
    Hit300 = 300,
    Hit100 = 100,
    Hit50 = 50,
    Miss = 0,
    SliderHead = 30,
    SliderTick = 10,
    SliderRepeat = 30,
    SliderEnd = 30
}