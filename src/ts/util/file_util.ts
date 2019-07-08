export async function readFileAsText(file: File) {
    return new Promise<string>((resolve) => {
        let reader = new FileReader();
        reader.onload = (e) => {
            resolve(reader.result as string);
        };
        reader.readAsText(file);
    });
}