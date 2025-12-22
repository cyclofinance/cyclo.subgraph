import { getOrCreateTotals } from "./cys-flr";
import { CycloVault } from "../generated/schema";
import { DAY, getAccountsMetadata, updateTimeState } from "./common";
import { Address, BigInt, BigDecimal, TypedMap, ethereum, log } from "@graphprotocol/graph-ts";
import { factory, factory__slot0Result } from "../generated/templates/CycloVaultTemplate/factory";

export class Epoch {
    public timestamp: BigInt
    constructor(public date: string, public length: i32, timestamp: i32) {
        this.timestamp = BigInt.fromI32(timestamp);
    }
}
export class Epochs {
    constructor() {}

    // from: https://flare.network/news/a-guide-to-rflr-rewards
    list: Array<Epoch> = [
        // 2024
        new Epoch("2024-07-06T12:00:00Z", 30, 1720267200),
        new Epoch("2024-08-05T12:00:00Z", 30, 1722859200),
        new Epoch("2024-09-04T12:00:00Z", 30, 1725451200),
        new Epoch("2024-10-04T12:00:00Z", 30, 1728043200),
        new Epoch("2024-11-03T12:00:00Z", 30, 1730635200),
        new Epoch("2024-12-03T12:00:00Z", 30, 1733227200),

        // 2025
        new Epoch("2025-01-02T12:00:00Z", 30, 1735819200),
        new Epoch("2025-02-01T12:00:00Z", 30, 1738411200),
        new Epoch("2025-03-03T12:00:00Z", 30, 1741003200),
        new Epoch("2025-04-02T12:00:00Z", 30, 1743595200),
        new Epoch("2025-05-02T12:00:00Z", 30, 1746187200),
        new Epoch("2025-06-01T12:00:00Z", 30, 1748779200),
        new Epoch("2025-07-01T12:00:00Z", 30, 1751371200),
        new Epoch("2025-07-31T12:00:00Z", 30, 1753963200),
        new Epoch("2025-08-30T12:00:00Z", 30, 1756555200),
        new Epoch("2025-09-29T12:00:00Z", 30, 1759147200),
        new Epoch("2025-10-29T12:00:00Z", 30, 1761739200),
        new Epoch("2025-11-28T12:00:00Z", 30, 1764331200),
        new Epoch("2025-12-28T12:00:00Z", 30, 1766923200),

        // 2026
        new Epoch("2026-01-27T12:00:00Z", 30, 1769515200),
        new Epoch("2026-02-26T12:00:00Z", 30, 1772107200),
        new Epoch("2026-03-28T12:00:00Z", 30, 1774699200),
        new Epoch("2026-04-27T12:00:00Z", 30, 1777291200),
        new Epoch("2026-05-27T12:00:00Z", 30, 1779883200),
    ]

    getCurrentEpochIndex(currentTimestamp: BigInt): i32 {
        if (currentTimestamp <= this.list[0].timestamp) {
            return 0;
        }
        if (currentTimestamp >= this.list[this.list.length - 1].timestamp) {
            return this.list.length - 1;
        }
        for (let i = 0; i < this.list.length; i++) {
            if (i + 1 >= this.list.length) break; // last item guard
            if (currentTimestamp > this.list[0].timestamp && currentTimestamp <= this.list[i + 1].timestamp) {
                return i + 1;
            }
        }
        return this.list.length - 1;
    }

    getCurrentEpoch(currentTimestamp: BigInt): Epoch {
        return this.list[this.getCurrentEpochIndex(currentTimestamp)];
    }

    getCurrentEpochTimestamp(currentTimestamp: BigInt): BigInt {
        return this.getCurrentEpoch(currentTimestamp).timestamp;
    }

    getCurrentEpochLength(currentTimestamp: BigInt): i32 {
        return this.getCurrentEpoch(currentTimestamp).length;
    }
}

// global epochs instance
export const EPOCHS = new Epochs();

