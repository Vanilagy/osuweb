import { HitObject } from "./hit_object";
import { Point } from "../util/point";

// Use enum here?
type SliderCurveSectionType = 'unknown' | 'perfect' | 'linear' | 'bézier';

interface Sampling {
    sampleSet: number,
    additionSet: number
}

export interface SliderCurveSection {
    type: SliderCurveSectionType,
    values: Point[]
}

export class Slider extends HitObject {
    public repeat: number;
    public length: number;
    public sections: SliderCurveSection[];
    public edgeHitSounds: number[] = [];
    public edgeSamplings: Sampling[] = [];

    constructor(data: string[]) {
        super(data);

        this.sections = this.parseSections(data);
        this.repeat = parseInt(data[6]);
        this.length = parseFloat(data[7]);

        if (data[8]) {
            let values = data[8].split('|');

            for (let i = 0; i < values.length; i++) {
                this.edgeHitSounds.push(parseInt(values[i]));
            }
        } else {
            this.edgeHitSounds.length = this.repeat + 1;
            this.edgeHitSounds.fill(0); // TODO. Does this default to 0?
        }

        if (data[9]) {
            let values = data[9].split('|');

            for (let i = 0; i < values.length; i++) {
                let val = values[i].split(':');

                this.edgeSamplings.push({
                    sampleSet: parseInt(val[0]),
                    additionSet: parseInt(val[1])
                });
            }
        } else {
            let defaultSampling: Sampling = {
                sampleSet: 0,
                additionSet: 0
            };

            this.edgeSamplings.length = this.repeat + 1;
            this.edgeSamplings.fill(defaultSampling);
        }

        this.parseExtras(data[10]);
    }

    parseSections(data: string[]) {
        let sliderPoints = data[5].split("|");

        let sliderType = sliderPoints[0];

        let sliderSections: SliderCurveSection[] = [];

        let sliderSectionPoints: Point[] = [{
            x: parseInt(data[0]),
            y: parseInt(data[1])
        }];

        let lastPoint = null;

        for (let j = 1; j < sliderPoints.length; j++) {
            let coords = sliderPoints[j].split(':');

            let nextPoint: Point = {
                x: parseInt(coords[0]),
                y: parseInt(coords[1])
            };

            // end section if same point appears twice and start a new one if end is not reached
            if (JSON.stringify(lastPoint) === JSON.stringify(nextPoint)) {
                this.finishSection(sliderSectionPoints, sliderType, sliderSections);

                // Don't make a new section in case this is the last point
                if (j + 1 !== sliderPoints.length) sliderSectionPoints = [];
            }

            sliderSectionPoints.push(nextPoint);

            if (j + 1 === sliderPoints.length) this.finishSection(sliderSectionPoints, sliderType, sliderSections);

            lastPoint = nextPoint;
        }

        return sliderSections;
    }

    finishSection(sliderSectionPoints: Point[], sliderType: string, sliderSections: SliderCurveSection[]) {
        let sectionType: SliderCurveSectionType = "unknown";

        if (sliderSectionPoints.length === 3 && sliderType === "P") {
            sectionType = "perfect";
        } else if (sliderSectionPoints.length === 2) {
            sectionType = "linear";
        } else {
            sectionType = "bézier";
        }

        if (sliderSectionPoints.length > 1) sliderSections.push({
            type: sectionType,
            values: sliderSectionPoints
        });
    }
}