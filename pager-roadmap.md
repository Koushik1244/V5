# Pager — Build Roadmap

Order: Core loop → Landing page & UX → AI features → UI polish

Reviewed against the current checkout on November 28, 2026. A checked item is implemented or verified as described. Unchecked items labeled **Partial** have some implementation. Unchecked testing items still need a verification run.

---

## PHASE 1 — CORE FEATURE HARDENING

Goal: the money/escrow loop and basic app flow are bulletproof before anything else is built on top.

### 1.1 Smart contract fixes (contracts/PagerEscrow.sol)
- [x] Add `deadline` field to the `Bounty` struct (uint256, unix timestamp)
- [x] Add `refundExpired(uint256 bountyId)` — creator can reclaim funds if deadline passed and bounty still active
- [x] Add a reject path — the creator can emit `SubmissionRejected` for a hunter while leaving the bounty active and funds in escrow.
- [x] Add events: BountyCreated, BountyApproved, BountyRefunded, SubmissionRejected — all four added and emitted
- [x] Deploy the updated escrow interface to Monad testnet — read-only RPC checks confirmed the two-argument create, reject, refund, and deadline getter at the app's configured address, `0xa8c9D1d2CB862f3C91E3C4cBbA7B8DE0fd5Bf8E9`. The earlier handoff address, `0x2FA0964EdE9779B93ce111b275e7F492C263FfCe`, also has that interface.
- [x] Update `src/lib/contracts.ts` with the configured address and updated escrow ABI.

### 1.2 API route consistency
- [x] Pass a deadline to `createBounty(amount, deadline)` from both creation components. The default is 24 hours, and the app reads the bounty ID from the confirmed `BountyCreated` event. Verified with mocked wallets and API calls, plus all four presets against a local escrow deployment.
- [x] Confirm on-chain approval before calling `/api/submission/approve` from `SubmissionCard.tsx`. The client waits for the transaction or recovers a matching approval hash before retrying sync.
- [x] Validate the approval transaction on the server. The API requires a successful Monad testnet receipt with a `BountyApproved` event from the configured escrow for the linked bounty and hunter. Verified with the client request and mocked RPC and database responses.
- [x] Add a creator refund action and `/api/bounty/refund`. The API verifies the refund receipt before saving the status. A local escrow test confirmed that expiry returns the tokens and a failed database sync can retry without another transaction.
- [x] Add a network guard to `SubmissionCard.tsx` approval. It verifies the chain ID after switching.
- [x] Reject other pending submissions on the same bounty when one is approved. The database transaction closes the bounty and updates the submissions together. Verified with mocked rollback, retry, and scope checks.
- [ ] Add a “Not selected” state in `SubmissionCard.tsx`.
- [ ] Verify wallet connection with multiple injected providers and after account changes. The earlier handoff reported a local workaround involving Phantom and MetaMask. `ConnectWallet.tsx` currently uses `window.ethereum` directly.
- [ ] Add a reject button wired to the contract's `reject()` and a new `/api/submission/reject` route.

### 1.3 Data model additions
- [ ] Add a `deadline` date to the bounty model and persist it in the create API. Expand the bounty status enum to `open | completed | expired | refunded`.
- [ ] **Partial.** Enforce `pending | approved | rejected` in the submission schema. All three values are documented in a comment, and the field currently accepts any string.

### 1.4 Core flow testing checklist
- [ ] Create a bounty end to end on Monad testnet and confirm USDC locks.
- [ ] Submit proof as a different wallet. The form and API exist, and this still needs a wallet test on the current checkout.
- [ ] Approve and confirm the hunter receives USDC minus the 2% fee. The contract calculates the fee, and receipt and token transfers still need verification.
- [ ] Test rejection and expiry/refund end to end once the app paths are wired.
- [ ] Add local PagerEscrow regression coverage for create, approve, reject, and refund. The checked-in escrow artifact still exposes the old one-argument create function. `npx --no-install hardhat test --no-compile` ran only the starter `Lock` suite and reported nine failures because the `Lock` artifact is missing.
- [ ] Test wrong-network handling on create and approve with a wallet extension. Both flows verify the resulting chain, and creation was exercised with a mocked wallet.

### 1.5 OPEN INVESTIGATION — approve succeeded but hunter wasn't paid
- [ ] Diagnose the reported missing payout. The historical transaction hash is needed to check the receipt, any revert, and USDC transfer logs for the intended hunter.
- [x] Preserve the transaction hash in the approval UI and provide a database sync retry for matching on-chain approvals.

---

## PHASE 2 — LANDING PAGE & UX FLOW

Goal: someone who has never seen the app can land on it, understand what it is, connect a wallet, and use it without confusion.

