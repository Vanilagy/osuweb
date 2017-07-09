"use strict";

import {DifficultyHitObject} from "./difficultyhitobject";

export class DifficultyBeatmap
{
    constructor(objects)
    {
        this.onScreenQueue = [];
        // Sort OsuHitObjects by StartTime - they are not correctly ordered in some cases.
        // This should probably happen before the objects reach the difficulty calculator.
        objects.sort((a, b) => {
            if(a.startTime === b.startTime) return 0;
            return a.startTime > b.startTime ? 1 : -1;
        });
        this.difficultyObjects = this.createDifficultyObjectEnumerator(objects);
    }

    getNext() {
        // Add upcoming objects to the queue until we have at least one object that had been hit and can be dequeued.
        // This means there is always at least one object in the queue unless we reached the end of the map.
        do
        {
            if (!this.difficultyObjects.moveNext())
                break; // New objects can't be added anymore, but we still need to dequeue and return the ones already on screen.

            let latest = this.difficultyObjects.current();
            // Calculate flow values here
            for(let key in this.onScreenQueue)
            {
                this.onScreenQueue[key].timeUntilHit -= latest.deltaTime;
                // Calculate reading strain here
            }
            this.onScreenQueue.push(latest);
        }
        while (this.onScreenQueue[0].timeUntilHit > 0); // Keep adding new objects on screen while there is still time before we have to hit the next one.

        return this.onScreenQueue.length === 0 ? null : this.onScreenQueue.shift(); // Remove and return objects one by one that had to be hit before the latest one appeared.
    }

    createDifficultyObjectEnumerator(objects) {
        // We will process OsuHitObjects in groups of three to form a triangle, so we can calculate an angle for each object.
        let triangle = [null, null, null];

        // OsuDifficultyHitObject construction requires three components, an extra copy of the first OsuHitObject is used at the beginning.
        if (objects.length > 1) {
            triangle[1] = objects[0]; // This copy will get shifted to the last spot in the triangle.
            triangle[0] = objects[0]; // This component corresponds to the real first OsuHitOject.
        }

        let hitObjects = [];

        // The final component of the first triangle will be the second OsuHitOject of the map, which forms the first jump.
        // If the map has less than two OsuHitObjects, the enumerator will not return anything.
        for (let i = 1; i < objects.length; ++i) {
            triangle[2] = triangle[1];
            triangle[1] = triangle[0];
            triangle[0] = objects[i];

            hitObjects.push(new DifficultyHitObject(triangle));
        }

        let enumerator = {
            hitObjects: hitObjects,
            index: -1,
            moveNext: () => ++enumerator.index < enumerator.hitObjects.length,
            current: () => enumerator.hitObjects[enumerator.index]
        };

        return enumerator;
    }
}