import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithPlatform as render } from "../../../app-platform/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PointsMembership, PointsScores, RuntimePort, WalletSummary } from "@gleam/core";
import { PointsTokenRow } from "./PointsTokenRow";
import { PointsView } from "./PointsView";

const POINTS_URL = "https://gleamwallet.app/points.html?v=1.2.3";
const GLEAM_URL = "https://gleamwallet.app/gleam.html?v=1.2.3";
const LINK = "https://gleamwallet.app/invite.html?c=MYCODE22";
const SCAN_URL = "https://gleamwallet.app/scan.html?v=1.2.3";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const WALLET: WalletSummary = {
  id: "wallet-1",
  address: "aB3k4f9qP2xR8m1tN6vW3jL7yH0sD9eK5cF9fQx1234",
  name: "Wallet One",
  method: "jwk",
  publicKey: "pub1",
  createdAt: 0,
  updatedAt: 0,
  backupConfirmedAt: null,
};

const LEDGER_WALLET: WalletSummary = { ...WALLET, method: "ledger", device: { kind: "ledger" } };
/** Modeled but never produced; it has no Arweave key to prove ownership with. */
const ETHEREUM_WALLET: WalletSummary = { ...WALLET, method: "ethereum" };

const ONE_POINT = "1000000000000";
const SETTLED_AT = "2026-10-08T00:05:00.000Z";

const MEMBERSHIP: PointsMembership = {
  address: WALLET.address,
  inviteCode: "MYCODE22",
  referred: false,
  joinedAt: Date.parse("2026-10-01T00:00:00Z"),
};

const SCORES: PointsScores = {
  settledAt: SETTLED_AT,
  wallets: [
    {
      address: WALLET.address,
      inviteCode: "MYCODE22",
      referred: false,
      refereeCount: 3,
      totalAtomic: (5n * BigInt(ONE_POINT)).toString(),
      lastDay: { holdingAtomic: ONE_POINT, refereeBonusAtomic: "0", founderBonusAtomic: "0", referrerBonusAtomic: "0" },
      topPercent: 12,
      rank: 5,
      pointsToNextRankAtomic: "1801000000000",
      foundingNumber: 7,
      originalFounder: false,
      seatsLeft: 3,
    },
  ],
};

function fakeRuntime(handlers: Record<string, (payload: unknown) => unknown>): RuntimePort & { send: ReturnType<typeof vi.fn> } {
  return {
    send: vi.fn(async ({ type, payload }: { type: string; payload: unknown }) => {
      // Most tests don't care about the review section's figures.
      const handler = handlers[type] ?? (type === "getScanStats" ? () => null : undefined);
      if (!handler) throw new Error(`Unexpected message type "${type}"`);
      return handler(payload);
    }),
    onMessage: vi.fn(() => () => {}),
  } as unknown as RuntimePort & { send: ReturnType<typeof vi.fn> };
}

const BALANCES = {
  getBalance: () => ONE_POINT,
  getTokenBalances: () => [],
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("PointsTokenRow", () => {
  it("asks a wallet that hasn't joined to sign up, and opens the Points screen", async () => {
    const onOpen = vi.fn();
    const runtime = fakeRuntime({ ...BALANCES, getPointsMemberships: () => ({}) });

    renderWithQuery(<PointsTokenRow runtime={runtime} wallet={WALLET} onOpen={onOpen} />);
    expect(await screen.findByText("Sign up")).toBeTruthy();
    expect(screen.queryByText("GLM")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Gleam Points/ }));

    expect(onOpen).toHaveBeenCalled();
  });

  it("shows GLM letters in place of the Gleam mark while token logos are off", async () => {
    const runtime = fakeRuntime({ ...BALANCES, getPointsMemberships: () => ({}) });

    renderWithQuery(<PointsTokenRow runtime={runtime} wallet={WALLET} onOpen={vi.fn()} showLogo={false} />);
    expect(await screen.findByText("GLM")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("offers a hardware wallet Sign up too", async () => {
    const runtime = fakeRuntime({ ...BALANCES, getPointsMemberships: () => ({}) });

    renderWithQuery(<PointsTokenRow runtime={runtime} wallet={LEDGER_WALLET} onOpen={vi.fn()} />);
    expect(await screen.findByText("Sign up")).toBeTruthy();
  });

  it("says Points is unavailable for a wallet that can't join", async () => {
    const runtime = fakeRuntime({ ...BALANCES, getPointsMemberships: () => ({}) });

    renderWithQuery(<PointsTokenRow runtime={runtime} wallet={ETHEREUM_WALLET} onOpen={vi.fn()} />);
    expect(await screen.findByText("Unavailable")).toBeTruthy();
    expect(screen.queryByText("Sign up")).toBeNull();
  });

  it("shows a joined wallet's settled total and no USD value", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: Date.parse(SETTLED_AT) });
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => SCORES,
    });

    renderWithQuery(<PointsTokenRow runtime={runtime} wallet={WALLET} onOpen={vi.fn()} />);

    expect(await screen.findByText("5.00 points")).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it("shortens a large total and keeps the full number on hover", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: Date.parse(SETTLED_AT) });
    const wallet = { ...SCORES.wallets[0]!, totalAtomic: (194_180n * BigInt(ONE_POINT)).toString() };
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => ({ ...SCORES, wallets: [wallet] }),
    });

    renderWithQuery(<PointsTokenRow runtime={runtime} wallet={WALLET} onOpen={vi.fn()} />);

    const short = await screen.findByText("194.1K points");
    expect(short.parentElement?.getAttribute("title")).toBe("194,180 points");
    expect(screen.getByText("194,180 points").className).toContain("sr-only");
  });
});

