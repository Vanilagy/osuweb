"use strict";

import {MathUtil} from "../../util/mathutil";

class TransformationManager {
    constructor() {
        /**
         * @type {Transformation[]}
         * @private
         */
        this._transformations = [];
    }

    /**
     * Adds a {Transformation} to start executing it.
     * @param {Transformation} transformation - The {Transformation} to execute
     * @param {boolean} keepStartTime - Whether to keep the {Transformation.startTime} that is currently set. false by default.
     */
    addTransformation(transformation, keepStartTime = false) {
        if(!keepStartTime) transformation._startTime = window.performance.now();

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

/**
 * @type {TransformationManager}
 */
export let TRANSFORMATION_MANAGER = new TransformationManager();

/**
 * @abstract
 */
export class Transformation {
    /**
     * @param {HTMLElement|object} element
     * @param {number} start
     * @param {number} destination
     * @param {number} duration
     * @param {string} [easingType]
     * @public
     */
    constructor(element, start, destination, duration, easingType = "linear") {
        /**
         * @type {number}
         * @protected
         */
        this._startTime = window.performance.now();
        /**
         * @type {number}
         * @protected
         */
        this._duration = duration;
        /**
         * @type {number}
         * @protected
         */
        this._start = start;
        /**
         * @type {number}
         * @protected
         */
        this._destination = destination;
        /**
         * @type {*}
         * @protected
         */
        this._element = element;
        /**
         * @type {string}
         * @protected
         */
        this._easingType = easingType;

        /**
         * @type {string}
         * @protected
         */
        this._unit = "";

        /**
         * @type {boolean}
         * @protected
         */
        this._loop = false;
        /**
         * @type {boolean}
         * @protected
         */
        this._infinite = false;

        /**
         * @type {boolean}
         * @protected
         */
        this._cancelled = false;

        /**
         * Variable used to determine when to call the callback when looping is enabled
         * @type {number}
         * @protected
         */
        this._loopsFinished = 0;
    }

    /**
     * @param {?function} callback - The callback to execute. It receives one parameter indicating if the Transformation was cancelled or not (false if cancelled)
     * @returns {Transformation}
     * @public
     */
    setCallback(callback) {
        this._callback = callback;
        return this;
    }

    /**
     * Adds a delay of this transformation. The first execution of this transformation will only start
     * @param {!number} delay - The time this tranformation will wait before it starts to get executed.
     * @returns {Transformation}
     * @public
     */
    addDelay(delay) {
        this._startTime += delay;
        return this;
    }

    /**
     * @param {!string} unit - A string representing an unit value which will be appended to the end of the return value. Note: If this is set all return types turn to strings!
     * @returns {Transformation}
     * @public
     */
    setUnit(unit) {
        this._unit = unit;
        return this;
    }

    /**
     * Enables looping for this transformation. {Transformation.duration} will become the interval and this transformation will be infinite. See {Transformation.setInfinite()}
     * The callback will trigger after each loop if this is enabled. To remove this transformation call {Transformation.cancel}.
     * @returns {Transformation}
     * @public
     */
    setLooping() {
        this._loop = true;
        this._infinite = true;
        return this;
    }

    /**
     * Marks this transformation as infinite. Execution will proceed as normal, but this {Transformation} won't be cleaned up until {Transformation.cancel()} is called.
     * @returns {Transformation}
     * @public
     */
    setInfinite() {
        this._infinite = true;
        return this;
    }

    /**
     * Adds this {Transformation} to the {TransformationManager} instance. This call does not reset {Transformation.startTime}
     * @returns {Transformation}
     * @public
     */
    submit() {
        TRANSFORMATION_MANAGER.addTransformation(this, true);
        return this;
    }

    /**
     * Resets the transformation, making the time and value jump back to the start.
     * Call this before the transformation ends, or make this transformation infinite.
     * @param {!number} [delay] - Add an extra delay before this animation is executed again
     * @public
     */
    reset(delay = 0) {
        this._startTime = window.performance.now() + delay;
    }

    /**
     * Cancels this transformation, instantly stopping and removing it on the next update
     * of the {TransformationManager}
     * @public
     */
    cancel() {
        this._cancelled = true;
    }

    /**
     * Updates the value of the element associated with this transformation
     * @returns {boolean} Whether the transformation is finished and should be removed.
     * @public
     */
    update() {
        let completion = this.getCompletion();

        if(!this.shouldUpdate()) return this.isFinished(completion === 1);

        this.doUpdate(completion);

        return this.isFinished(completion === 1);
    }

    /**
     * @param {!number} completion
     * @protected
     */
    doUpdate(completion) {
        throw new Error("No update procedure defined!");
    }

    /**
     * Returns the completion from 0-1
     * @returns {number}
     * @protected
     */
    getCompletion() {
        let timePassed = (window.performance.now() - this._startTime);

        if(this._loop) {
            // Call callback for each finished loop
            if(this._callback) {
                let loopsFinished = Math.floor(timePassed / this._duration);

                let difference = loopsFinished - this._loopsFinished;

                for (let i = 0; i < difference; i++) this._callback(true);

                this._loopsFinished = loopsFinished;
            }

            timePassed %= this._duration;
        }

        // clamp the returned value
        return Math.min(1, Math.max(0, timePassed / this._duration));
    }

    /**
     * Whether this Transformation is ready to be cleaned up on the next update.
     * @returns {boolean}
     * @protected
     */
    isFinished(complete) {
        return (complete && !this._infinite) || this._cancelled;
    }

    /**
     * Whether {Transformation.update()} should be called right now.
     * @returns {boolean}
     * @protected
     */
    shouldUpdate() {
        return !this._cancelled && (window.performance.now() >= this._startTime && (window.performance.now() <= this._startTime + this._duration || this._loop));
    }
}

/**
 * A transformation class to modify the style of DOM elements. This adds a unit to the end of the expression ('%' by default).
 * @public
 */
export class TransformationElementStyle extends Transformation {
    /**
     * @param {!HTMLElement} element
     * @param {!string} propertyName
     * @param {?number} start
     * @param {!number} destination
     * @param {!number} duration
     * @param {!string} [easingType]
     * @public
     */
    constructor(element, propertyName, start, destination, duration, easingType = "linear") {
        super(element, start, destination, duration, easingType);

        /**
         * @type {string}
         * @protected
         */
        this._unit = "%";
        /**
         * @type {number}
         * @protected
         */
        this._start = start ? start : parseFloat(element.style[propertyName].substr(0, element.style[propertyName].length - this._unit.length));

        /**
         * @type {string}
         * @protected
         */
        this._propertyName = propertyName;
    }

    /**
     * @inheritDoc
     */
    doUpdate(completion) {
        this._element.style[this._propertyName] = this._start + (this._destination - this._start) * MathUtil.ease(this._easingType, completion)+this._unit;
    }
}

/**
 * @public
 */
export class TransformationObjectField extends Transformation {
    /**
     * @param {!object} element
     * @param {!string} propertyName
     * @param {?number} start
     * @param {!number} destination
     * @param {!number} duration
     * @param {!string} [easingType]
     * @public
     */
    constructor(element, propertyName, start, destination, duration, easingType = "linear") {
        super(element, start, destination, duration, easingType);

        /**
         * @type {number}
         * @protected
         */
        this._start = start ? start : element[propertyName];

        /**
         * @type {string}
         * @protected
         */
        this._propertyName = propertyName;
    }

    /**
     * @inheritDoc
     */
    doUpdate(completion) {
        this._element[this._propertyName] = this._start + (this._destination - this._start) * MathUtil.ease(this._easingType, completion)+(this._unit.length > 0 ? this._unit : 0);
    }
}

/**
 * @public
 */
export class TransformationObjectMethod extends Transformation {
    /**
     * @param {!object} element
     * @param {!string} propertyName
     * @param {?number} start
     * @param {!number} destination
     * @param {!number} duration
     * @param {!string} [easingType]
     * @public
     */
    constructor(element, propertyName, start, destination, duration, easingType = "linear") {
        super(element, start, destination, duration, easingType);

        /**
         * @type {string}
         * @protected
         */
        this._propertyName = propertyName;
    }

    /**
     * @inheritDoc
     */
    doUpdate(completion) {
        this._element[this._propertyName](this._start + (this._destination - this._start) * MathUtil.ease(this._easingType, completion)+(this._unit.length > 0 ? this._unit : 0));
    }
}