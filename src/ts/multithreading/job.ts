import { Point } from "../util/point";
import { Color } from "../util/graphics_util";

export enum JobTask {
    RememberSlider,
    DrawSlider,
    DrawSliderByIndex
}

export interface Job {
    task: JobTask,
    id?: number
}

export interface DrawSliderJob extends Job {
    //task: JobTask.DrawSlider, // dirty as shit, TODO
    sliderIndex: number,
    shapeData: {
        type: 'bézier' | 'perfect',
        centerPos?: Point,
        startingAngle?: number,
        angleDifference?: number,
        radius?: number,
        points?: Point[]
    },
    canvas: HTMLCanvasElement | OffscreenCanvas,
    screenPixelRatio: number,
    circleDiameter: number,
    minX: number,
    minY: number,
    color: Color,
    sliderBodyRadius: number,
    sliderBorder: Color,
    sliderTrackOverride: Color
}


export interface DrawSliderByIndexJob extends Job {
    task: JobTask.DrawSliderByIndex,
    sliderIndex: number
}

export interface JobContainer {
    job: Job,
    transfer: (Transferable | OffscreenCanvas)[]
};

export interface JobMessageWrapper {
    id: number,
    jobs: Job[]
};