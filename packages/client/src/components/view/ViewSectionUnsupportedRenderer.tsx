import { Button, Text } from '~/components/ui';

interface ViewSectionUnsupportedRendererProps {
    onEdit: () => void;
}

export default function ViewSectionUnsupportedRenderer({ onEdit }: ViewSectionUnsupportedRendererProps) {
    return (
        <div className="rounded-[16px] border border-dashed border-border-subtle bg-subtle/40 px-4 py-5">
            <Text as="p" variant="body" weight="semibold">
                This display type is unavailable
            </Text>
            <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                Switch this section to List or Table to preview the saved query here.
            </Text>
            <div className="mt-3">
                <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
                    Change display
                </Button>
            </div>
        </div>
    );
}
