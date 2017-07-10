"use strict";

import {MathUtil} from "../../util/mathutil";

export class TransformationManager {
    constructor() {
        this._transformations = [];
    }

    /**
     * Adds a {Transformation} to start executing it.
     * @param transformation - The {Transformation} to execute
     * @param keepStartTime - Whether to keep the {Transformation.startTime} that is currently set. false by default.
     */
    addTransformation(transformation, keepStartTime = false) {
        if(!keepStartTime) transformation.startTime = window.performance.now();

        this._transformations.push(transformation);
    }

    update() {
        for(let key in this._transformations) {
            if(this._transformations[key].update()) {
                if(this._transformations[key].callback) this._transformations[key].callback(!this._transformations[key].cancelled);
                delete this._transformations[key];
            }
        }
    }
}

export let TRANSFORMATION_MANAGER = new TransformationManager();

export class Transformation {
    constructor(element, start, destination, duration, easingType = "linear") {
        this.startTime = window.performance.now();
        this.duration = duration;
        this.start = start;
        this.destination = destination;
        this.element = element;
        this.easingType = easingType;

        this.unit = "";

        this.loop = false;
        this.infinite = false;

        this.cancelled = false;

        // Variable used to determine when to call the callback when looping is enabled
        this.loopsFinished = 0;
    }

    /**
     * @param callback - The callback to execute. It receives one parameter indicating if the Transformation was cancelled or not (false if cancelled)
     * @returns {Transformation}
     */
    setCallback(callback) {
        this.callback = callback;
        return this;
    }

    /**
     * Adds a delay of this transformation. The first execution of this transformation will only start
     * @param delay - The time this tranformation will wait before it starts to get executed.
     * @returns {Transformation}
     */
    addDelay(delay) {
        this.startTime += delay;
        return this;
    }

    /**
     * @param unit - A string representing an unit value which will be appended to the end of the return value. Note: If this is set all return types turn to strings!
     * @returns {Transformation}
     */
    setUnit(unit) {
        this.unit = unit;
        return this;
    }

    /**
     * Enables looping for this transformation. {Transformation.duration} will become the interval and this transformation will be infinite. See {Transformation.setInfinite()}
     * The callback will trigger after each loop if this is enabled. To remove this transformation call {Transformation.cancel}.
     * @returns {Transformation}
     */
    setLooping() {
        this.loop = true;
        this.infinite = true;
        return this;
    }

    /**
     * Marks this transformation as infinite. Execution will proceed as normal, but this {Transformation} won't be cleaned up until {Transformation.cancel()} is called.
     * @returns {Transformation}
     */
    setInfinite() {
        this.infinite = true;
        return this;
    }

    /**
     * Adds this {Transformation} to the {TransformationManager} instance. This call does not reset {Transformation.startTime}
     * @returns {Transformation}
     */
    submit() {
        TRANSFORMATION_MANAGER.addTransformation(this, true);
        return this;
    }

    /**
     *  Resets the transformation, making the time and value jump back to the start.
     *  Call this before the transformation ends, or make this transformation infinite.
     *  @param delay - Add an extra delay before this animation is executed again
     */
    reset(delay = 0) {
        this.startTime = window.performance.now() + delay;
    }

    /**
     * Cancels this transformation, instantly stopping and removing it on the next update
     * of the {TransformationManager}
     */
    cancel() {
        this.cancelled = true;
    }

    /**
     * Updates the value of the element associated with this transformation
     * @returns {boolean} Whether the transformation is finished and should be removed.
     */
    update() {
        let completion = this.getCompletion();

        if(!this.shouldUpdate()) return this.isFinished(completion === 1);

        this.doUpdate(completion);

        return this.isFinished(completion === 1);
    }

    doUpdate(completion) {
        throw new Error("No update procedure defined!");
    }

    /**
     * Returns the completion from 0-1
     * @returns {number}
     */
    getCompletion() {
        let timePassed = (window.performance.now() - this.startTime);

        if(this.loop) {
            // Call callback for each finished loop
            if(this.callback) {
                let loopsFinished = Math.floor(timePassed / this.duration);

                let difference = loopsFinished - this.loopsFinished;

                for (let i = 0; i < difference; i++) this.callback(true);

                this.loopsFinished = loopsFinished;
            }

            timePassed %= this.duration;
        }

        // clamp the returned value
        return Math.min(1, Math.max(0, timePassed / this.duration));
    }

    /**
     * Whether this Transformation is ready to be cleaned up on the next update.
     * @returns {boolean}
     */
    isFinished(complete) {
        return (complete && !this.infinite) || this.cancelled;
    }

    /**
     * Whether {Transformation.update()} should be called right now.
     */
    shouldUpdate() {
        return !this.cancelled && (window.performance.now() >= this.startTime && (window.performance.now() <= this.startTime + this.duration || this.loop));
    }
}

/**
 * A transformation class to modify the style of DOM elements. This adds a unit to the end of the expression ('%' by default).
 */
export class TransformationElementStyle extends Transformation {
    constructor(element, propertyName, start, destination, duration, easingType = "linear") {
        super(element, start, destination, duration, easingType);

        this.unit = "%";
        this.start = start ? start : element.style[propertyName].substr(0, element.style[propertyName].length - unit.length);

        this.propertyName = propertyName;
    }

    doUpdate(completion) {
        this.element.style[this.propertyName] = this.start + (this.destination - this.start) * MathUtil.ease(this.easingType, completion)+this.unit;
    }
}

export class TransformationObjectField extends Transformation {
    constructor(element, propertyName, start, destination, duration, easingType = "linear") {
        super(element, start, destination, duration, easingType);

        this.start = start ? start : element[propertyName];

        this.propertyName = propertyName;
    }

    doUpdate(completion) {
        this.element[this.propertyName] = this.start + (this.destination - this.start) * MathUtil.ease(this.easingType, this.getCompletion())+(this.unit.length > 0 ? this.unit : 0);
    }
}

export class TransformationObjectMethod extends Transformation {
    constructor(element, propertyName, start, destination, duration, easingType = "linear") {
        super(element, start, destination, duration, easingType);

        this.propertyName = propertyName;
    }

    doUpdate(completion) {
        this.element[this.propertyName](this.start + (this.destination - this.start) * MathUtil.ease(this.easingType, this.getCompletion())+(this.unit.length > 0 ? this.unit : 0));
    }
}