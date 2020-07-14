import { Point } from "./point";

// Calculating Bézier curves requires tons of temporary point allocations that would just add an insane amount of work to the gargabe collector. To deal with this, Bézier curve calculation uses its own memory management by writing the necessary points into a contiguous float array. Since a point contains x,y coordinates, each point requires two floats to be represented. So, if buffer[index] is the point's x-coordinate, buffer[index + 1] will be its y-coordinate.
let pointBuffer = new Float32Array(2**16);

export abstract class BézierUtil {
	static sampleBézier(controlPoints: Point[], output: Point[]) {
		// In order to prevent stack overflows, handle the stack manually.
		let stack: number[] = [];
		stack.push(0); // The location of the original control points

		// Copy the control points into the buffer
		for (let j = 0; j < controlPoints.length; j++) {
			pointBuffer[2*j] = controlPoints[j].x;
			pointBuffer[2*j + 1] = controlPoints[j].y;
		}

		// This algorithm works by recursively dividing the curve into smaller subcurves, until the subcurves are flat enough to be sampled.
		while (stack.length > 0) {
			let parent = stack.pop();

			while (parent + controlPoints.length*16 >= pointBuffer.length) {
				// We're close to filling out the buffer, so double its size.
				let newBuffer = new Float32Array(pointBuffer.length * 2);
				newBuffer.set(pointBuffer);
				pointBuffer = newBuffer;
			}

			if (BézierUtil.bézierIsSufficientlyFlat(controlPoints.length, parent)) {
				// Once the control points are flat enough, sample from that subsegment.
				BézierUtil.approximateBézier(controlPoints.length, parent, output);
				continue;
			}

			let leftChildIndex = parent + controlPoints.length*2*2;
			let rightChildIndex = parent + controlPoints.length*2;
			let midpointBufferIndex = leftChildIndex + controlPoints.length*2;
			BézierUtil.bézierSubdivide(controlPoints.length, parent, leftChildIndex, rightChildIndex, midpointBufferIndex);

			stack.push(rightChildIndex);
			stack.push(leftChildIndex);
		}
	}

	/** Divide a Bézier curve in half, creating two new sets of control points for the smaller subcurves. */
	static bézierSubdivide(count: number, controlPointOffset: number, leftOffset: number, rightOffset: number, midpointBufferOffset: number) {
		for (let i = 0; i < count; i++) {
			pointBuffer[midpointBufferOffset + 2*i] = pointBuffer[controlPointOffset + 2*i];
			pointBuffer[midpointBufferOffset + 2*i + 1] = pointBuffer[controlPointOffset + 2*i + 1];
		}

		for (let i = 0; i < count; i++) {
			pointBuffer[leftOffset + 2*i] = pointBuffer[midpointBufferOffset + 0];
			pointBuffer[leftOffset + 2*i + 1] = pointBuffer[midpointBufferOffset + 1];
			pointBuffer[rightOffset + 2*(count - i - 1)] = pointBuffer[midpointBufferOffset + 2*(count - i - 1)];
			pointBuffer[rightOffset + 2*(count - i - 1) + 1] = pointBuffer[midpointBufferOffset + 2*(count - i - 1) + 1];

			for (let j = 0; j < count - i - 1; j++) {
				pointBuffer[midpointBufferOffset + 2*j] = (pointBuffer[midpointBufferOffset + 2*j] + pointBuffer[midpointBufferOffset + 2*(j+1)]) / 2;
				pointBuffer[midpointBufferOffset + 2*j + 1] = (pointBuffer[midpointBufferOffset + 2*j + 1] + pointBuffer[midpointBufferOffset + 2*(j+1) + 1]) / 2;
			}
		}
	}

	/** Using De Casteljau's algorithm, create a piecewise-linear approximation of a given Bézier curve. This code is kinda magic. Refer to lazer source for more detail. */
	static approximateBézier(count: number, controlPointOffset: number, output: Point[]) {
		let l = controlPointOffset + 2*count;
		let r = l + 2*(2*count - 1);
		let midpointBufferOffset = r + 2*count;

		BézierUtil.bézierSubdivide(count, controlPointOffset, l, r, midpointBufferOffset);

		for (let i = 0; i < count - 1; i++) {
			pointBuffer[l + 2*(count + i)] = pointBuffer[r + 2*(i+1)];
			pointBuffer[l + 2*(count + i) + 1] = pointBuffer[r + 2*(i+1) + 1];
		}

		output.push({x: pointBuffer[controlPointOffset], y: pointBuffer[controlPointOffset+1]});

		for (let i = 1; i < count - 1; i++) {
			let index = 2 * i;
			let p: Point = {
				x: 0.25 * (pointBuffer[l + 2*(index-1)] + 2*pointBuffer[l + 2*(index)] + pointBuffer[l + 2*(index+1)]),
				y: 0.25 * (pointBuffer[l + 2*(index-1) + 1] + 2*pointBuffer[l + 2*(index) + 1] + pointBuffer[l + 2*(index+1) + 1]),
			};
			output.push(p);
		}
	}

	/** Returns true if the control points' curvature lies below a certain threshold. Again, refer to lazer source. */
	static bézierIsSufficientlyFlat(count: number, controlPointOffset: number) {
		for (let i = 1; i < count - 1; i++) {
			if ((pointBuffer[controlPointOffset + 2*(i-1)] - 2*pointBuffer[controlPointOffset + 2*(i)] + pointBuffer[controlPointOffset + 2*(i+1)])**2   
				+ (pointBuffer[controlPointOffset + 2*(i-1) + 1] - 2*pointBuffer[controlPointOffset + 2*(i) + 1] + pointBuffer[controlPointOffset + 2*(i+1) + 1])**2 > 0.25 * 0.25 * 4) 
				return false;
		}

		return true;
	}
}