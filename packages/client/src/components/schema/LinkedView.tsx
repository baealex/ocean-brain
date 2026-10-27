import { createReactBlockSpec } from '@blocknote/react';
import LinkedViewPanel from '~/components/view/LinkedViewPanel';

const LinkedView = createReactBlockSpec(
    {
        type: 'linkedView',
        propSchema: { viewId: { default: '' }, viewTitle: { default: '' } },
        content: 'none',
    },
    {
        runsBefore: ['paragraph'],
        render: ({ block, editor }) => (
            <div className="w-full min-w-0" contentEditable={false} data-linked-view-id={block.props.viewId}>
                <LinkedViewPanel
                    {...block.props}
                    editable={editor.isEditable}
                    onSelect={(view) =>
                        editor.updateBlock(block, { props: { viewId: view.id, viewTitle: view.title } })
                    }
                    onRemove={() => editor.removeBlocks([block])}
                />
            </div>
        ),
        toExternalHTML: ({ block }) => (
            <p data-linked-view-id={block.props.viewId}>
                {block.props.viewId ? (
                    <a href={`/views/notes?viewId=${encodeURIComponent(block.props.viewId)}`}>
                        View: {block.props.viewTitle || block.props.viewId}
                    </a>
                ) : (
                    'Linked view (not selected)'
                )}
            </p>
        ),
        parse: (element) => {
            if (element.tagName !== 'P' || element.children.length !== 1) return undefined;
            const anchor = element.firstElementChild;
            if (anchor?.tagName !== 'A' || element.textContent?.trim() !== anchor.textContent?.trim()) return undefined;
            const match = anchor?.getAttribute('href')?.match(/^\/views\/notes\?viewId=([^&#]+)$/);
            if (!match) return undefined;
            try {
                const viewId = decodeURIComponent(match[1]);
                return viewId.trim() && viewId.length <= 256
                    ? { viewId, viewTitle: (anchor?.textContent ?? '').replace(/^View: /, '') }
                    : undefined;
            } catch {
                return undefined;
            }
        },
    },
)();

export default LinkedView;
