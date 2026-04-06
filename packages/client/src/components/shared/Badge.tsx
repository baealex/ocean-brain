import { Text } from '~/components/ui';

interface BadgeProps {
    name: string;
}

export default function Badge({ name }: BadgeProps) {
    return (
        <Text
            as="div"
            variant="label"
            weight="medium"
            tone="secondary"
            className="inline-flex items-center rounded-full border border-border-subtle bg-hover-subtle px-2.5 py-1">
            {name}
        </Text>
    );
}
