import type { IntegrationConnection } from '~/apis/integration.api';
import * as Icon from '~/components/icon';
import { SurfaceCard } from '~/components/shared';
import { Button, Text } from '~/components/ui';
import { getIntegrationActivity } from '~/modules/integration-status';
import { recentTimeSince } from '~/modules/time';

export default function IntegrationActivity({
    integration,
    refreshing,
    onRefresh,
}: {
    integration: IntegrationConnection;
    refreshing: boolean;
    onRefresh: () => void;
}) {
    const report = integration.statusReport;
    const activityAt = report?.reportedAt ?? integration.token?.lastUsedAt;
    if (!activityAt && (!integration.enabled || !integration.token)) return null;

    const activity = getIntegrationActivity(integration);
    const needsAttention = activity.kind === 'failed' || activity.kind === 'overdue';
    const ActivityIcon = needsAttention
        ? Icon.WarningCircle
        : activity.kind === 'succeeded'
          ? Icon.CheckCircle
          : Icon.Clock;
    const result =
        activity.kind === 'succeeded' ? 'Completed' : activity.kind === 'recorded' ? 'Access recorded' : activity.label;

    return (
        <SurfaceCard>
            <section aria-label="Activity" className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <Text as="h2" variant="subheading" weight="medium">
                        Activity
                    </Text>
                    <Button
                        variant="subtle"
                        size="icon-sm"
                        aria-label="Refresh status"
                        title="Refresh status"
                        disabled={refreshing}
                        onClick={onRefresh}
                    >
                        <Icon.Refresh aria-hidden="true" className="h-4 w-4" />
                    </Button>
                </div>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <dt className="text-label text-fg-tertiary">Last result</dt>
                        <dd>
                            <Text
                                as="div"
                                weight="medium"
                                tone={needsAttention ? 'error' : 'default'}
                                className="flex items-center gap-2"
                            >
                                <ActivityIcon
                                    aria-hidden="true"
                                    className={`h-5 w-5 shrink-0 ${activity.kind === 'succeeded' ? 'text-accent-success' : ''}`}
                                />
                                {result}
                            </Text>
                        </dd>
                    </div>
                    <div className="space-y-1.5">
                        <dt className="text-label text-fg-tertiary">{report ? 'Reported by app' : 'Last access'}</dt>
                        <dd>
                            <Text as="div" weight="medium">
                                {activityAt ? (
                                    <time dateTime={activityAt} title={new Date(activityAt).toLocaleString()}>
                                        {recentTimeSince(new Date(activityAt).getTime())}
                                    </time>
                                ) : (
                                    'Not yet'
                                )}
                            </Text>
                        </dd>
                    </div>
                </dl>
                {activity.detail && (
                    <Text
                        as="p"
                        variant="meta"
                        tone="secondary"
                        className="break-words border-t border-border-subtle pt-4"
                    >
                        {activity.detail}
                    </Text>
                )}
            </section>
        </SurfaceCard>
    );
}
