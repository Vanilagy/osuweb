import { bytesToString } from "./misc_util";
import { VirtualDirectory } from "../file_system/virtual_directory";
import { AudioPlayer } from "../audio/audio_player";
import { VirtualFile } from "../file_system/virtual_file";
import { AudioBufferPlayer } from "../audio/audio_buffer_player";
import { AudioMediaPlayer } from "../audio/audio_media_player";

// All bitrate values are in 1000 bits per second
const MPEGV1_BITRATES: { [layer: number]: { [bitrateIndex: number]: number } } = {
	// reserved
	0: null,
	// layer 3
	1: {
		0x0: null, // "free"
		0x1: 32,
		0x2: 40,
		0x3: 48,
		0x4: 56,
		0x5: 64,
		0x6: 80,
		0x7: 96,
		0x8: 112,
		0x9: 128,
		0xa: 160,
		0xb: 192,
		0xc: 224,
		0xd: 256,
		0xe: 320,
		0xf: null // "bad"
	},
	// layer 2
	2: {
		0x0: null, // "free"
		0x1: 32,
		0x2: 48,
		0x3: 56,
		0x4: 64,
		0x5: 80,
		0x6: 96,
		0x7: 112,
		0x8: 128,
		0x9: 160,
		0xa: 192,
		0xb: 224,
		0xc: 256,
		0xd: 320,
		0xe: 384,
		0xf: null // "bad"
	},
	// layer 1
	3: {
		0x0: null, // "free"
		0x1: 32,
		0x2: 64,
		0x3: 96,
		0x4: 128,
		0x5: 160,
		0x6: 192,
		0x7: 224,
		0x8: 256,
		0x9: 288,
		0xa: 320,
		0xb: 352,
		0xc: 384,
		0xd: 416,
		0xe: 448,
		0xf: null // "bad"
	}
};
const MPEGV2_BITRATES: { [layer: number]: { [bitrateIndex: number]: number } } = {
	// reserved
	0: null,
	// layer 3
	1: {
		0x0: null, // "free"
		0x1: 32,
		0x2: 48,
		0x3: 56,
		0x4: 64,
		0x5: 80,
		0x6: 96,
		0x7: 112,
		0x8: 128,
		0x9: 144,
		0xa: 160,
		0xb: 176,
		0xc: 192,
		0xd: 224,
		0xe: 256,
		0xf: null // "bad"
	},
	// layer 2
	2: {
		0x0: null, // "free"
		0x1: 8,
		0x2: 16,
		0x3: 24,
		0x4: 32,
		0x5: 40,
		0x6: 48,
		0x7: 56,
		0x8: 64,
		0x9: 80,
		0xa: 96,
		0xb: 112,
		0xc: 128,
		0xd: 144,
		0xe: 160,
		0xf: null // "bad"
	},
	// layer 1
	3: {
		0x0: null, // "free"
		0x1: 8,
		0x2: 16,
		0x3: 24,
		0x4: 32,
		0x5: 40,
		0x6: 48,
		0x7: 56,
		0x8: 64,
		0x9: 80,
		0xa: 96,
		0xb: 112,
		0xc: 128,
		0xd: 144,
		0xe: 160,
		0xf: null // "bad"
	}
};

// All values are in Hz
const MPEG_SAMPLING_RATES: { [mpegVersion: number]: { [samplingRateIndex: number]: number } } = {
	// MPEG Version 2.5
	0: {
		0: 11025,
		1: 12000,
		2: 8000,
		3: null // reserved
	},
	1: null, // reserved
	// MPEG Version 2 (ISO/IEC 13818-3)
	2: {
		0: 22050,
		1: 24000,
		2: 16000,
		3: null // reserved
	},
	// MPEG Version 1 (ISO/IEC 11172-3)
	3: {
		0: 44100,
		1: 48000,
		2: 32000,
		3: null // reserved
	}
};

