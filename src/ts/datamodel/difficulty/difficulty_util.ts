import { Color } from "../../util/graphics_util";

export abstract class DifficultyUtil {
	static getColorForStarRating(starRating: number): Color {
		if (starRating < 2) return {r: 124, g: 219, b: 122};
		else if (starRating < 3) return {r: 122, g: 201, b: 219};
		else if (starRating < 4) return {r: 219, g: 209, b: 122};
		else if (starRating < 5) return {r: 225, g: 99, b: 175};
		else if (starRating < 7) return {r: 169, g: 127, b: 239};
		else return {r: 240, g: 93, b: 93};
	}
}