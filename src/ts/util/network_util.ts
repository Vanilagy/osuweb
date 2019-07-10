export async function fetchAsArrayBuffer(url: string) {
    let request = await fetch(url);
    return request.arrayBuffer();
}