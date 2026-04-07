import styles from './Tag.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import type {
    CustomInlineContentConfig,
    StyleSchema
} from '@blocknote/core';
import {
    createReactInlineContentSpec,
    type ReactCustomInlineContentRenderProps
} from '@blocknote/react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { TAG_NOTES_ROUTE } from '~/modules/url';

const tagConfig = {
    type: 'tag',
    propSchema: {
        id: { default: '' },
        tag: { default: '@Unknown' }
    },
    content: 'none'
} satisfies CustomInlineContentConfig;

type TagRenderProps = ReactCustomInlineContentRenderProps<typeof tagConfig, StyleSchema>;

function TagContent(props: TagRenderProps) {
    const navigate = useNavigate();

    const navigateToTag = () => {
        props.editor.blur();
        void navigate({
            to: TAG_NOTES_ROUTE,
            params: { id: props.inlineContent.props.id },
            search: { page: 1 }
        });
    };

    const stopEditorInteraction = (event: MouseEvent | KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <span
            role="link"
            tabIndex={0}
            contentEditable={false}
            className={cx('Tag')}
            onMouseDown={stopEditorInteraction}
            onClick={(event) => {
                stopEditorInteraction(event);
                navigateToTag();
            }}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }

                stopEditorInteraction(event);
                navigateToTag();
            }}>
            <span>
                {props.inlineContent.props.tag}
            </span>
        </span>
    );
}

export const Tag = createReactInlineContentSpec(
    tagConfig,
    { render: (props) => <TagContent {...props} /> }
);

export default Tag;