/**
 * Takes snapshot at the current point in time for all the accounts, each cyclo token eligible amount and
 * total eligible amount and updates the entities snapshot fields accordingly.
 * @param event - The event to determine if it needs a snapshot to take place at its timestamp
 */
export function takeSnapshot(event: ethereum.Event): void {
    const timeState = updateTimeState(event);
    const currentTime = timeState.currentTimestamp;

    // previous snapshot time
    const prevSnapshotEpochIndex = timeState.lastSnapshotEpoch;
    const prevSnapshotDayOfEpoch = timeState.lastSnapshotDayOfEpoch;

    // current possible snapshot time
    const currentEpochIndex = EPOCHS.getCurrentEpochIndex(currentTime);
    const currentEpoch = EPOCHS.list[currentEpochIndex];
    const currentDayOfEpoch = currentEpoch.length - currentEpoch.timestamp.minus(currentTime).div(DAY).toI32();

    // keep it defensive just in case, since it cannot be less than 1
    if (currentDayOfEpoch < 1) return;

    let count = 0; // number of snapshots to duplicate
    let isNewEpoch = false; // we should ignore prevouse avg if 
    if (currentEpochIndex < prevSnapshotEpochIndex) {
        return; // cant take snapshot for older epoch than current
    } else if (currentEpochIndex == prevSnapshotEpochIndex) {
        count = currentDayOfEpoch - prevSnapshotDayOfEpoch;
    } else {
        isNewEpoch = true; // we just started the new epoch
        count = currentDayOfEpoch;
    }

    // skip if on same or older day
    if (count <= 0) return;

    // from here on we know its definitely the time to take new
    // snapshot, so save epoch day and index as last taken snapshot
    timeState.lastSnapshotEpoch = currentEpochIndex;
    timeState.lastSnapshotDayOfEpoch = currentDayOfEpoch;
    timeState.save();

    log.info(
        "Daily snapshot taking process started for day {} of epoch {}, prev snapshot day of epoch: {}, prev snapshot epoch: {}, snapshot count: {}",
        [
            currentDayOfEpoch.toString(),
            currentEpoch.date,
            prevSnapshotDayOfEpoch.toString(),
            EPOCHS.list[prevSnapshotEpochIndex].date.toString(),
            count.toString(),
        ]
    );

    // cache to store solt0 call results for pools
    const poolsSlot0Cache = new TypedMap<string, ethereum.CallResult<factory__slot0Result>>();

    // a map: "token -> total eligible balance of the token (sum of all eligible account snapshot balances for the token)"
    const tokenEligibleBalances = new TypedMap<string, BigInt>();

    // iter over all accounts and calculate their epoch avg snapshot by enforing price range for v3 liquidity positions
    const accountsMetadata = getAccountsMetadata();
    const accountsList = accountsMetadata.accounts.load();
    for (let i = 0; i < accountsList.length; i++) {
        const account = accountsList[i];

        // get all active liquidity v3 positions of the account
        const liquidityV3Balances = account.liquidityV3Balances.load();

        // calculate each token snapshot for the account
        let accountBalanceSnapshot = BigInt.zero();
        const vaultBalances = account.vaultBalances.load();
        for (let j = 0; j < vaultBalances.length; j++) {
            const vaultBalance = vaultBalances[j];

            // factor in the v3 lp positions of the account for the account's vault snapshot balance
            let vaultSnapshotBalance = vaultBalance.balance;
            for (let k = 0; k < liquidityV3Balances.length; k++) {
                const lpv3 = liquidityV3Balances[k];
                if (lpv3.tokenAddress.notEqual(vaultBalance.vault)) continue; // skip if not same token as the vault

                // check if the current market price is within lp position range
                const poolAddressHex = Address.fromBytes(lpv3.poolAddress).toHexString().toLowerCase();
                let slot0Result = poolsSlot0Cache.get(poolAddressHex); // first check the cache
                if (!slot0Result) {
                    // get from onchain if not cached and cache it
                    slot0Result = factory.bind(Address.fromBytes(lpv3.poolAddress)).try_slot0();
                    poolsSlot0Cache.set(poolAddressHex, slot0Result);
                }
                if (slot0Result.reverted) continue;
                const currentTick = slot0Result.value.getTick();
                const isInRange =
                    lpv3.lowerTick <= currentTick &&
                    lpv3.upperTick >= currentTick;

                // deduct the deposit balance from accumulated balance if not in range
                if (!isInRange) {
                    vaultSnapshotBalance = vaultSnapshotBalance.minus(lpv3.depositBalance);
                }
            }

            // calculate current avg and store for vaultBalance
            const prevSnapshotsSum = isNewEpoch
                ? BigInt.zero()
                : vaultBalance.balanceAvgSnapshot.times(BigInt.fromI32(prevSnapshotDayOfEpoch)) // old avg * old day of epoch
            const currentAvgSnapshot = prevSnapshotsSum
                .plus(vaultSnapshotBalance.times(BigInt.fromI32(count)))
                .div(BigInt.fromI32(currentDayOfEpoch));
            vaultBalance.balanceAvgSnapshot = currentAvgSnapshot;
            vaultBalance.save();

            // only positives are valid for account and token for token and account
            const normalizedSnapshot = currentAvgSnapshot.gt(BigInt.zero())
                ? currentAvgSnapshot
                : BigInt.zero();

            // sum up all positive token snapshots for account's total snapshot balance
            accountBalanceSnapshot = accountBalanceSnapshot.plus(normalizedSnapshot);

            // gather account snapshot of the token to update the token's total eligible balance snapshot later on
            const tokenAddress = vaultBalance.vault.toHexString().toLowerCase();
            let tokenTotalEligible = tokenEligibleBalances.get(tokenAddress);
            if (!tokenTotalEligible) {
                tokenTotalEligible = BigInt.zero();
            }
            tokenEligibleBalances.set(tokenAddress, tokenTotalEligible.plus(normalizedSnapshot))
        }

        account.totalCyBalanceSnapshot = accountBalanceSnapshot;
        account.save();
    }

    // update each token total eligible with the taken snapshot
    let totalEligibleSumSnapshot = BigInt.zero(); // to calculate eligible total sum
    for (let i = 0; i < tokenEligibleBalances.entries.length; i++) {
        const tokenAddress = Address.fromString(tokenEligibleBalances.entries[i].key);
        const totalEligible = tokenEligibleBalances.entries[i].value;

        const cycloVault = CycloVault.load(tokenAddress);
        if (cycloVault) {
            const normalizedSnapshot = totalEligible.gt(BigInt.zero()) ? totalEligible : BigInt.zero();
            totalEligibleSumSnapshot = totalEligibleSumSnapshot.plus(normalizedSnapshot);
            cycloVault.totalEligibleSnapshot = normalizedSnapshot;
            cycloVault.save();
        }
    }

    // update totals snapshot
    const totals = getOrCreateTotals();
    totals.totalEligibleSumSnapshot = totalEligibleSumSnapshot;
    totals.save();

    // update eligible share for each account after calculating the total eligible snapshot
    for (let i = 0; i < accountsList.length; i++) {
        const account = accountsList[i];

        // If account has no positive balance, their share is 0
        if (account.totalCyBalanceSnapshot.le(BigInt.zero())) {
            account.eligibleShareSnapshot = BigDecimal.zero();
            account.save();
            continue;
        }

        // If there's no eligible total, but account has positive balance, they have 100%
        if (totalEligibleSumSnapshot.equals(BigInt.zero())) {
            account.eligibleShareSnapshot = BigDecimal.fromString("1");
            account.save();
            continue;
        }

        // Calculate share as decimal percentage
        account.eligibleShareSnapshot = account.totalCyBalanceSnapshot
            .toBigDecimal()
            .div(totalEligibleSumSnapshot.toBigDecimal());
        account.save();
    }

    log.info(
        "Daily snapshot taking process ended for day {} of epoch {}",
        [currentDayOfEpoch.toString(), currentEpoch.date]
    );
}