export abstract class Mp3Util {
	//  Decode a [synchsafe](http://en.wikipedia.org/wiki/Synchsafe) value. Synchsafes are used in
	//  ID3 tags, instead of regular ints, to avoid the unintended introduction of bogus
	//  frame-syncs. Note that the spec requires that syncsafe be always stored in big-endian order
	//  (Implementation shamefully lifted from relevant wikipedia article)
	static unsynchsafe(value: number) {
		let out = 0;
		let mask = 0x7F000000;

		while (mask) {
			out >>= 1;
			out |= value & mask;
			mask >>= 8;
		}

		return out;
	}

	// Gets the byte length of a id3 (and following xing/info) tag from its header
	static getFileHeaderByteLength(view: DataView, offset: number) {
		if (view.byteLength - offset < 10) return null;
		return Mp3Util.getFirstFrameHeaderIndex(view, offset);
	}

	static isId3Tag(view: DataView, offset: number) {
		return bytesToString(new Uint8Array(view.buffer.slice(offset, offset + 3))) === "ID3";
	}

	static getId3TagLength(view: DataView, offset: number) {
		return Mp3Util.unsynchsafe(view.getUint32(offset + 6)) + 10; // Have to add 10 because the number excludes the header length (which is always 10)
	}

	static isXingFrame(view: DataView, offset: number) {
		let mpegVersion = Mp3Util.getMpegVersionfromFrameHeader(view, offset);
		let channelMode = Mp3Util.getChannelModeFromFrameHeader(view, offset);

		let xingOffset: number;
		let isMono = channelMode === 3;

        if (mpegVersion === 3) { // MPEG Version 1 (ISO/IEC 11172-3)
            xingOffset = isMono? 21 : 36;
        } else {
            xingOffset = isMono? 13 : 21;
		}
		
		let section = view.buffer.slice(offset + xingOffset, offset + xingOffset + 4);
		let str = bytesToString(new Uint8Array(section));

		return str === "Xing" || str === "Info";
	}

	static getBitrateFromFrameHeader(view: DataView, offset: number, mpegVersion: number, layer: number) {
		let bitrateIndex = view.getUint8(offset + 2) >> 4;

		if (mpegVersion === 3) { // MPEG Version 1 (ISO/IEC 11172-3)
			return MPEGV1_BITRATES[layer][bitrateIndex];
		} else {
			return MPEGV2_BITRATES[layer][bitrateIndex];
		}
	}

	static getSamplingRateFromFrameHeader(view: DataView, offset: number, mpegVersion: number) {
		let samplingRateIndex = (view.getUint8(offset + 2) & 0b00001100) >> 2;
		return MPEG_SAMPLING_RATES[mpegVersion][samplingRateIndex];
	}

	static getPaddingBitFromFrameHeader(view: DataView, offset: number) {
		return (view.getUint8(offset + 2) & 0b00000010) >> 1;
	}

	static isFrameHeader(view: DataView, offset: number) {
		return view.getUint8(offset) === 0xff; // Frames begin with FF
	}

	static calculateFrameByteLength(layer: number, bitrate: number, samplingRate: number, sampleLength: number, padding: number) {
		let paddingSize = padding ? (layer === 3 ? 4 : 1) : 0;
		let byteRate = bitrate * 1000 / 8;
		return Math.floor((sampleLength * byteRate / samplingRate) + paddingSize);
	}

	static getFrameByteLength(view: DataView, offset: number) {
		let layer = Mp3Util.getLayerFromFrameHeader(view, offset);
		let mpegVersion = Mp3Util.getMpegVersionfromFrameHeader(view, offset)
		let bitrate = Mp3Util.getBitrateFromFrameHeader(view, offset, mpegVersion, layer);
		let samplingRate = Mp3Util.getSamplingRateFromFrameHeader(view, offset, mpegVersion);
		let sampleLength = Mp3Util.getSampleLengthForLayer(layer);
		let padding = Mp3Util.getPaddingBitFromFrameHeader(view, offset);

		return Mp3Util.calculateFrameByteLength(layer, bitrate, samplingRate, sampleLength, padding);
	}

	static getMpegVersionfromFrameHeader(view: DataView, offset: number) {
		return (view.getUint8(offset + 1) & 0b00011000) >> 3;
	}

