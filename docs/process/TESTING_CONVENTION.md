# Ocean Brain Testing Convention

Updated: 2026-06-26

## 1. Philosophy
- Tests are executable feedback, not coverage theater.
- Prefer tests that protect user-visible behavior and business rules over tests that mirror implementation details.
- Choose the simplest test that gives trustworthy feedback. Do what works, not what is fashionable.

## 2. Core Principles
1. Test observable behavior.
- Assert values, rendered output, navigation targets, persisted changes, and error/fallback surfaces.
- Do not assert private state, local implementation details, or library internals unless they are the public contract.
2. Write the failing test first for regressions and bug fixes.
3. Prove assumptions at important boundaries instead of trusting happy-path intuition.
4. Keep tests focused.
- One scenario should fail for one reason.
- Do not mix positive and negative cases in one test unless it is a small table-style unit test where each row proves the same rule.
5. Optimize for long-term signal.
- A good test should protect against regressions, survive refactors, run fast enough to be used often, and remain readable.

## 3. Test Shape
- Prefer Arrange-Act-Assert structure for every test.
- Comments such as `// Arrange`, `// Act`, and `// Assert` are optional.
- Whether comments are used or not, separate Arrange, Act, and Assert with one blank line between phases so the structure is visible while reading.
- A test should have one objective. If the name needs "and", "then also", or "when ... otherwise", split it.
- Avoid Arrange-Act-Assert-Arrange-Act-Assert tests. If a second setup starts after an assertion, it is usually a second scenario.
- Multi-step interaction is acceptable only when it is one user workflow and every assertion supports the same objective.
- Prefer explicit fixtures that describe the scenario over generic shared fixtures that hide what the test is proving.

## 4. Interaction Events
- Use `userEvent` by default for actions a user can perform: click, type, clear, keyboard, tab, select, and upload.
- Create `const user = userEvent.setup()` inside the test and `await` user interactions.
- Prefer submitting forms through user-observable behavior, such as pressing Enter or clicking the submit button.
- Use `fireEvent` only for low-level browser or library events that `userEvent` does not model well, such as scroll, resize, animation events, transition events, or a primitive event contract.
- Do not use `fireEvent.click`, `fireEvent.change`, or `fireEvent.submit` just for convenience when the test is describing a user scenario.
- If `fireEvent` is used in a component test, the reason should be obvious from the event being tested.

## 5. Test Scope Rules
- Unit tests cover pure transforms, validators, serializers, small hooks with stable contracts, and branch-heavy business logic.
- Component tests cover rendered output, accessible labels, visible states, and user interactions through the public UI surface.
- Integration tests cover route, query, mutation, and fallback flows that cross module boundaries.
- Do not add broad screen tests by default. Add one representative integration flow per risky boundary.

## 6. Mocking Rules
- Mock slow or uncontrollable boundaries: network, time, random values, browser APIs, confirmation dialogs, toasts, analytics.
- Keep real code for pure logic and local composition whenever possible.
- Do not expose private state or add test-only props just to make tests easier.
- Mock dependencies that are not part of the end result. Keep dependencies that define the observable result real.
- Prefer one mock seam per scenario. If a test needs many mocks, the scope is probably too wide.

## 7. Frontend Defaults
- Query and search-param logic should use table-style unit tests.
- Mutation hooks should assert API payloads and the public side effects they trigger.
- Navigation tests should prefer accessible links, route params, submitted search params, and active-state contracts.
- Loading, suspense, empty, and error states should assert the visible fallback surface.
- Use `screen.findBy*` for async rendering caused by routing, queries, or suspense.
- Use real timers by default. Use fake timers only when time control is the point of the test.

## 8. Anti-Patterns
- Snapshot-heavy tests for complex screens.
- Assertions on React Query cache internals, TanStack Router internals, or component private state when a public outcome exists.
- Recreating production logic inside the test to compute expected values.
- Over-mocking child modules until the test no longer represents the real contract.
- Asserting cosmetic class names unless styling itself is the contract.
- Multiple independent scenarios inside one test body.
- User-facing interaction tests driven with low-level events when `userEvent` can express the same action.

## 9. Test Audit Checklist
Use this checklist when adding, reviewing, or cleaning up tests. A test should be deleted or rewritten when it mostly proves one of these things:

- Cosmetic class names, raw Tailwind utilities, or DOM structure that users cannot observe.
- A simple snapshot or broad render smoke check with no meaningful contract.
- Behavior already covered by a cheaper or stronger test.
- Copy, layout, or implementation details that can change with a small product-spec adjustment.
- Expected values computed by reimplementing the production algorithm in the test.
- Mocked composition where every meaningful child or boundary is replaced, leaving only import wiring.
- Fixed time sleeps or current-time assertions that can be replaced with a deterministic event, fake timer, or frozen clock.
- A long interaction chain that actually covers several unrelated objectives.

Prefer these replacements:

- Assert accessible roles, labels, submitted payloads, navigation targets, persisted state, error surfaces, and visible user outcomes.
- Use minimal explicit fixtures instead of large seed data when the seed is not the contract.
- Extract small pure helpers only when they expose a stable behavior contract and reduce UI-test implementation coupling.
- Keep class or CSS assertions only for a documented styling contract, and prefer semantic state where possible.
- Split independent positive, negative, and edge cases into separate tests with one Arrange-Act-Assert cycle each.
- For expensive integration and E2E tests, make the protected risk explicit and wait on concrete readiness conditions.

## 10. Ocean Brain FE Baseline
- Route search validation should be covered with focused unit tests.
- Mutation-heavy hooks should cover success, navigation, invalidation, and guarded flows.
- Layout and navigation tests should assert user-visible contracts, not internal composition.
- One composed layout or route test should remain to catch cross-boundary regressions.
- New fallback or recovery UI should ship with a test for the intended visible state.
- New component interaction tests should use `userEvent` unless the interaction is a low-level browser event.

## 11. PR and CI Expectations
- Frontend changes that alter routing, loading, mutation, or fallback behavior should add or update tests unless there is a clear reason not to.
- `pnpm test:ci` is part of CI and must stay green.
- Recommended local validation for FE test changes:
- `pnpm --filter @ocean-brain/client exec vitest run --maxWorkers 1`
- `pnpm test:ci`
- `pnpm type-check`
- `pnpm build`

## 12. Source Notes
- The Pragmatic Programmer tips: testing is a perspective into code, write the failing test before fixing bugs, prove assumptions, test significant states, use tracer bullets, and finish only when tests pass.
- Unit Testing: Principles, Practices, and Patterns: good tests balance protection against regressions, resistance to refactoring, fast feedback, and maintainability.
- Enterprisecraftsmanship guidance: mock dependencies that are not part of the end result, and do not expose private state just to enable tests.

## 13. References
- https://pragprog.com/tips/
- https://www.manning.com/books/unit-testing
- https://freecontent.manning.com/wp-content/uploads/Unit-Testing-Chapter-4-1.pdf
- https://enterprisecraftsmanship.com/posts/when-to-mock/
- https://enterprisecraftsmanship.com/posts/exposing-private-state-to-enable-unit-testing/
