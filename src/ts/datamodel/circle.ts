import { HitObject } from "./hit_object";

export class Circle extends HitObject {
    constructor(data: string[]) {
        super(data);

        this.parseExtras(data[5]);
    }
}