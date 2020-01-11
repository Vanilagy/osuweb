import { HitObject } from "./hit_object";
import { PLAYFIELD_DIMENSIONS } from "../util/constants";

export class Spinner extends HitObject {
	public endTime: number;

	constructor(data: string[]) {
		super(data);

		this.x = PLAYFIELD_DIMENSIONS.width/2;
		this.y = PLAYFIELD_DIMENSIONS.height/2;
		this.endTime = parseInt(data[5]);

		this.parseExtras(data[6]);
	}
}