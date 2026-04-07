import styles from './Reference.module.scss';
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

import { NOTE_ROUTE } from '~/modules/url';

const referenceConfig = {
    type: 'reference',
    propSchema: {
        id: { default: '' },
        title: { default: 'Unknown' }
    },
    content: 'none'
} satisfies CustomInlineContentConfig;

type ReferenceRenderProps = ReactCustomInlineContentRenderProps<typeof referenceConfig, StyleSchema>;

function ReferenceContent(props: ReferenceRenderProps) {
    const navigate = useNavigate();

    const navigateToReference = () => {
        props.editor.blur();
        void navigate({
            to: NOTE_ROUTE,
            params: { id: props.inlineContent.props.id }
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
            className={cx('Reference')}
            onMouseDown={stopEditorInteraction}
            onClick={(event) => {
                stopEditorInteraction(event);
                navigateToReference();
            }}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }

                stopEditorInteraction(event);
                navigateToReference();
            }}>
            <span>
                [{props.inlineContent.props.title}]
            </span>
        </span>
    );
}

const Reference = createReactInlineContentSpec(
    referenceConfig,
    { render: (props) => <ReferenceContent {...props} /> }
);

export default Reference;
