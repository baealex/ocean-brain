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
                const response = await fetchTags({
                    query,
                    limit: 5
                });

                if (response.type === 'error') {
                    return [];
                }

                const { tags } = response.allTags;

                const noMatchedTag = tags.some(tag => tag.name !== `@${query}`);

                const itemAddNewTag = [{
                    title: 'Add a new tag',
                    onItemClick: async () => {
                        const response = await createTag({ name: '@' + query });
                        if (response.type === 'error') {
                            return;
                        }
                        const { id, name: tag } = response.createTag;
                        onClick({
                            type: 'tag',
                            props: {
                                id,
                                tag
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
