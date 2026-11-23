// Token Radar model (radar-3): one sealed snapshot in, one ranked board out.
//
// The board ranks only genuine pre-token candidates. A protocol counts as a candidate when its
// DefiLlama record carries no token at all (no market cap, no CoinGecko id, no symbol) AND it is
// not a wrapped, staked or bridged product of a token that already trades: the same exclusion the
// snapshot's own watchlist rule uses (category Bridge / Canonical Bridge / Liquid Staking /
// Liquid Restaking / Restaked BTC / CEX, a name with a whole word wrapped, staked or staking, a
// name that starts with an exchange's name, or a name that ends in a version marker). WBTC is
// Bitcoin on Ethereum and Binance staked ETH is ETH in a staking product: neither is a protocol
// still waiting on a launch of its own, so neither is ranked, however large its TVL.
//
// Implied value follows only from the snapshot's own figures, the same function for every row:
//
//   multiple    = the category's median market-cap/TVL among the snapshot's live protocols
//                 (5 or more live in the category; otherwise the whole-market median 0.169),
//                 clamped to 0.05..0.70: the market's own pricing of the same kind of token
//   base        = tvl_usd x multiple
//   growth      = clamp(change_7d, -80, 150) per cent
//   growthMult  = 1 + (growth / 100) x GROWTH_WEIGHT
//   age         = days from listed_at to as_of (unknown: 180)
//   maturity    = 0.5 + min(age, 1460) / 1460 x 0.5
//   breadth     = 1 + 0.04 x min(chains - 1, 5)
//   implied     = max(1, round(base x growthMult x maturity x breadth))
//
// A flat multiple would price a lending token like a DEX token; the market does not. The median
// is used because a few live records carry a market cap far above their TVL (one at 400x), and a
// median is unmoved by them. No protocol name is ever special-cased. The dashboard's model
// sandbox re-runs this same function in the page when a reader moves a slider, so the board is a
// model, not a list.

/** One protocol entry of the sealed snapshot: exactly its ten fields. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole sealed snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_step: number;
  breadth_max_steps: number;
  /** The sandbox's scale on the calibrated multiple: 1 is the market's own pricing. */
  market_scale: number;
  /** Live protocols a category needs before its own median is used instead of the market's. */
  calibration_min_live: number;
  calibration_floor: number;
  calibration_cap: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -80,
  growth_cap: 150,
  maturity_floor: 0.5,
  maturity_range: 0.5,
  maturity_days: 1460,
  unknown_age_days: 180,
  breadth_step: 0.04,
  breadth_max_steps: 5,
  market_scale: 1,
  calibration_min_live: 5,
  calibration_floor: 0.05,
  calibration_cap: 0.7,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the "already trading" view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    base_source: string;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** A board row's compact form for data.js. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_multiple: number;
  base_source: string;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  farm_steps: string[];
  watch: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One calibrated category: its median market-cap/TVL and how many live protocols set it. */
export interface CalibrationRow {
  category: string;
  live_count: number;
  multiple: number;
}

/** The whole calibration, derived from the snapshot's live protocols: what the dashboard shows. */
export interface Calibration {
  global_multiple: number;
  global_live_count: number;
  min_live: number;
  floor: number;
  cap: number;
  by_category: CalibrationRow[];
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  calibration: Calibration;
  watchlist_size: number;
  board_size: number;
  live_size: number;
  total_implied_usd: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Categories that move value between chains instead of carrying a token of their own. */
const BRIDGE_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Cross Chain Bridge']);

/** The middle of a sorted list (the lower middle when its length is even): a median. */
function median(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)]!;
}

const round3 = (n: number): number => Math.round(n * 1e3) / 1e3;

/**
 * The base multiples, calibrated from the snapshot's own live protocols: every protocol with a
 * market cap and a CoinGecko id, not a CEX and not a bridge (a bridge's market cap is the bridged
 * asset's, not its own token's). A category with at least `calibration_min_live` live protocols
 * gets its own median market-cap/TVL; every other category uses the whole-market median. Both are
 * clamped to the model's floor and cap, so no single outlier can set a multiple.
 */
export function calibrateMultiples(snapshot: Snapshot, model: ModelConstants): Calibration {
  const live = snapshot.protocols.filter(
    (p) =>
      p.mcap_usd !== null &&
      p.gecko_id !== null &&
      p.tvl_usd > 0 &&
      p.category !== 'CEX' &&
      !BRIDGE_CATEGORIES.has(p.category ?? ''),
  );
  const global = median(live.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b));
  const globalMultiple = round3(Math.min(model.calibration_cap, Math.max(model.calibration_floor, global)));
  const byCategory = new Map<string, number[]>();
  for (const p of live) {
    const list = byCategory.get(p.category ?? 'n/a');
    if (list === undefined) byCategory.set(p.category ?? 'n/a', [p.mcap_usd! / p.tvl_usd]);
    else list.push(p.mcap_usd! / p.tvl_usd);
  }
  const rows: CalibrationRow[] = [];
  for (const [category, ratios] of [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))) {
    if (ratios.length < model.calibration_min_live) continue;
    rows.push({
      category,
      live_count: ratios.length,
      multiple: round3(Math.min(model.calibration_cap, Math.max(model.calibration_floor, median(ratios.sort((a, b) => a - b))))),
    });
  }
  return {
    global_multiple: globalMultiple,
    global_live_count: live.length,
    min_live: model.calibration_min_live,
    floor: model.calibration_floor,
    cap: model.calibration_cap,
    by_category: rows,
  };
}

