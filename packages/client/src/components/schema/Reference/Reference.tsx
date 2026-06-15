import type { CustomInlineContentConfig, StyleSchema } from '@blocknote/core';
import { createReactInlineContentSpec, type ReactCustomInlineContentRenderProps } from '@blocknote/react';
import { useNavigate } from '@tanstack/react-router';
import type { KeyboardEvent, MouseEvent } from 'react';

import { NOTE_ROUTE } from '~/modules/url';

const referenceClassName =
    'focus-ring-soft inline-flex cursor-pointer items-center rounded-[8px] border border-border-subtle bg-[color-mix(in_srgb,var(--elevated)_72%,var(--hover-subtle))] px-2 py-0.5 text-xs font-semibold text-fg-secondary transition-colors hover:border-border-secondary hover:bg-elevated hover:text-fg-default dark:bg-[color-mix(in_srgb,var(--elevated)_82%,var(--hover-subtle))]';

const referenceConfig = {
    type: 'reference',
    propSchema: {
        id: { default: '' },
        title: { default: 'Unknown' },
    },
    content: 'none',
} satisfies CustomInlineContentConfig;

type ReferenceRenderProps = ReactCustomInlineContentRenderProps<typeof referenceConfig, StyleSchema>;

function ReferenceContent(props: ReferenceRenderProps) {
    const navigate = useNavigate();

    const navigateToReference = () => {
        props.editor.blur();
        void navigate({
            to: NOTE_ROUTE,
            params: { id: props.inlineContent.props.id },
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
            className={referenceClassName}
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
            }}
        >
            <span>[{props.inlineContent.props.title}]</span>
        </span>
    );
}

const Reference = createReactInlineContentSpec(referenceConfig, { render: (props) => <ReferenceContent {...props} /> });

export default Reference;
