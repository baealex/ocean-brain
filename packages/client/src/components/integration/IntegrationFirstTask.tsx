import { useId, useState } from 'react';
import { Button, Input, Label, Text, Textarea, useToast } from '~/components/ui';

export default function IntegrationFirstTask({ canCreate }: { canCreate: boolean }) {
    const id = useId();
    const toast = useToast();
    const [topic, setTopic] = useState('');
    const subject = topic.trim() || '[your topic]';
    const prompt = `Use Ocean Brain to research ${subject}. Search my notes and read the relevant sources. Summarize what they support, distinguish your inferences, and identify unanswered questions. Include links to the original notes using [[title]](note:id). Do not invent sources.${canCreate ? ' Create one new note containing the summary and source links, without changing existing notes, and give me the link to the new note.' : ' Show the summary and source links in this conversation without changing any notes.'}`;

    return (
        <section aria-labelledby={`${id}-heading`} className="mb-5 space-y-3 border-y border-border-subtle py-4">
            <Text id={`${id}-heading`} as="h3" variant="label" weight="medium">
                Try it with your notes
            </Text>
            <Text as="p" variant="meta" tone="secondary">
                {canCreate ? 'Create a summary note with source links.' : 'Summarize your notes without changing them.'}{' '}
                Copy the request to your AI client.
            </Text>
            <div className="space-y-2">
                <Label htmlFor={`${id}-topic`}>What would you like to research?</Label>
                <Input
                    id={`${id}-topic`}
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="A project, decision, or question"
                />
            </div>
            <details>
                <summary className="focus-ring-soft cursor-pointer rounded-lg py-2 text-sm text-fg-secondary">
                    Preview request
                </summary>
                <Textarea aria-label="Research request" readOnly value={prompt} rows={5} className="mt-2" />
            </details>
            <Button
                variant="subtle"
                size="sm"
                disabled={!topic.trim()}
                onClick={async () => {
                    try {
                        await navigator.clipboard.writeText(prompt);
                        toast('Copied request. Paste it into your connected AI client.');
                    } catch {
                        toast('Could not copy. Open Preview request and copy it manually.');
                    }
                }}
            >
                Copy research request
            </Button>
        </section>
    );
}
