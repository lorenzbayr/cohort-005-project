// PROTOTYPE — throwaway. "Prototype how notifications look and behave in the app"
// (wayfinder ticket #7). Three structurally different variants mounted in the real
// app layout, switchable via ?variant=A|B|C and the floating bar at the bottom:
//   A  Knock's prebuilt bell + popover (NotificationIconButton / NotificationFeedPopover),
//      restyled with --rnf-* CSS variables, in the sidebar header.
//   B  Headless (useKnockFeed) bell in the user row at the bottom of the sidebar,
//      opening a compact shadcn-style dropdown.
//   C  Headless sidebar nav item "Notifications" with a count, linking to a full
//      inbox page (/notifications-prototype), plus a toast when one arrives live.
// Everything is wired to the live Knock `development` environment.
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NavLink, useFetcher, useNavigate, useSearchParams } from "react-router";
import {
  KnockProvider,
  KnockFeedProvider,
  NotificationIconButton,
  NotificationFeedPopover,
  useKnockFeed,
} from "@knocklabs/react";
import type { FeedItem } from "@knocklabs/client";
import "@knocklabs/react/dist/index.css";
import "./knock-theme.css";
import { Popover } from "radix-ui";
import { Bell, BellDot, Check, CheckCheck, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { MOCK_MESSAGES, MOCK_MESSAGE_TYPES, type MockMessage } from "./mock-messages";

export const VARIANTS = ["A", "B", "C"] as const;
export type Variant = (typeof VARIANTS)[number];
const VARIANT_NAMES: Record<Variant, string> = {
  A: "Prebuilt popover, sidebar header",
  B: "Headless dropdown, user row",
  C: "Headless nav item + inbox page",
};
const STORAGE_KEY = "cadence-notifications-prototype-variant";

// ---------------------------------------------------------------- variant state

const VariantContext = createContext<{ variant: Variant; setVariant: (v: Variant) => void }>({
  variant: "A",
  setVariant: () => {},
});

export function useVariant() {
  return useContext(VariantContext);
}

function VariantProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromUrl = searchParams.get("variant") as Variant | null;
  const [stored, setStored] = useState<Variant>("A");

  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEY) as Variant | null;
    if (s && VARIANTS.includes(s)) setStored(s);
  }, []);

  // URL wins (shareable); otherwise remember the last one across navigations.
  const variant = fromUrl && VARIANTS.includes(fromUrl) ? fromUrl : stored;

  function setVariant(v: Variant) {
    localStorage.setItem(STORAGE_KEY, v);
    setStored(v);
    setSearchParams(
      (prev) => {
        prev.set("variant", v);
        return prev;
      },
      { replace: true, preventScrollReset: true }
    );
  }

  return <VariantContext.Provider value={{ variant, setVariant }}>{children}</VariantContext.Provider>;
}

// ---------------------------------------------------------------- Knock wiring

export interface KnockConfig {
  publicApiKey: string;
  feedChannelId: string;
  userId: string;
  userToken: string;
}

/**
 * Knock's components only render in the browser. Until hydration finishes we
 * render children without Knock, and each bell shows a static placeholder in the
 * same footprint so the layout doesn't jump.
 */
const KnockReadyContext = createContext(false);

