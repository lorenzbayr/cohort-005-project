# In-app notification vendors for Cadence

Research for issue #3 (child of map #2). All sources accessed 2026-11-21.
Scope: in-app feed only (bell, inbox). The vendor owns the notification record.

Criteria, highest priority first: (1) free dev tier (must-have), (2) prebuilt React inbox/bell that can be styled to match shadcn/Tailwind, (3) works with SSR React Router 8 (Node server SDK plus browser SDK), (4) feed secured with a signed user token or HMAC, (5) hosted real-time delivery, (6) low lock-in. Self-hosting is a bonus.

## Summary table

| Vendor | Free tier | Prebuilt React UI / styling | Feed auth | Real-time | Lock-in |
| --- | --- | --- | --- | --- | --- |
| **Novu** | 10k workflow runs/mo, 5 workflows, 30-day inbox retention | `<Inbox>`, `Bell`, render props; **Tailwind classes accepted per element**; headless hooks | HMAC-SHA256 `subscriberHash` | Hosted socket (`socket.novu.co`) | **Lowest**: MIT core, self-hostable |
| **Knock** | 10k messages/mo, unlimited feed retention | `NotificationIconButton` + `NotificationFeedPopover`; CSS vars (`--rnf-*`), render props; headless hooks | **RS256 JWT with expiry** (`signUserToken`), optional scoped grants | Hosted socket | Proprietary; messages listable through the API; workflows managed with the CLI |
| Courier | 10k sends/mo (Inbox on free tier not confirmed) | `CourierInbox`, popup, toast; theme object; shadow-DOM web components | JWT with scopes | Hosted real-time connection | Proprietary |
| SuprSend | 10k notifications/mo, SuprSend branding on feed | `@suprsend/react` drop-in plus headless | Signed JWT user token | Not documented on the page read | Proprietary |
| MagicBell | **1k deliveries/mo** | `FloatingInbox`/`Inbox`, CSS vars/classes | HS256 user JWT | WebSockets (marketing page) | Proprietary |
| Stream (Activity Feeds) | 5k activities, 125k API calls/mo | **No prebuilt bell** (hooks only) | Token signed with API secret | Hosted WebSocket | Proprietary |

"SuggestedStream" from the ticket doesn't match any product. Searches turned up nothing by that name, so I covered the two likely matches, **Stream** (getstream.io) and **SuprSend**.

## SSR with React Router 8: what applies to every vendor

