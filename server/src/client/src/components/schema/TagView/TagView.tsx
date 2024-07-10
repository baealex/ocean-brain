import { SuggestionMenuController } from '@blocknote/react';
import { createTag, fetchTags } from '~/apis/tag.api';

interface TagViewProps {
    onClick: (content: {
        type: 'tag';
        props: {
            id: string;
            tag: string;
        };
    }) => void;
}

const TagView = ({ onClick }: TagViewProps) => {
    return (
        <SuggestionMenuController
            triggerCharacter="@"
            getItems={async (query) => {
                const tags = await fetchTags({
                    query,
                    limit: 5
                });

                const noMatchedTag = tags.some(tag => tag.name !== `@${query}`);

                const itemAddNewTag = [{
                    title: 'Add a new tag',
                    onItemClick: async () => {
                        const tag = await createTag({ name: '@' + query });
                        onClick({
                            type: 'tag',
                            props: {
                                id: tag.id,
                                tag: tag.name
                            }
                        });
                    }
                }];

                if (tags.length === 0) {
                    return itemAddNewTag;
                }

                return tags.map(tag => ({
                    title: tag.name,
                    onItemClick: () => onClick({
                        type: 'tag',
                        props: {
                            id: tag.id,
                            tag: tag.name
                        }
                    })
                })).concat((query && noMatchedTag) ? itemAddNewTag : []);
            }}
        />
    );
};

export default TagView;