/** Matches a paragraph by its whole text, across the spans that set its reward apart. */
const sentence = (text: string) => (_: string, element: Element | null) =>
  element?.tagName === "P" && element.textContent === text;

describe("PointsView", () => {
  it("offers a member a paid review", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => SCORES,
      getScanStats: () => ({
        total: 7,
        paidPlacesLeft: 93,
        rewardAtomic: "12500000000000",
        bountyPoolAtomic: "5000000000000000",
      }),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    const review = within(await screen.findByRole("region", { name: "Scan" }));
    const link = review.getByRole("link", { name: /Start a scan/ });
    expect(link.getAttribute("href")).toBe(`${SCAN_URL}#review`);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(await review.findByText("Scan our code with your agent for 12.50 GLEAM.")).toBeTruthy();
    expect(review.getByText("Plus a 5,000 GLEAM bug bounty.")).toBeTruthy();
  });

  it("keeps the review link once the paid places are taken", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => SCORES,
      getScanStats: () => ({
        total: 131,
        paidPlacesLeft: 0,
        rewardAtomic: "12500000000000",
        bountyPoolAtomic: "5000000000000000",
      }),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    const review = within(await screen.findByRole("region", { name: "Scan" }));
    expect(await review.findByText(/taken\. Confirmed bugs still share the 5,000 GLEAM bounty/)).toBeTruthy();
    expect(review.getByRole("link", { name: /Start a scan/ })).toBeTruthy();
    expect(review.getByText("Scan our code with your agent.")).toBeTruthy();
  });

  it("drops the places line when the stats can't be read", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => SCORES,
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    const review = within(await screen.findByRole("region", { name: "Scan" }));
    await waitFor(() => expect(runtime.send).toHaveBeenCalledWith({ type: "getScanStats", payload: undefined }));
    expect(review.queryByText(/paid places|bounty/i)).toBeNull();
    expect(review.queryByText(/GLEAM/)).toBeNull();
  });

  it("hides the review section until the wallet has joined", async () => {
    const runtime = fakeRuntime({ ...BALANCES, getPointsMemberships: () => ({}), getPointsPendingInvite: () => null });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Join Gleam Points" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Scan" })).toBeNull();
    expect(runtime.send).not.toHaveBeenCalledWith({ type: "getScanStats", payload: undefined });
  });

  it("joins with a typed invite code, then shows the wallet's standing", async () => {
    let memberships: Record<string, PointsMembership> = {};
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => memberships,
      getPointsScores: () => SCORES,
      joinPoints: () => {
        memberships = { [WALLET.id]: MEMBERSHIP };
        return MEMBERSHIP;
      },
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText(/Invite code/), { target: { value: " friend42 " } });
    fireEvent.click(screen.getByRole("button", { name: "Join Gleam Points" }));

    await waitFor(() =>
      expect(runtime.send).toHaveBeenCalledWith({ type: "joinPoints", payload: { walletId: WALLET.id, inviteCode: "friend42" } }),
    );
    expect(await screen.findByText("Rank #5")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Invite a friend" })).toBeTruthy();
  });

  it("lets a hardware wallet join and points to the approval window while its device signs", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({}),
      getPointsPendingInvite: () => null,
      joinPoints: () => new Promise(() => {}),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={LEDGER_WALLET} onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Join Gleam Points" }));

    expect((await screen.findByRole("status")).textContent).toBe("Approve on your device in the window that opened.");
    expect(runtime.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "joinPoints", payload: expect.objectContaining({ walletId: LEDGER_WALLET.id }) }),
    );
  });

  it("says a watch wallet can't join because it is watch-only", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({}),
      getPointsPendingInvite: () => null,
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={{ ...WALLET, method: "watch", publicKey: "" }} onBack={vi.fn()} />);

    const button = await screen.findByRole("button", { name: "Join Gleam Points" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("This wallet is watch-only, so it can't join Gleam Points.")).toBeTruthy();
  });

  it("disables joining for a wallet that can't join and says why", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({}),
      getPointsPendingInvite: () => null,
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={ETHEREUM_WALLET} onBack={vi.fn()} />);

    const button = await screen.findByRole("button", { name: "Join Gleam Points" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("This wallet can't join Gleam Points. Switch to a keyfile wallet.")).toBeTruthy();
    fireEvent.click(button);
    expect(runtime.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "joinPoints" }));
  });

  it("lays out the not-joined state in order, pre-filled from the pending code", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({}),
      getPointsPendingInvite: () => "PENDING1",
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);
    const field = (await screen.findByLabelText(/Invite code/)) as HTMLInputElement;
    await waitFor(() => expect(field.value).toBe("PENDING1"));

    const line = screen.getByText("Earn Gleam Points every day");
    const join = screen.getByRole("button", { name: "Join Gleam Points" });
    const note = screen.getByText(/Joining links this wallet's address to this browser/);
    expect(screen.queryAllByRole("link")).toEqual([]);
    const about = screen.getByRole("button", { name: "About Gleam Points" });
    fireEvent.click(about);
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([POINTS_URL, GLEAM_URL]);
    expect(screen.queryByRole("button", { name: "Leave Gleam Points" })).toBeNull();
    for (const [before, after] of [[line, field], [field, join], [join, note], [note, about]] as const) {
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    fireEvent.click(join);
    await waitFor(() =>
      expect(runtime.send).toHaveBeenCalledWith({ type: "joinPoints", payload: { walletId: WALLET.id, inviteCode: "PENDING1" } }),
    );
  });

  it("lays out the joined state in order: standing, invite, footer", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => SCORES,
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);
    expect(await screen.findByText("Rank #5")).toBeTruthy();
    expect(screen.queryByText(/OG/)).toBeNull();
    expect(screen.queryByText(/Early member/)).toBeNull();

    const standing = within(screen.getByRole("region", { name: "Standing" }));
    expect(standing.getByText(/^[\d.,]+ points$/)).toBeTruthy();
    expect(standing.queryByText("Per day")).toBeNull();
    expect(standing.queryByText("Friends joined")).toBeNull();

    expect(screen.getByRole("region", { name: "Invite" })).toBeTruthy();
    expect(screen.queryByText("3 invites remaining")).toBeNull();
    expect(screen.getByRole("region", { name: "More ways to earn" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Invite" })).getByText(sentence("Earn an extra 10% daily for every friend who joins."))).toBeTruthy();
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    fireEvent.click(screen.getByRole("button", { name: "Invite a friend" }));
    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(screen.getByText("3 invites remaining")).toBeTruthy();

    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Start a scan ↗"]);
    expect(screen.queryByRole("button", { name: "Leave Gleam Points" })).toBeNull();
    const about = screen.getByRole("button", { name: "About Gleam Points" });
    expect(about.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(about);
    expect(about.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: /How to earn points/ }).getAttribute("href")).toBe(POINTS_URL);
    expect(screen.getByRole("link", { name: /The future of Gleam/ }).getAttribute("href")).toBe(GLEAM_URL);
    const leave = screen.getByRole("button", { name: "Leave Gleam Points" });
    expect(screen.getByRole("link", { name: /The future of Gleam/ }).compareDocumentPosition(leave) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const sections = [
      screen.getByRole("region", { name: "Standing" }),
      screen.getByRole("region", { name: "Invite" }),
      screen.getByRole("contentinfo"),
    ];
    for (let i = 1; i < sections.length; i += 1) {
      expect(sections[i - 1]!.compareDocumentPosition(sections[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("shows the early member bonus in Standing", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => ({ ...SCORES, wallets: [{ ...SCORES.wallets[0]!, originalFounder: true }] }),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    expect(await screen.findByText("Earning 10% more as an early member")).toBeTruthy();
  });

  it("lists recent earnings by source, biggest first, linking a finding to its PR", async () => {
    const recentAt = new Date(Date.now() - 60_000).toISOString();
    const points = (n: bigint) => (n * BigInt(ONE_POINT)).toString();
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => ({
        ...SCORES,
        wallets: [
          {
            ...SCORES.wallets[0]!,
            recent: [
              { kind: "scan", amountAtomic: points(250n), at: recentAt, release: "1.42.0" },
              { kind: "invites", amountAtomic: points(75n), at: recentAt },
              { kind: "finding", amountAtomic: points(1000n), at: recentAt, release: "1.42.0", ref: "https://github.com/o/r/pull/142" },
            ],
          },
        ],
      }),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    const toggle = await screen.findByRole("button", { name: /Recent earnings/ });
    expect(toggle.textContent).toContain("+1,325");
    expect(screen.queryAllByRole("listitem")).toEqual([]);
    fireEvent.click(toggle);
    const recent = within(screen.getByRole("region", { name: "Recent earnings" }));
    expect(recent.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Finding↗PR #142 · v1.42.0+1,000",
      "Security scanv1.42.0+250.00",
      "Invites3 friends · 10% of their points+75.00",
    ]);
    expect(recent.getByRole("link", { name: /Finding/ }).getAttribute("href")).toBe("https://github.com/o/r/pull/142");
    const ways = screen.getByRole("region", { name: "More ways to earn" });
    expect(ways.compareDocumentPosition(screen.getByRole("region", { name: "Recent earnings" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("hides Recent earnings when nothing was credited in the last two days", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => ({
        ...SCORES,
        wallets: [{ ...SCORES.wallets[0]!, recent: [{ kind: "friendJoined", at: new Date().toISOString() }] }],
      }),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    expect(await screen.findByText("Rank #5")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Recent earnings" })).toBeNull();
    expect(screen.queryByText("Today")).toBeNull();
  });

  it("leaves the invite slots empty until the server reports them", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => ({
        ...SCORES,
        wallets: [{ ...SCORES.wallets[0]!, foundingNumber: null, seatsLeft: null }],
      }),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);
    expect(await screen.findByText("Rank #5")).toBeTruthy();

    expect(screen.queryByText(/invites? remaining/)).toBeNull();
    expect(screen.getByRole("region", { name: "Invite" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Invite a friend" })).toBeTruthy();
  });

  it("says the invites are used and offers nothing to share at zero seats", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => ({ ...SCORES, wallets: [{ ...SCORES.wallets[0]!, seatsLeft: 0 }] }),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    expect(await screen.findByText("All your invites are used. You get two more when a friend you invited joins Points.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Invite a friend" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "About Gleam Points" }));
    expect(screen.getByText("You get two more when a friend you invited joins Points.")).toBeTruthy();
  });

  it("shows why a join failed", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({}),
      joinPoints: () => {
        throw new Error("That invite code isn't valid.");
      },
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Join Gleam Points" }));

    expect(await screen.findByText("That invite code isn't valid.")).toBeTruthy();
  });

  it("offers to reconnect a wallet the server lists under another install", async () => {
    let wallets: PointsScores["wallets"] = [];
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => ({ settledAt: null, wallets }),
      joinPoints: () => {
        wallets = SCORES.wallets;
        return MEMBERSHIP;
      },
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    const notice = within(await screen.findByRole("region", { name: "Left on another browser" }));
    expect(notice.getByRole("heading", { name: "Left on another browser" })).toBeTruthy();
    expect(screen.queryByText(/Top \d+%/)).toBeNull();
    expect(screen.queryByRole("region", { name: "More ways to earn" })).toBeNull();
    fireEvent.click(notice.getByRole("button", { name: "Join again" }));

    await waitFor(() =>
      expect(runtime.send).toHaveBeenCalledWith({ type: "joinPoints", payload: { walletId: WALLET.id } }),
    );
    expect(await screen.findByRole("region", { name: "More ways to earn" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Left on another browser" })).toBeNull();
  });

  it("shows why a reconnect failed", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => ({ settledAt: null, wallets: [] }),
      joinPoints: () => {
        throw new Error("Couldn't join Gleam Points: HTTP 503");
      },
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Join again" }));

    expect(await screen.findByText("Couldn't join Gleam Points: HTTP 503")).toBeTruthy();
  });

  it("doesn't offer a reconnect before the scores load", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => new Promise(() => {}),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    const standing = within(await screen.findByRole("region", { name: "Standing" }));
    expect(standing.queryByText(/Top \d+%|daily snapshot/)).toBeNull();
    expect(screen.queryByRole("region", { name: "Left on another browser" })).toBeNull();
  });

  it("swaps the total for the percentile on a tap", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => SCORES,
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    const standing = within(await screen.findByRole("region", { name: "Standing" }));
    expect(await standing.findByText("Rank #5")).toBeTruthy();
    expect(standing.queryByText("Top 12%")).toBeNull();
    const corner = standing.getByRole("button", { pressed: false });
    fireEvent.click(corner);
    expect(standing.getByText("Top 12%")).toBeTruthy();
    expect(corner.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(corner);
    expect(standing.queryByText("Top 12%")).toBeNull();
  });

  it("shows the leader's total without a toggle", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => ({ ...SCORES, wallets: [{ ...SCORES.wallets[0]!, rank: 1, topPercent: 100, pointsToNextRankAtomic: null }] }),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    const standing = within(await screen.findByRole("region", { name: "Standing" }));
    expect(await standing.findByText("Rank #1")).toBeTruthy();
    expect(standing.queryByRole("button")).toBeNull();
  });

  it("leads with the total and says when a rank comes until a snapshot credits the wallet", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => ({
        ...SCORES,
        wallets: [{ ...SCORES.wallets[0]!, rank: null, topPercent: null, pointsToNextRankAtomic: null }],
      }),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    expect(await screen.findByText("You're ranked once a daily snapshot credits your points.")).toBeTruthy();
    expect(screen.queryByText(/Rank #|Unranked|points to pass/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "About Gleam Points" }));
    expect(screen.getByText("Snapshots run just after midnight UTC.")).toBeTruthy();
  });

  it("asks an unranked wallet with no AR or AO to hold some", async () => {
    const runtime = fakeRuntime({
      getBalance: () => "0",
      getTokenBalances: () => [],
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => ({
        ...SCORES,
        wallets: [{ ...SCORES.wallets[0]!, totalAtomic: "0", rank: null, topPercent: null, pointsToNextRankAtomic: null }],
      }),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    expect(await screen.findByText("Hold AR or AO in this wallet to start earning.")).toBeTruthy();
    expect(screen.queryByText(/daily snapshot credits/)).toBeNull();
  });

  it("shows the private rank and the points needed to pass the next one", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => SCORES,
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    expect(await screen.findByText("Rank #5")).toBeTruthy();
    expect(screen.getByText("1.80 points to pass #4.")).toBeTruthy();
  });

  it("shows #1 for the leader, even as the only ranked wallet", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => ({
        ...SCORES,
        wallets: [{ ...SCORES.wallets[0]!, rank: 1, topPercent: 100, pointsToNextRankAtomic: null }],
      }),
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);

    const standing = within(await screen.findByRole("region", { name: "Standing" }));
    expect(await standing.findByText("Rank #1")).toBeTruthy();
    expect(screen.queryByText(/points to pass/)).toBeNull();
  });

  it("copies the invite link", async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => SCORES,
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Invite a friend" }));

    expect(writeText).toHaveBeenCalledWith("https://gleamwallet.app/invite.html?c=MYCODE22");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("leaves after confirming, then offers to join again", async () => {
    let memberships: Record<string, PointsMembership> = { [WALLET.id]: MEMBERSHIP };
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => memberships,
      getPointsScores: () => SCORES,
      leavePoints: () => {
        memberships = {};
      },
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "About Gleam Points" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave Gleam Points" }));
    expect(screen.getByText(/cannot be undone/)).toBeTruthy();
    expect(runtime.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "leavePoints" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));

    await waitFor(() =>
      expect(runtime.send).toHaveBeenCalledWith({ type: "leavePoints", payload: { walletId: WALLET.id } }),
    );
    expect(await screen.findByRole("button", { name: "Join Gleam Points" })).toBeTruthy();
  });

  it("backs out of leaving with Cancel", async () => {
    const runtime = fakeRuntime({
      ...BALANCES,
      getPointsMemberships: () => ({ [WALLET.id]: MEMBERSHIP }),
      getPointsScores: () => SCORES,
    });

    renderWithQuery(<PointsView runtime={runtime} wallet={WALLET} onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "About Gleam Points" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave Gleam Points" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText(/cannot be undone/)).toBeNull();
    expect(screen.getByRole("button", { name: "Leave Gleam Points" })).toBeTruthy();
  });
});
