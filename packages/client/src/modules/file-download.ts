export function downloadBlobFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function downloadTextFile(content: string, filename: string, type: string) {
    downloadBlobFile(new Blob([content], { type }), filename);
}
