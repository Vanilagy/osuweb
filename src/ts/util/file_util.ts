export async function readFileAsText(file: File) {
    console.time("Reading file as text");
    return new Promise<string>((resolve) => {
        let reader = new FileReader();
        reader.onload = (e) => {
            console.timeEnd("Reading file as text");
            resolve(reader.result as string);
        };
        reader.readAsText(file);
    });
}

export async function readFileAsArrayBuffer(file: File) {
    console.time("Reading file as array buffer");
    return new Promise<ArrayBuffer>((resolve) => {
        let reader = new FileReader();
        reader.onload = (e) => {
            console.timeEnd("Reading file as array buffer");
            resolve(reader.result as ArrayBuffer);
        };
        reader.readAsArrayBuffer(file);
    });
}

export async function readFileAsDataUrl(file: File) {
    console.time("Reading file as data URL");
    return new Promise<string>((resolve) => {
        let reader = new FileReader();
        reader.onload = (e) => {
            console.timeEnd("Reading file as data URL");
            resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
    });
}