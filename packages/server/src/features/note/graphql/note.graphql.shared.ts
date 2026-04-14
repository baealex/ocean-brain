interface BlockNote<T = unknown> {
    id: string;
    type: string;
    props: T;
    content?: BlockNote<T>[];
    children?: BlockNote<T>[];
}

export const extractBlocksByType = <T>(type: string, dataArray: BlockNote[]): BlockNote<T>[] => {
    let result: BlockNote[] = [];

    for (const data of dataArray) {
        if (data.type === type) {
            result.push(data);
        }

        if (data.children && data.children.length > 0) {
            result = result.concat(extractBlocksByType(type, data.children));
        }

        if (data.content && data.content.length > 0) {
            for (const contentItem of data.content) {
                if (contentItem.type === type) {
                    result.push(contentItem);
                }
            }
        }
    }

    return result as BlockNote<T>[];
};
