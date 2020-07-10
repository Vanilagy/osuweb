import { VirtualDirectory } from "../file_system/virtual_directory";

window.addEventListener('mousedown', async () => {
	let handle = await chooseFileSystemEntries({type: 'open-directory'});
	let directory = VirtualDirectory.fromDirectoryHandle(handle);
	console.log(directory);

	console.log(await directory.getEntryByPath("index.html"));
	console.log(await directory.getEntryByPath("css/main.css"));

	let testmaps = await directory.getEntryByPath("assets/test_maps") as VirtualDirectory;
	console.log(testmaps);

	for await (let entry of testmaps) {
		console.log(entry.name);
	}
});