	static getLayerFromFrameHeader(view: DataView, offset: number) {
		return (view.getUint8(offset + 1) & 0b00000110) >> 1;
	}

	static getChannelModeFromFrameHeader(view: DataView, offset: number) {
		return (view.getUint8(offset + 3) & 0b11000000) >> 6;
	} 

	static getSampleLengthForLayer(layer: number) {
		return (layer === 3)? 384 : 1152;
	}

	// Not that since frames are usually 26 millseconds long, this method can't return the exact point of playback, but rather returns the index of the frame right before the wanted time.
	static getFrameHeaderIndexAtTime(view: DataView, start: number, time: number) {
		let traversedTime = 0;
		let currentOffset = start;
		let eofReached = false;

		while (true) {
			if (currentOffset >= view.byteLength || !Mp3Util.isFrameHeader(view, currentOffset)) {
				eofReached = true;
				break;
			}

			let mpegVersion = Mp3Util.getMpegVersionfromFrameHeader(view, currentOffset);
			let layer = Mp3Util.getLayerFromFrameHeader(view, currentOffset); 
			let bitrate = Mp3Util.getBitrateFromFrameHeader(view, currentOffset, mpegVersion, layer);
			let samplingRate = Mp3Util.getSamplingRateFromFrameHeader(view, currentOffset, mpegVersion);
			let padding = Mp3Util.getPaddingBitFromFrameHeader(view, currentOffset);
			let sampleLength = Mp3Util.getSampleLengthForLayer(layer);
			let byteLength = Mp3Util.calculateFrameByteLength(layer, bitrate, samplingRate, sampleLength, padding);

			let frameTime = sampleLength / samplingRate;
			if (traversedTime + frameTime > time) break;

			traversedTime += frameTime;
			currentOffset += byteLength;
		}

		return {
			offset: currentOffset,
			exactTime: traversedTime,
			eofReached: eofReached
		};
	}

	static calulateDuration(view: DataView) {
		return Mp3Util.getFrameHeaderIndexAtTime(view, Mp3Util.getFileHeaderByteLength(view, 0), Infinity).exactTime;
	}

	static getFirstFrameHeaderIndex(view: DataView, offset: number, acceptMetatags = false) {
		let endIndex = Math.min(view.byteLength, offset + 100000);

		for (let i = offset; i < endIndex; i++) {
			if (Mp3Util.isId3Tag(view, i)) {
				i += Mp3Util.getId3TagLength(view, i) - 1;
				continue;
			}

			if (!Mp3Util.isFrameHeader(view, i)) continue;
			if (acceptMetatags) return i;

			if (Mp3Util.isXingFrame(view, i)) {
				i += Mp3Util.getFrameByteLength(view, i) - 1;
				continue;
			}

			return i;
		}

		return null;
	}
}

export class AudioUtil {
	static async changeTempoAndPitch(buffer: AudioBuffer, referenceContext: AudioContext, tempo: number, pitch: number) {
		let newBufferLength = Math.floor(buffer.length / tempo);
		let offlineContext = new OfflineAudioContext(2, newBufferLength, referenceContext.sampleRate);

		let shifter = new PitchShifter(offlineContext, buffer, 8192);
		shifter.tempo = tempo;
		shifter.pitch = pitch;
		shifter.connect(offlineContext.destination);

		return offlineContext.startRendering();
	}

	static async createSoundPlayerFromFilename(directory: VirtualDirectory, filename: string, playerType: 'audioBufferPlayer' | 'audioPlayer', destination: AudioNode) {
		let foundFile: VirtualFile;

		if (directory.networkFallbackUrl) {
			await directory.getFileByPath(filename + '.wav');
            await directory.getFileByPath(filename + '.mp3');
		}

		directory.forEachFile((e) => {
			if (foundFile) return;
			if (!e.name.startsWith(filename)) return;

			foundFile = e;
		});

		let player: AudioPlayer;
		if (playerType === 'audioBufferPlayer') player = new AudioBufferPlayer(destination);
		else player = new AudioMediaPlayer(destination);

		if (foundFile) await player.loadFile(foundFile);

		return player;
	}
}