export function NotificationsPrototypeProvider({
  knock,
  children,
}: {
  knock: KnockConfig | null;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setMounted(true);
    const sync = () => setIsDark(document.documentElement.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const inner = <VariantProvider>{children}</VariantProvider>;
  if (!mounted || !knock) return <KnockReadyContext.Provider value={false}>{inner}</KnockReadyContext.Provider>;

  return (
    // key: switching users in the DevUI tears the feed down and builds a new one.
    <KnockProvider
      key={knock.userId}
      apiKey={knock.publicApiKey}
      user={{ id: knock.userId }}
      userToken={knock.userToken}
    >
      <KnockFeedProvider feedId={knock.feedChannelId} colorMode={isDark ? "dark" : "light"}>
        <KnockReadyContext.Provider value={true}>
          <LiveToasts />
          {inner}
        </KnockReadyContext.Provider>
      </KnockFeedProvider>
    </KnockProvider>
  );
}

function useKnockReady() {
  return useContext(KnockReadyContext);
}

/** Fetch once on mount; Knock's feed client already listens on its socket. */
function useFeed() {
  const { feedClient, useFeedStore } = useKnockFeed();
  const items = useFeedStore((s) => s.items);
  const metadata = useFeedStore((s) => s.metadata);
  const loading = useFeedStore((s) => s.loading);
  useEffect(() => {
    feedClient.fetch();
  }, [feedClient]);
  return { feedClient, items, metadata, loading };
}

/** Only variant C toasts; A and B rely on the badge alone. */
function LiveToasts() {
  const { feedClient } = useKnockFeed();
  const { variant } = useVariant();
  const navigate = useNavigate();
  const variantRef = useRef(variant);
  variantRef.current = variant;
  useEffect(() => {
    const onNew = ({ items }: { items: FeedItem[] }) => {
      if (variantRef.current !== "C") return;
      for (const item of items) {
        const m = messageOf(item);
        toast(m.title, {
          description: m.body,
          action: { label: "Open", onClick: () => navigate(m.url) },
        });
      }
    };
    feedClient.on("items.received.realtime", onNew);
    return () => feedClient.off("items.received.realtime", onNew);
  }, [feedClient, navigate]);
  return null;
}

// The mock wording travels in the trigger's `data`; fall back to whatever the
// in-app-test template rendered.
function messageOf(item: FeedItem): Pick<MockMessage, "title" | "body" | "url" | "actor"> {
  const d = (item.data ?? {}) as Partial<MockMessage>;
  const block = item.blocks?.[0] as { rendered?: string } | undefined;
  const rendered = block?.rendered?.replace(/<[^>]+>/g, "") ?? "";
  return {
    title: d.title ?? "Notification",
    body: d.body ?? rendered,
    url: d.url ?? "/",
    actor: d.actor ?? "Cadence",
  };
}

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

// ---------------------------------------------------------------- slots

/** Sidebar header, right of the "Cadence" wordmark. Variant A. */
export function NotificationsHeaderSlot() {
  const { variant } = useVariant();
  const ready = useKnockReady();
  if (variant !== "A") return null;
  if (!ready) return <BellPlaceholder />;
  return <VariantA />;
}

/** Sidebar nav list, last item. Variant C. */
export function NotificationsNavSlot() {
  const { variant } = useVariant();
  const ready = useKnockReady();
  if (variant !== "C") return null;
  return ready ? <VariantCNavItem /> : <VariantCNavItemView count={0} />;
}

/** User row at the bottom of the sidebar, beside Settings. Variant B. */
export function NotificationsFooterSlot() {
  const { variant } = useVariant();
  const ready = useKnockReady();
  if (variant !== "B") return null;
  if (!ready) return <BellPlaceholder small />;
  return <VariantB />;
}

function BellPlaceholder({ small }: { small?: boolean }) {
  return (
    <span className={cn("inline-flex items-center justify-center text-sidebar-foreground/40", small ? "p-1" : "size-8")}>
      <Bell className="size-4" />
    </span>
  );
}

// ---------------------------------------------------------------- Variant A

function VariantA() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  return (
    <div className="cadence-knock">
      <NotificationIconButton ref={ref} badgeCountType="unread" onClick={() => setOpen((o) => !o)} />
      <NotificationFeedPopover
        buttonRef={ref}
        isVisible={open}
        onClose={() => setOpen(false)}
        placement="right-start"
        onNotificationClick={(item) => {
          // The prebuilt cell has no link unless the template sets action_url,
          // so we route from data ourselves and mark it read.
          setOpen(false);
          navigate(messageOf(item).url);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Variant B

function VariantB() {
  const { feedClient, items, metadata } = useFeed();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = metadata.unread_count;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) feedClient.markAllAsSeen();
      }}
    >
      <Popover.Trigger asChild>
        <button
          title="Notifications"
          className="relative rounded-md p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {unread > 0 ? <BellDot className="size-4 text-primary" /> : <Bell className="size-4" />}
          <CountBadge count={unread} className="absolute -right-1.5 -top-1.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="end"
          sideOffset={12}
          className="z-50 w-80 rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              disabled={unread === 0}
              onClick={() => feedClient.markAllAsRead()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">You're all caught up.</li>
            )}
            {items.slice(0, 8).map((item) => {
              const m = messageOf(item);
              const isUnread = !item.read_at;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      feedClient.markAsRead(item);
                      setOpen(false);
                      navigate(m.url);
                    }}
                    className={cn(
                      "flex w-full gap-2 px-3 py-2 text-left transition-colors hover:bg-accent",
                      isUnread && "bg-primary/5"
                    )}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", isUnread ? "bg-primary" : "bg-transparent")} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", isUnread ? "font-semibold" : "font-medium text-muted-foreground")}>
                        {m.title}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{m.body}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(item.inserted_at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------- Variant C

function VariantCNavItem() {
  const { metadata } = useFeed();
  return <VariantCNavItemView count={metadata.unread_count} />;
}

function VariantCNavItemView({ count }: { count: number }) {
  return (
    <NavLink
      to="/notifications-prototype?variant=C"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Bell className="size-4" />
      <span className="flex-1">Notifications</span>
      <CountBadge count={count} />
    </NavLink>
  );
}

/** Full inbox page body for variant C. */
export function NotificationsInboxPage() {
  const ready = useKnockReady();
  if (!ready) return <div className="p-8 text-sm text-muted-foreground">Loading notifications…</div>;
  return <Inbox />;
}

function Inbox() {
  const { feedClient, items, metadata, loading } = useFeed();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  useEffect(() => {
    feedClient.markAllAsSeen();
  }, [feedClient, items.length]);

  const shown = filter === "unread" ? items.filter((i) => !i.read_at) : items;
  const today = shown.filter((i) => Date.now() - new Date(i.inserted_at).getTime() < 86400_000);
  const earlier = shown.filter((i) => !today.includes(i));

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {metadata.unread_count} unread · {metadata.total_count} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5 text-sm">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn("rounded px-3 py-1 capitalize", filter === f ? "bg-accent font-medium" : "text-muted-foreground")}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => feedClient.markAllAsRead()}
            disabled={metadata.unread_count === 0}
            className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40"
          >
            <CheckCheck className="size-4" /> Mark all read
          </button>
        </div>
      </div>

      {loading && items.length === 0 && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && shown.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {filter === "unread" ? "No unread notifications." : "No notifications yet."}
        </div>
      )}

      {[
        ["Today", today],
        ["Earlier", earlier],
      ].map(([label, group]) =>
        (group as FeedItem[]).length === 0 ? null : (
          <section key={label as string} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label as string}</h2>
            <ul className="divide-y rounded-lg border">
              {(group as FeedItem[]).map((item) => {
                const m = messageOf(item);
                const isUnread = !item.read_at;
                return (
                  <li key={item.id} className={cn("group flex items-start gap-3 p-4", isUnread && "bg-primary/5")}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {initials(m.actor)}
                    </span>
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        feedClient.markAsRead(item);
                        navigate(m.url);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm", isUnread ? "font-semibold" : "font-medium")}>{m.title}</span>
                        {isUnread && <span className="size-2 rounded-full bg-primary" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{m.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{timeAgo(item.inserted_at)}</p>
                    </button>
                    <button
                      title={isUnread ? "Mark as read" : "Mark as unread"}
                      onClick={() => (isUnread ? feedClient.markAsRead(item) : feedClient.markAsUnread(item))}
                      className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100"
                    >
                      <Check className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------- floating bar

export function PrototypeBar({ users, currentUserId }: { users: { id: number; name: string; role: string }[]; currentUserId: number | null }) {
  const { variant, setVariant } = useVariant();
  const fetcher = useFetcher<{ ok: boolean; recipient: string; type: string }>();
  const [recipientId, setRecipientId] = useState<string>("");

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      toast.success(`Triggered in-app-test → ${fetcher.data.recipient}`, { duration: 1500 });
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const i = VARIANTS.indexOf(variant);
      if (e.key === "ArrowLeft") setVariant(VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length]);
      if (e.key === "ArrowRight") setVariant(VARIANTS[(i + 1) % VARIANTS.length]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;
  const i = VARIANTS.indexOf(variant);

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-900 px-3 py-1.5 text-xs text-white shadow-xl ring-2 ring-fuchsia-500">
      <span className="font-mono text-fuchsia-300">PROTOTYPE</span>
      <button onClick={() => setVariant(VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length])} className="rounded-full p-1 hover:bg-white/10">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-56 text-center">
        <b>{variant}</b> ({VARIANT_NAMES[variant]})
      </span>
      <button onClick={() => setVariant(VARIANTS[(i + 1) % VARIANTS.length])} className="rounded-full p-1 hover:bg-white/10">
        <ChevronRight className="size-4" />
      </button>
      <span className="h-4 w-px bg-white/30" />
      <fetcher.Form method="post" action="/api/prototype-notify" className="flex items-center gap-1.5">
        <Send className="size-3.5" />
        <select name="type" className="rounded bg-zinc-800 px-1 py-0.5">
          {MOCK_MESSAGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t} → {MOCK_MESSAGES[t].audience}
            </option>
          ))}
        </select>
        <select
          name="recipientId"
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          className="max-w-36 rounded bg-zinc-800 px-1 py-0.5"
        >
          <option value="">to me</option>
          {users
            .filter((u) => u.id !== currentUserId)
            .map((u) => (
              <option key={u.id} value={u.id}>
                to {u.name} ({u.role})
              </option>
            ))}
        </select>
        <button
          type="submit"
          disabled={!currentUserId || fetcher.state !== "idle"}
          className="rounded-full bg-fuchsia-600 px-2 py-0.5 font-medium hover:bg-fuchsia-500 disabled:opacity-50"
        >
          {fetcher.state !== "idle" ? "Sending…" : "Send"}
        </button>
      </fetcher.Form>
    </div>
  );
}
