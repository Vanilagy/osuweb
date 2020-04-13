import { Dimensions } from "../../util/graphics_util";
import { uploadTexture } from "../../visuals/rendering";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { VirtualFile } from "../../file_system/virtual_file";

export type OsuTextureResolution = 'sd' | 'hd';

export class OsuTexture {
    private sdBase: PIXI.Texture = null;
    private hdBase: PIXI.Texture = null;
    private sd: PIXI.Texture[] = [];
    private hd: PIXI.Texture[] = [];

    constructor() { }

    hasActualSdBase() {
        return this.sdBase !== null;
    }

    hasActualHdBase() {
        return this.hdBase !== null;
    }

    hasActualBase() {
        return this.hasActualSdBase() || this.hasActualHdBase();
    }

    getActualSdBase() {
        return this.sdBase;
    }

    getActualHdBase() {
        return this.hdBase;
    }

    /** If the texture doesn't have a base, fall back to the first frame of the animation */
    getDeFactoSdBase() {
        return this.sdBase || this.sd[0] || null;
    }

    /** If the texture doesn't have a base, fall back to the first frame of the animation */
    getDeFactoHdBase() {
        return this.hdBase || this.hd[0] || null;
    }

    getAnimationFrameCount() {
        return Math.max(this.sd.length, this.hd.length);
    }

    getSd(animationIndex?: number) {
        let sd = (animationIndex === undefined)? this.getDeFactoSdBase() : (this.sd[animationIndex] || this.sdBase);
        if (sd) return sd;
        return null;
    }

    getHd(animationIndex?: number) {
        let hd = (animationIndex === undefined)? this.getDeFactoHdBase() : (this.hd[animationIndex] || this.hdBase);
        if (hd) return hd;
        return null;
    }

    getBest(animationIndex?: number) {
        return this.getHd(animationIndex) || this.getSd(animationIndex);
    }

    getWorst(animationIndex?: number) {
        return this.getSd(animationIndex) || this.getHd(animationIndex);
    }

    getForResolution(resolution: OsuTextureResolution, animationIndex?: number) {
        if (resolution === 'sd') return this.getSd(animationIndex) || this.getHd(animationIndex); // HD fallback
        else if (resolution === 'hd') return this.getHd(animationIndex) || this.getSd(animationIndex); // SD fallback
    }

    getOptimalResolution(size: number, animationIndex?: number): OsuTextureResolution {
        let sd = this.getSd(animationIndex),
            hd = this.getHd(animationIndex);

        if (!sd && !hd) return null;
        if (!sd) return 'hd';
        if (!hd) return 'sd';

        if (size <= sd.width && size <= sd.height) return 'sd';
        else return 'hd';
    }

    /** Returns the width of the standard definition version. */
    getWidth(animationIndex?: number) {
        let sd = this.getSd(animationIndex);
        if (sd) return sd.width;
        let hd = this.getHd(animationIndex);
        if (hd) return hd.width/2;
        
        return null;
    }

    /** Returns the height of the standard definition version. */
    getHeight(animationIndex?: number) {
        let sd = this.getSd(animationIndex);
        if (sd) return sd.height;
        let hd = this.getHd(animationIndex);
        if (hd) return hd.height/2;
        
        return null;
    }

    getWidthForResolution(resolution: OsuTextureResolution, animationIndex?: number) {
        if (resolution === 'sd') {
            let sd = this.getSd(animationIndex);
            if (!sd) {
                let hd = this.getHd(animationIndex);
                return hd && hd.width/2; // TODO: /2 correct here?
            }
            return sd.width;
        } else if (resolution === 'hd') {
            let hd = this.getHd(animationIndex);
            if (!hd) {
                let sd = this.getSd(animationIndex); // SD fallback
                return sd && sd.width/2; 
            }
            return hd.width/2;
        }
    }

    getHeightForResolution(resolution: OsuTextureResolution, animationIndex?: number) {
        if (resolution === 'sd') {
            let sd = this.getSd(animationIndex);
            if (!sd) {
                let hd = this.getHd(animationIndex);
                return hd && hd.height/2;
            }
            return sd.height;
        } else if (resolution === 'hd') {
            let hd = this.getHd(animationIndex);
            if (!hd) {
                let sd = this.getSd(animationIndex);
                return sd && sd.height/2; 
            }
            return hd.height/2;
        }
    }

    getBiggestDimension(scalingFactor = 1, animationIndex?: number) {
        return Math.max(this.getWidth(animationIndex) * scalingFactor, this.getHeight(animationIndex) * scalingFactor);
    }

    getDownsizedDimensions(maxDimension: number, animationIndex?: number): Dimensions {
        let width = this.getWidth(animationIndex), height = this.getHeight(animationIndex);
        let ratio = width/height;

        if (width > height) {
            return {
                width: maxDimension,
                height: maxDimension / ratio
            };
        } else {
            return {
                width: maxDimension * ratio,
                height: maxDimension
            };
        }
    }

    isEmpty() {
        return (this.getDeFactoSdBase() || this.getDeFactoHdBase()) === null;
    }

    uploadToGpu() {
        if (this.sdBase) uploadTexture(this.sdBase);
        if (this.hdBase) uploadTexture(this.hdBase);
        for (let tex of this.sd) uploadTexture(tex);
        for (let tex of this.hd) uploadTexture(tex);
    }

    applyToSprite(sprite: PIXI.Sprite, scalingFactor: number, frame?: number, maxDimensionFactor: number = 1.0) {
        let resolution = this.getOptimalResolution(this.getBiggestDimension(scalingFactor * maxDimensionFactor), frame);
        let tex = this.getForResolution(resolution, frame);
        if (!tex) return;

        sprite.texture = tex;
        sprite.width = this.getWidthForResolution(resolution, frame) * scalingFactor;
        sprite.height = this.getHeightForResolution(resolution, frame) * scalingFactor;
    }

    static async fromFiles(directory: VirtualDirectory, name: string, extension: string, hd = false, animationName: string = null) {
        let newOsuTexture = new OsuTexture();

        let sdBaseFile = await directory.getFileByPath(`${name}.${extension}`);
        let hdBaseFile: VirtualFile;
        if (hd) hdBaseFile = await directory.getFileByPath(`${name}@2x.${extension}`);

        if (sdBaseFile) newOsuTexture.sdBase = PIXI.Texture.from(await sdBaseFile.readAsResourceUrl());
        if (hdBaseFile) newOsuTexture.hdBase = PIXI.Texture.from(await hdBaseFile.readAsResourceUrl());

        if (animationName) {
            let i = 0;

            while (true) {
                let name = animationName.replace("{n}", i.toString());

                let sdFile = await directory.getFileByPath(`${name}.${extension}`);
                let hdFile: VirtualFile;
                if (hd) hdFile = await directory.getFileByPath(`${name}@2x.${extension}`);

                if (!sdFile && !hdFile) break; // No more animation states

                if (sdFile) {
                    let tex = PIXI.Texture.from(await sdFile.readAsResourceUrl());
                    newOsuTexture.sd.push(tex);
                }
                if (hdFile) {
                    let tex = PIXI.Texture.from(await hdFile.readAsResourceUrl());
                    newOsuTexture.hd.push(tex);
                }

                i++;
            }
        }

        return newOsuTexture;
	}
	
	hasLoaded() {
		let textures: PIXI.Texture[] = [];
		textures.push(this.sdBase, this.hdBase, ...this.sd, ...this.hd);

		for (let tex of textures) {
			if (!tex) continue;

			if (!tex.baseTexture.valid) return false;
		}

		return true;
	}
}