/** One protocol's calibrated base multiple and where it came from. */
export function baseMultipleFor(category: string | null, calibration: Calibration): { multiple: number; source: string } {
  const row = calibration.by_category.find((r) => r.category === (category ?? 'n/a'));
  if (row !== undefined) return { multiple: row.multiple, source: `${row.category} median, ${row.live_count} live` };
  return { multiple: calibration.global_multiple, source: 'whole-market median' };
}

/** The four multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  calibration: Calibration,
): { implied: number; baseMultiple: number; baseSource: string; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.max(0, protocol.chains.length - 1);
  const breadthMult = 1 + model.breadth_step * Math.min(extraChains, model.breadth_max_steps);
  const { multiple, source } = baseMultipleFor(protocol.category, calibration);
  const base = protocol.tvl_usd * multiple * model.market_scale;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * breadthMult));
  return { implied, baseMultiple: multiple, baseSource: source, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const WRAPPED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** Exchange names a wrapped product's name may begin with. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** A whole word wrapped, staked or staking, in any case. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is a genuine token-launch candidate: pre-token, and not a wrapped, staked
 * or bridged product of a token that already trades, not an exchange, not a versioned pool.
 * This is the snapshot's own watchlist rule, applied to the whole board.
 */
export function isCandidate(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && WRAPPED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names is ranked, whatever else the board holds.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other genuine pre-token candidate, at any TVL. A wrapped or staked
  // product never enters, however large its TVL: its token already trades.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isCandidate(p)) chosen.set(p.slug, p);
  }

  const calibration = calibrateMultiples(snapshot, model);
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, calibration);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: s.baseMultiple,
      base_source: s.baseSource,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Keep the position open and check the protocol's own page for its points.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 120;
  if (p.tvl_usd >= 50_000_000) return 80;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The weekly action that keeps a position alive, in the words of its own category. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Once a week, repay a small slice of the loan on ${name} and borrow it back, so the position shows fresh activity.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return `Once a week, swap a small amount through the main pool on ${name} or add a little liquidity, so the position shows fresh activity.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Once a week, close the hedged trade on ${name} and open a fresh one of the same size.`;
  if (c.includes('prediction')) return `Once a week, take one small position on a new ${name} market.`;
  if (c.includes('curator') || c.includes('allocator')) return `Once a week, check the vault's allocation on ${name} and add a small top-up when the mix changes.`;
  if (c.includes('stable')) return `Once a week, mint or redeem a small amount of the stable asset through ${name}.`;
  if (c.includes('rwa')) return `Once a week, check the asset's yield accrual on ${name} and claim any distributions.`;
  if (c.includes('restak') || c.includes('staking')) return `Once a week, check the staking rewards on ${name} and restake what has accrued.`;
  if (c.includes('bridge')) return `Once a week, bridge a small amount through ${name} and use the funds inside its app.`;
  return `Do one real action every week on ${name}, such as a deposit, a swap, a borrow or a vote.`;
}
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Lend $${capital} of USDC on ${name} (${chain}) and leave the loan open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return `Add $${capital} of liquidity to the main pool on ${name} (${chain}) and leave it in.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged trade.`;
  if (c.includes('prediction')) return `Fund $${capital} and take one position on a ${name} market.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and hold the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the yield-bearing asset on ${name} (${chain}) and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('restak') || c.includes('staking')) return `Stake $${capital} of the chain asset through ${name} and keep the receipt token.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC into ${chain} through ${name} and use the funds inside its app.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and leave the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const gas = capital >= 200 ? 10 : capital >= 120 ? 6 : 4;
  return [
    {
      text: `Open a fresh wallet for this farm only, fund it with exactly $${capital} plus gas, and store its seed phrase offline.`,
      cost: 'about $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyActionFor(p),
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Keep the position open for at least ${hold} days so it is counted in more than one activity snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, check the protocol's own rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Log the wallet, the dates and every transaction hash, so you can repeat the position or unwind it cleanly.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's "already trading" view.
 *  Bridges are left out: a bridge's market cap is the bridged asset's (MNT, POL), not a token
 *  the bridge itself issued, so it is not the market's value for the bridge. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX' && !BRIDGE_CATEGORIES.has(p.category ?? ''))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_multiple: row.model.base_multiple,
    base_source: row.model.base_source,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    farm_steps: row.farm_steps,
    watch: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    calibration: calibrateMultiples(snapshot, model),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    live_size: live.length,
    total_implied_usd: board.reduce((n, r) => n + r.implied_value_usd, 0),
    rows: board.map((r) => radarRow(r, new Set(snapshot.watchlist))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