### 2.1 Landing page
- [ ] Add a hero that explains Pager and provides a clear call to action. The home route currently opens directly to the live feed and a create button.
- [ ] How it works — 3 step visual (post bounty → local verifies → get paid)
- [ ] Live/sample bounty preview cards pulled from the real feed
- [ ] Footer: links, testnet disclaimer (funds are testnet USDC, not real money)

### 2.2 Onboarding flow
- [x] Prompt for a username on first wallet connection when the user has none.
- [ ] Verify first-time wallet onboarding in a browser with a wallet extension.
- [ ] **Partial.** Add empty states for no nearby bounties, no submissions, and no profile activity. The feed has a generic “No bounties yet” message, and the profile has a “No bounties created yet” message.
- [ ] Replace raw `alert()` network-switch messaging with a proper toast or modal.

### 2.3 Core UX flows to smooth out
- [x] Show a loading state in the feed.
- [ ] Show a feed error state. Fetch failures currently go to the console.
- [ ] Add map loading and error states. Fetch failures currently go to the console.
- [ ] Bounty creation form: inline validation instead of alert() popups
- [ ] **Partial.** Clarify the hunter submission steps. The existing modal collects a description and photo, shows a submitting state, and refreshes the feed on success.
- [ ] **Partial.** Refine approval feedback. The confirm modal shows “Processing...” and has a sync retry, while success and transaction errors still use alerts.
- [ ] **Partial.** Finish the mobile responsiveness pass. Some pages have responsive layouts, and the main route links are hidden below the `md` breakpoint.

### 2.4 Navigation & structure
- [x] Link Feed (Home), Map, Search, and Profile in the desktop menu. Create opens from the Home floating button.
- [ ] Add mobile access to the main route links and confirm the intended menu access for Create.
- [x] Mount wallet connection state globally through the root layout and shared user context. Menu visibility follows the header's scroll and map behavior.
- [x] Wire the light/dark toggle globally through the document root and persist the theme across routes and reloads.

---

## PHASE 3 — AI FEATURES

Goal: layer in intelligence on a stable core. Build in this order — each step unlocks the next.

### 3.1 Foundation: bounty categorization
- [ ] New src/lib/ai.ts — shared Anthropic API client wrapper
- [ ] Add category field to Bounty model (food | event | safety | lost-found | price-check | nightlife | other)
- [ ] Hook into /api/bounty/create — after saving, call Claude with the description, get category, update record
- [ ] Show category tag/badge in BountyFeed and BountyMap cards

### 3.2 Recommendation feed (Instagram-style interest matching)
- [ ] Add categoryInterests map to User model (simple counters per category)
- [ ] Increment score when user submits to or likes a category's bounty
- [ ] New route: /api/bounty/recommended — sorted by relevance blended with recency
- [ ] Update BountyFeed.tsx to use it
- [ ] "For You" vs "Nearby" vs "Recent" toggle

### 3.3 Proof verification
- [ ] New route: /api/ai/verify-submission — vision check, image vs bounty description
- [ ] Add aiMatchScore and aiReasoning fields to Submission model
- [ ] Hook into /api/submission/create — run right after a submission is saved
- [ ] Surface score/reasoning in SubmissionCard.tsx before creator approves

### 3.4 Fraud / AI-image detection
- [ ] Extend the verify-submission call to flag suspicious signals
- [ ] Add fraudFlag and fraudReason fields to Submission model
- [ ] Show warning badge on flagged submissions

### 3.5 Bounty quality check
- [ ] Extend ai.ts with a quality-check call
- [ ] Hook into CreateBounty.tsx client-side before transactions start
- [ ] Gentle suggestion UI, non-blocking

### 3.6 Real likes (currently a static placeholder "0")
- [ ] Add Like model or embedded array
- [ ] New route: /api/bounty/like
- [ ] Wire into the like button in SubmissionCard.tsx
- [ ] Feed likes into categoryInterests scoring from 3.2

---

## PHASE 4 — UI POLISH

- [ ] **Partial.** Replace all `alert()` calls with proper toast notifications. The approval sync path has a toast, and other flows still use alerts.
- [ ] Loading skeletons for Feed, Map, Profile. Feed and Profile currently show loading text.
- [ ] **Partial.** Make empty states consistent across the app. Feed, Search, and Profile have some empty-state copy.
- [ ] **Partial.** Finish the animation and transition pass. Cards, modals, and the header already have transitions.
- [ ] Full mobile QA pass on an actual phone
- [ ] Accessibility pass — alt text, keyboard nav, dark mode contrast
- [ ] Iconography and spacing audit
- [ ] Final visual design pass — typography, color, spacing rhythm

---

## Sequencing notes

- Phase 1 must be solid before Phase 3 — AI features write to models/routes that need to be stable first
- Phase 2 and Phase 1 can overlap — UX polish on existing pages doesn't block contract work
- Within Phase 3, always do 3.1 first — everything else depends on or benefits from category data existing
- Phase 4 should genuinely be last — polishing UI that's about to change wastes rework
