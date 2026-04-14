import type { ReactNode } from 'react';

interface ModalActionRowProps {
    children: ReactNode;
}

export default function ModalActionRow({ children }: ModalActionRowProps) {
    return <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}
