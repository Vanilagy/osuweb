import { audioContext } from "./audio";

export class AnalyserNodeWrapper {
    private node: AnalyserNode;
    private byteTimeDomainBuffer: Uint8Array;
    private byteFrequencyBuffer: Uint8Array;

    constructor(fftSize: number) {
        this.node = audioContext.createAnalyser();
        this.node.fftSize = fftSize;

        this.byteTimeDomainBuffer = new Uint8Array(this.node.frequencyBinCount);
        this.byteFrequencyBuffer = new Uint8Array(this.node.frequencyBinCount);
    }

    hook(inputNode: AudioNode) {
        inputNode.connect(this.node);
    }

    updateByteTimeDomainData() {
        this.node.getByteTimeDomainData(this.byteTimeDomainBuffer);
    }

    getByteTimeDomainBuffer() {
        return this.byteTimeDomainBuffer;
    }

    updateByteFrequencyData() {
        this.node.getByteFrequencyData(this.byteFrequencyBuffer);
    }

    getByteFrequencyBuffer() {
        return this.byteFrequencyBuffer;
    }
}