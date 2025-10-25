import { Link } from 'react-router-dom';

import { Badge, Dropdown } from '~/components/shared';
import * as Icon from '~/components/icon';

import type { Note } from '~/models/note.model';

import { timeSince } from '~/modules/time';
import { getNoteURL } from '~/modules/url';

interface Props {
    notes: Note[];
    onPinned?: (id: number, pinned: boolean) => void;
    onDelete?: (id: number) => void;
}

export default function NoteListTable({ notes, onPinned, onDelete }: Props) {
    return (
        <div className="overflow-x-auto mt-3">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                        <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Title</th>
                        <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Tags</th>
                        <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Created</th>
                        <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Updated</th>
                        <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {notes.map((note) => {
                        const createdAtText = new Date(Number(note.createdAt)).toLocaleDateString();
                        const updatedTimeSince = timeSince(Number(note.updatedAt));

                        return (
                            <tr
                                key={note.id}
                                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                <td className="p-3">
                                    {note.pinned && (
                                        <Icon.Pin className="text-red-500 fill-red-500" width={16} height={16} />
                                    )}
                                </td>
                                <td className="p-3">
                                    <Link
                                        className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                                        to={getNoteURL(note.id)}
                                    >
                                        {note.title || 'Untitled'}
                                    </Link>
                                </td>
                                <td className="p-3">
                                    {note.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {note.tags.map((tag) => (
                                                <Link key={tag.id} to={`/tag/${tag.id}`}>
                                                    <Badge name={tag.name} />
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{createdAtText}</td>
                                <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{updatedTimeSince}</td>
                                <td className="p-3">
                                    <Dropdown
                                        button={<Icon.VerticalDots className="w-5 h-5" />}
                                        items={[
                                            {
                                                name: note.pinned ? 'Unpin' : 'Pin',
                                                onClick: () => onPinned?.(note.id, note.pinned)
                                            },
                                            {
                                                name: 'Delete',
                                                onClick: () => onDelete?.(note.id)
                                            }
                                        ]}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
