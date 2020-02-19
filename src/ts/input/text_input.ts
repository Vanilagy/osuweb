import { inputEventEmitter } from "./input";
import { CustomEventEmitter } from "../util/custom_event_emitter";

const textInputElement = document.querySelector('#hidden-text-input') as HTMLInputElement;

export let textInputEventEmitter = new CustomEventEmitter<{
    textInput: string
}>();

inputEventEmitter.addListener('keyDown', () => {
    textInputElement.focus();
});

textInputElement.addEventListener('input', () => {
    let value = textInputElement.value;

    textInputEventEmitter.emit('textInput', value);
    textInputElement.value = "";
});