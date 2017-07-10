"use strict";

import {MathUtil} from "../../util/mathutil";

export class TransformationManager {
    constructor() {
        this._transformations = [];
    }

    addTransformation(transformation, keepStartTime = false) {
        if(!keepStartTime) transformation.startTime = window.performance.now();

        this._transformations.push(transformation);
    }

    update() {
        for(let key in this._transformations) {
            if(this._transformations[key].update()) {
                if(this._transformations[key].callback) this._transformations[key].callback();
                delete this._transformations[key];
            }
        }
    }
}

export let TRANSFORMATION_MANAGER = new TransformationManager();

export class Transformation {
    constructor(element, start, destination, duration, callback = null, unit = "%", easingType = "linear") {
        this.startTime = window.performance.now();
        this.duration = duration;
        this.start = start;
        this.destination = destination;
        this.element = element;

        this.callback = callback;

        this.easingType = easingType;
        this.unit = unit;

        this.cancelled = false;
    }

    cancel() {
        this.cancelled = true;
    }

    update() {
        throw new Error("Abstract Transformation can't be called!");
    }

    getCompletion() {
        return Math.min(1, (window.performance.now() - this.startTime) / this.duration);
    }

    isComplete() {
        return this.getCompletion() === 1 || this.cancelled;
    }
}

export class TransformationElementStyle extends Transformation {
    constructor(element, propertyName, start, destination, duration, callback = null, unit = "%", easingType = "linear") {
        super(element, start, destination, duration, callback, unit, easingType);

        this.start = start ? start : element.style[propertyName].substr(0, element.style[propertyName].length - unit.length);

        this.propertyName = propertyName;
    }

    update() {
        if(this.cancelled) return true;

        let completion = this.getCompletion();

        this.element.style[this.propertyName] = this.start + (this.destination - this.start) * MathUtil.ease(this.easingType, completion)+this.unit;

        return completion === 1;
    }
}

export class TransformationObjectField extends Transformation {
    constructor(element, propertyName, start, destination, duration, callback = null, easingType = "linear") {
        super(element, start, destination, duration, callback, "", easingType);

        this.start = start ? start : element[propertyName];

        this.propertyName = propertyName;
    }

    update() {
        if(this.cancelled) return true;

        let completion = this.getCompletion();

        this.element[this.propertyName] = this.start + (this.destination - this.start) * MathUtil.ease(this.easingType, this.getCompletion())+(this.unit.length > 0 ? this.unit : 0);

        return completion === 1;
    }
}

export class TransformationObjectMethod extends Transformation {
    constructor(element, propertyName, start, destination, duration, callback = null, easingType = "linear") {
        super(element, start, destination, duration, callback, "", easingType);

        this.propertyName = propertyName;
    }

    update() {
        if(this.cancelled) return true;

        let completion = this.getCompletion();

        this.element[this.propertyName](this.start + (this.destination - this.start) * MathUtil.ease(this.easingType, this.getCompletion())+(this.unit.length > 0 ? this.unit : 0));

        return completion === 1;
    }
}