export const getImageDeleteConfirmation = (referenceCount: number) => {
    if (referenceCount === 0) {
        return 'Delete this image? It is not referenced by any notes. This cannot be undone.';
    }
    if (referenceCount === 1) {
        return 'Delete this image? It is referenced by 1 note, which will show a broken image. This cannot be undone.';
    }
    return `Delete this image? It is referenced by ${referenceCount} notes, which will show a broken image. This cannot be undone.`;
};
