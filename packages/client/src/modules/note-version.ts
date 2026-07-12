export const toNoteVersionTime = (updatedAt: string) => {
    const timestamp = /^\d+$/.test(updatedAt) ? Number(updatedAt) : Date.parse(updatedAt);

    return Number.isFinite(timestamp) ? timestamp : null;
};

export const compareNoteVersions = (left: string, right: string) => {
    const leftTime = toNoteVersionTime(left);
    const rightTime = toNoteVersionTime(right);

    if (leftTime === null || rightTime === null) {
        return left === right ? 0 : null;
    }

    return leftTime === rightTime ? 0 : leftTime < rightTime ? -1 : 1;
};
