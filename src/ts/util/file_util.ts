export async function readFileAsText(file: File) {
    return new Promise<string>((resolve) => {
        let reader = new FileReader();
        reader.onload = (e) => {
            resolve(reader.result as string);
        };
        reader.readAsText(file);
    });
}

export async function readFileAsArrayBuffer(file: File) {
    return new Promise<ArrayBuffer>((resolve) => {
        let reader = new FileReader();
        reader.onload = (e) => {
            resolve(reader.result as ArrayBuffer);
        };
        reader.readAsArrayBuffer(file);
    });
}