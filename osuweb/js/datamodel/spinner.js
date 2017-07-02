"use strict";

import {HitObject} from "./hitobject";

export class Spinner extends HitObject {
    constructor(data) {
        super(data);
        this.x = 256;
        this.y = 192;
        this.endTime = parseInt(data[5]);
    }
}