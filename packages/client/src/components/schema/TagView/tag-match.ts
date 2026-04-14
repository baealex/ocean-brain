export const hasExactTagMatch = (
    query: string,
    tags: Array<{ name: string }>
) => {
    return tags.some((tag) => tag.name === `@${query}`);
};