None of the vendors document React Router SSR. Their React inbox components run on the client only. Courier says so outright for Next.js ("add `"use client"`"). Knock's Next.js examples put `KnockProvider` in a `"use client"` file, and its provider identifies the user "when mounted". Novu's quickstart uses a `'use client'` component. Sources: [Courier React](https://www.courier.com/docs/sdk-libraries/courier-react-web), [Knock Next.js inbox blog](https://knock.app/blog/how-to-build-a-custom-inbox-with-nextjs), [Novu Next.js quickstart](https://docs.novu.co/platform/quickstart/nextjs).

My inference for Cadence (not from vendor docs): every candidate follows the same pattern.
1. A server loader (for example the root loader) signs the per-user token with the secret key from a server env var and returns it with the vendor user ID.
2. The bell is a client-only island, rendered after hydration. The server-rendered HTML shows a placeholder bell.
3. When the DevUI user switches, the loader issues a new token, so the provider has to re-key on the user ID.

None of the vendors stands out on this criterion. The hands-on trial should confirm that each SDK imports cleanly during SSR, meaning it doesn't touch `window` at module load.

## Novu

- **Free tier:** 10,000 workflow runs/month, unlimited subscribers, up to 5 workflows, 2 environments, 3 team members. Pro starts at $30/mo. [Pricing](https://novu.co/pricing). Inbox feed retention is 30 days on Free and activity-log retention is 1 day. [Limits](https://docs.novu.co/platform/developer/limits)
- **React UI:** `@novu/react` provides `<Inbox>`, plus `Bell` (with `renderBell`), `Notifications`, and `InboxContent` (with `renderNotification`, `renderSubject`, `renderBody`, `renderAvatar`). [React SDK](https://docs.novu.co/platform/sdks/react)
- **Styling:** The `appearance` prop has three levels. `baseTheme` sets an overall theme (a built-in dark theme exists). `variables` set global colors, radius, and font. `elements` style individual components, and each element value can be a style object or **a string of CSS classes**. The docs show Tailwind strings directly, for example `notification: 'bg-white rounded-lg shadow-sm'`. This is the best fit for shadcn/Tailwind tokens of any vendor here. [Styling](https://docs.novu.co/platform/inbox/configuration/styling)
- **Headless:** The `useNotifications`, `useCounts`, and `useNovu` hooks, with `NovuProvider`. They refetch automatically after actions, and `novu.on('notifications.notification_received')` subscribes to real-time events. `@novu/js` covers apps that don't use React. [Headless mode](https://docs.novu.co/platform/inbox/headless-mode)
- **Feed auth:** HMAC-SHA256 of the `subscriberId`, keyed with the secret key and sent as lowercase hex in the `subscriberHash` prop. You turn it on in the In-App provider integration ("Security HMAC encryption"). With HMAC on, the Inbox won't load without the hash. [Prepare for production](https://docs.novu.co/platform/inbox/prepare-for-production). One caveat: the hash never expires and can't be scoped, unlike a JWT.
- **Real-time:** Hosted socket. `Inbox` accepts `socketUrl` and `socketOptions`, and the default is `https://socket.novu.co`. [React SDK](https://docs.novu.co/platform/sdks/react)
- **Lock-in / self-host:** The core is MIT. The `enterprise` folder has a commercial license. The repo ships a `docker` folder. [GitHub](https://github.com/novuhq/novu). Self-hosted deployment for Enterprise is listed on the pricing page.

## Knock

- **Free tier:** Up to 10,000 messages/month. Feeds per recipient are unlimited, and the Feed API and pre-built components are included. Feed message retention has "No limit, but can be configured". Logs are kept for 30 days. Knock branding stays on. The next tier, Starter, is $250/mo. [Pricing](https://knock.app/pricing)
- **React UI:** `@knocklabs/react` provides `KnockProvider`, `KnockFeedProvider`, `NotificationIconButton`, `NotificationFeedPopover`, `NotificationFeed`, and `NotificationCell`, with a `colorMode="dark"` option. [Feed](https://docs.knock.app/in-app-ui/react/feed). The same `NotificationFeed` also works as a full-page inbox. [Inbox](https://docs.knock.app/in-app-ui/react/inbox)
- **Styling:** Override the `--rnf-*` CSS variables, or replace the stylesheet and target the `rnf-` classes. Render props include `renderItem`, `renderHeader`, `avatar`, and `NotificationCell` children. [Feed](https://docs.knock.app/in-app-ui/react/feed). Tailwind works by mapping `--rnf-*` to shadcn CSS variables, or by going headless. Unlike Novu, Knock doesn't take class strings per element.
- **Headless:** `useKnockClient`, `useNotifications(client, feedId)`, and `useNotificationStore` give you `items` and `metadata`. With headless hooks, "you're responsible for marking items as seen". [Headless feed](https://docs.knock.app/in-app-ui/react/headless/feed)
- **Feed auth:** "Enhanced security mode" is off by default. Knock warns that without it, "a request with your public key can act as any user." When it's on, the client needs a signed user token. That token is an **RS256 JWT** signed with a signing key from the dashboard (`KNOCK_SIGNING_KEY`). `sub` is required, and `iat` and `exp` are recommended. The Node helper `signUserToken` defaults to a 1-hour expiry. `onUserTokenExpiring` lets the client refresh the token, and optional `explicit_grants` limit what each token can do. [Security](https://docs.knock.app/in-app-ui/security-and-authentication). This is the strongest auth model in the comparison.
- **Real-time:** The feed updates over a socket connection hosted by Knock. Sockets in inactive tabs are managed automatically, and there's an experimental BroadcastChannel sync across tabs. [Feed](https://docs.knock.app/in-app-ui/react/feed)
- **Lock-in:** Proprietary and not self-hostable. Messages can be listed per user through the API (`GET /v1/users/{id}/messages`), excluding anything past retention. [API reference](https://docs.knock.app/api-reference). Workflows can be pulled into the repo and pushed back with the CLI or Management API. [CLI](https://docs.knock.app/ai/cli), [mAPI workflows](https://docs.knock.app/mapi-reference/workflows). I found no bulk export feature.

## Courier

- **Free tier:** "Start free with 10,000 sends a month". The Business plan is $0.005 per send from the first one. The pricing page doesn't say whether Inbox is on the free tier. [Pricing](https://www.courier.com/pricing)
- **React UI:** `@trycourier/courier-react` (React 18+) provides `CourierInbox`, `CourierInboxPopupMenu`, `CourierToast`, and `CourierPreferences`. `useCourier()` exposes the inbox state. On Next.js the components render client-side only. [Courier React](https://www.courier.com/docs/sdk-libraries/courier-react-web)
- **Styling:** A `CourierInboxTheme` object with light and dark themes. Custom rows come from render slots (`renderListItem` in React v8, `setListItem()` in web components). The UI is built on web components in a **shadow DOM**, so Tailwind classes from the page can't reach inside. You style through the theme object or fully custom renderers. [Web components SDK](https://www.courier.com/docs/sdk-libraries/courier-ui-inbox-web), [v8 migration guide](https://www.courier.com/docs/sdk-libraries/courier-react-v8-migration-guide)
- **Feed auth:** The backend mints a JWT with the Courier API key, using scopes such as `inbox:read:messages` and `inbox:write:events`, optionally limited to one tenant. The client calls `signIn({ userId, jwt })`. [Courier React](https://www.courier.com/docs/sdk-libraries/courier-react-web)
- **Real-time:** `inbox.listenForUpdates()` keeps the inbox updating, and it syncs "in real time across a user's devices". [Inbox overview](https://www.courier.com/docs/platform/inbox/inbox-overview)
- **Lock-in:** Proprietary. I didn't research export.

## SuprSend

- **Free tier:** 10k notifications/month, including an "In-app notification feed (with SuprSend branding)". Essentials, which removes the branding, is $100/mo. [Pricing](https://www.suprsend.com/pricing)
- **React UI:** `@suprsend/react` offers drop-in components and a headless option. The old `@suprsend/react-inbox` is no longer supported. [Inbox React](https://docs.suprsend.com/docs/inbox-react)
- **Feed auth:** Signed JWT user tokens, which replaced HMAC-signed `subscriber_id`. The page didn't say which key or algorithm signs them. [Inbox React](https://docs.suprsend.com/docs/inbox-react)
- **Real-time, styling, SSR:** Not covered on the page I read. Proprietary.

## MagicBell

- **Free tier:** Builder plan has **1,000 deliveries/month** and 1 project. Each channel counts as a separate delivery. Startup is $249/mo. [Pricing](https://www.magicbell.com/pricing)
- **React UI:** `@magicbell/react` provides `Provider`, `FloatingInbox`, and `Inbox` (with `ItemComponent`). Styling is through predefined class names and CSS vars such as `--magicbell-bg-default`. No hooks are documented. [React library](https://www.magicbell.com/docs/libraries/react)
- **Feed auth:** User JWT, **HS256**, signed with the project secret key. Claims are `user_email` and/or `user_external_id`, plus `api_key`. [User auth](https://www.magicbell.com/docs/api/authentication/user)
- **Real-time:** WebSockets, per [MagicBell inbox](https://www.magicbell.com/inbox) and the [In-App channel](https://www.magicbell.com/docs/channels/in_app) docs. The API's `connection_id` field refers to an Ably connection. [API reference](https://www.magicbell.com/docs/api/reference)
- **Fit:** The 1k-delivery free tier is tight but usable for dev. Few hooks are documented.

## Stream (getstream.io Activity Feeds)

- **Free tier:** The Build plan has 125,000 API calls and 5,000 activities/month, with no overages. Start is $499/mo billed annually. [Pricing](https://getstream.io/activity-feeds/pricing/)
- **React UI:** Hooks and state only (`useFeedActivities`). The docs show no prebuilt bell or inbox. [React docs](https://getstream.io/activity-feeds/docs/react/)
- **Auth / real-time:** The backend signs user tokens with the API secret, and real-time runs over WebSocket. [React docs](https://getstream.io/activity-feeds/docs/react/)
- **Fit:** It's a general activity-feed product, not a notification inbox. With no prebuilt bell it fails criterion 2, so it's out.

## Ranking

1. **Novu**: passes every criterion. It's the best styling fit for shadcn/Tailwind because it accepts class strings per element, and its headless hooks are complete. Its MIT core and self-hosting give it the lowest lock-in. The weak spot is auth: a static HMAC hash with no expiry or scoping. The 5-workflow cap on Free may also limit how many notification types can be prototyped.
2. **Knock**: passes every criterion. It has the strongest feed auth (an expiring RS256 JWT with grants, a Node helper, and a refresh hook), unlimited feed retention on Free, and mature components. Styling goes through CSS variables rather than Tailwind classes. Lock-in is higher: proprietary with no bulk export, though messages are listable and workflows can be kept as code. Starter jumps to $250/mo.
3. **Courier**: viable. Its JWT scopes are good, but the shadow-DOM components resist Tailwind styling, and the pricing page doesn't confirm Inbox on the free tier.
4. **SuprSend**: viable, but the free feed carries SuprSend branding and its docs are thinner.
5. **MagicBell**: only 1k deliveries/mo free, and few hooks are documented.
6. **Stream**: out, because it has no prebuilt bell or inbox.

## Shortlist for a hands-on trial

- **Novu**: the closest match to Cadence's shadcn/Tailwind UI (Tailwind classes in `appearance.elements`), the lowest lock-in (MIT, self-hostable), and a usable free tier (10k runs/mo, 30-day inbox).
- **Knock**: the most robust feed security (an expiring RS256 user token) and unlimited feed retention on a 10k-message free tier. It's the safer pick if expiring per-user tokens turn out to matter more than styling ease.

The trial should check that each SDK survives import during React Router SSR, how token or hash re-issue behaves on a DevUI user switch, and how close each bell gets to shadcn's `Popover` look.
