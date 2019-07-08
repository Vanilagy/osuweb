import { HitObject } from "./hit_object";

export class Circle extends HitObject {
    private hittable: boolean;

    constructor(data: any) {
        super(data);

        this.hittable = true;
    }
}