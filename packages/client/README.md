# Ocean Brain client

## Page headers and back navigation

Use `PageLayout` for page titles and header actions. Detail and setup pages with a parent page use its `backLink` slot with `PageBackLink`; this shared component owns the arrow, button style, and alignment. Keep page actions in `headerRight`.

```tsx
import { PageLayout } from '~/components/shared';
import PageBackLink from '~/components/shared/PageBackLink';
import { SETTINGS_INTEGRATIONS_ROUTE } from '~/modules/url';

<PageLayout
    title="App settings"
    backLink={<PageBackLink to={SETTINGS_INTEGRATIONS_ROUTE}>Integrations</PageBackLink>}
>
    {/* Page content */}
</PageLayout>
```

`PageBackLink` accepts the same typed routing props as TanStack Router's `Link`. Point it to the parent route and preserve relevant search parameters, such as the image list's page number. Use a destination label so the action remains predictable when a detail page is opened directly. Do not recreate the arrow and spacing in individual pages.

## Embedded app design

The reference integration apps use the same visual language as the host. Use [theme tokens and typography](src/styles/tailwind.css), [Button variants](src/components/ui/Button/variants.ts), [PageLayout](src/components/shared/PageLayout.tsx), and [Search](src/pages/Search.tsx) as the source for their visual rules. Avoid creating a separate palette or page width for an embedded example.

Apps run in isolated documents and receive the host's current visual tokens through the optional [appearance bridge](../../docs/INTEGRATIONS.md#embedded-app-appearance). Keep component behavior local to the app; do not relax the iframe sandbox to reuse host UI.
