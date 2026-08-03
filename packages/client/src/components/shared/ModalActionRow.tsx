import type { ReactNode } from 'react';

interface ModalActionRowProps {
    children: ReactNode;
}

export default function ModalActionRow({ children }: ModalActionRowProps) {
    return <div className="flex w-full flex-wrap items-center justify-end gap-3">{children}</div>;
}
