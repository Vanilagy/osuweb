import { Color, hexNumberToColor, colorToHexString } from "../../util/graphics_util";
import { TAU } from "../../util/math_util";
import { ScoreGrade } from "../../datamodel/score";

const SCORE_GRADE_RESOLUTION = 512;
const SCORE_GRADE_BACKGROUND_COLOR: Color = {r: 31, g: 31, b: 31, a: 0.5};
const SCORE_GRADE_BORDER_COLOR: Color = {r: 255, g: 255, b: 255, a: 0.9};
const SCORE_GRADE_BORDER_THICKNESS = 0.03; // Percentually

const scoreGradeDrawingInfo = new Map<ScoreGrade, {text: string, color: Color}>();
scoreGradeDrawingInfo.set(ScoreGrade.X, {
	text: 'SS',
	color: hexNumberToColor(0xFDEC90)
});
scoreGradeDrawingInfo.set(ScoreGrade.S, {
	text: 'S',
	color: hexNumberToColor(0xEDBD41)
});
scoreGradeDrawingInfo.set(ScoreGrade.A, {
	text: 'A',
	color: hexNumberToColor(0x79DC69)
});
scoreGradeDrawingInfo.set(ScoreGrade.B, {
	text: 'B',
	color: hexNumberToColor(0x69B3DC)
});
scoreGradeDrawingInfo.set(ScoreGrade.C, {
	text: 'C',
	color: hexNumberToColor(0xC54DC8)
});
scoreGradeDrawingInfo.set(ScoreGrade.D, {
	text: 'D',
	color: hexNumberToColor(0xDF4949)
});

export const scoreGradeTextures = new Map<ScoreGrade, PIXI.Texture>();

export function initScoreGrades() {
	for (let item in ScoreGrade) {
		if (isNaN(Number(item))) continue;
	
		let grade = Number(item) as ScoreGrade;
		let drawingInfo = scoreGradeDrawingInfo.get(grade);
		let canvas = document.createElement('canvas');
		canvas.setAttribute('width', SCORE_GRADE_RESOLUTION.toString());
		canvas.setAttribute('height', SCORE_GRADE_RESOLUTION.toString());
		let ctx = canvas.getContext('2d');
	
		ctx.arc(SCORE_GRADE_RESOLUTION/2, SCORE_GRADE_RESOLUTION/2, SCORE_GRADE_RESOLUTION/2, 0, TAU);
		ctx.fillStyle = `rgba(${SCORE_GRADE_BACKGROUND_COLOR.r}, ${SCORE_GRADE_BACKGROUND_COLOR.g}, ${SCORE_GRADE_BACKGROUND_COLOR.b}, ${SCORE_GRADE_BACKGROUND_COLOR.a})`;
		ctx.fill();
	
		ctx.beginPath();
		ctx.arc(SCORE_GRADE_RESOLUTION/2, SCORE_GRADE_RESOLUTION/2, SCORE_GRADE_RESOLUTION/2 - SCORE_GRADE_RESOLUTION*SCORE_GRADE_BORDER_THICKNESS/2, 0, TAU);
		ctx.strokeStyle = `rgba(${SCORE_GRADE_BORDER_COLOR.r}, ${SCORE_GRADE_BORDER_COLOR.g}, ${SCORE_GRADE_BORDER_COLOR.b}, ${SCORE_GRADE_BORDER_COLOR.a})`;
		ctx.lineWidth = SCORE_GRADE_RESOLUTION*SCORE_GRADE_BORDER_THICKNESS;
		ctx.stroke();

		let textX = SCORE_GRADE_RESOLUTION/2;
		if (drawingInfo.text === 'C') textX -= SCORE_GRADE_RESOLUTION/27; // C looks non-centered, therefore nudge it

		ctx.beginPath();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `${Math.floor(SCORE_GRADE_RESOLUTION * 0.72)}px Exo2-SemiBold`;
		ctx.fillStyle = colorToHexString(drawingInfo.color);
		ctx.fillText(drawingInfo.text, textX, SCORE_GRADE_RESOLUTION/2);
	
		scoreGradeTextures.set(grade, PIXI.Texture.from(canvas));
	}
}