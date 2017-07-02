"use strict";

import {HitObject} from "./hitobject";

export class Circle extends HitObject {
    constructor(data) {
        super(data);

        this.hittable = true;
    }
}