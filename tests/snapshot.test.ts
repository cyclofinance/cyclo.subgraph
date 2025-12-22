import { takeSnapshot, EPOCHS } from "../src/snapshot";
import { createTransferEvent, mockSlot0 } from "./utils";
import { dataSourceMock, newMockEvent } from "matchstick-as";
import { getAccountsMetadata, updateTimeState, DAY } from "../src/common";
import { Address, BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { getLiquidityV2OwnerBalanceId, getLiquidityV3OwnerBalanceId } from "../src/liquidity";
import { assert, describe, test, clearStore, beforeAll, beforeEach, afterEach } from "matchstick-as/assembly/index";
import { Account, VaultBalance, LiquidityV3OwnerBalance, CycloVault, LiquidityV2OwnerBalance, TimeState } from "../generated/schema";
import { ACCOUNTS_METADATA_ID, SparkdexV2LiquidityManager, SparkdexV3LiquidityManager, TIME_STATE_ID, TOTALS_ID } from "../src/constants";

// Test addresses
const USER_1 = Address.fromString("0x0000000000000000000000000000000000000001");
const USER_2 = Address.fromString("0x0000000000000000000000000000000000000002");
const USER_3 = Address.fromString("0x0000000000000000000000000000000000000003");

// Token addresses
const CYSFLR_ADDRESS = Address.fromString("0x19831cfB53A0dbeAD9866C43557C1D48DfF76567");
const CYWETH_ADDRESS = Address.fromString("0xd8BF1d2720E9fFD01a2F9A2eFc3E101a05B852b4");

// Pool address for V3 liquidity
const V3_POOL = Address.fromString("0x16b619B04c961E8f4F06C10B42FDAbb328980A89");

// equals to day 27 of 3rd epoch
const now = EPOCHS.list[2].timestamp.minus(DAY.times(BigInt.fromI32(3)));

// mocked event
const mockeEvent = newMockEvent();
mockeEvent.block.timestamp = now;

describe("Snapshot handling", () => {
  beforeAll(() => {
    dataSourceMock.setNetwork("flare");
  });

  beforeEach(() => {
    clearStore();

    // init the time state with an event at defined "now"
    updateTimeState(createTransferEvent(
      Address.zero(),
      Address.zero(),
      BigInt.zero(),
      Address.zero(),
      null,
      null,
      null,
      EPOCHS.list[2].timestamp.minus(DAY.times(BigInt.fromI32(5))),
    ));
    const timeState = TimeState.load(TIME_STATE_ID)!;
    timeState.lastSnapshotEpoch = 2;
    timeState.lastSnapshotDayOfEpoch = 25;
    timeState.save();
    updateTimeState(createTransferEvent(
      Address.zero(),
      Address.zero(),
      BigInt.zero(),
      Address.zero(),
      null,
      null,
      null,
      now,
    ));
  });

  afterEach(() => {
    clearStore();
  });

  describe("takeSnapshot()", () => {
    test("should handle empty accounts list", () => {
      // Initialize empty AccountsMetadata
      getAccountsMetadata();
      
      // Should not throw error with empty accounts
      takeSnapshot(mockeEvent);
      
      // No entities should be created
      assert.entityCount("Account", 0);
      assert.entityCount("VaultBalance", 0);
      assert.entityCount("CycloVault", 0);
    });

    test("should take snapshot for single account with one vault", () => {
      // Setup account with vault balance
      createMockAccount(
        USER_1,
        BigInt.fromI32(1000),
        BigInt.zero(),
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );
      createMockVaultBalance(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(1000),
        BigInt.zero(),
      );
      createMockCycloVault(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(1),
        BigInt.fromI32(1),
        BigInt.fromI32(0),
        BigInt.fromI32(0),
      );

      // Take snapshot
      takeSnapshot(mockeEvent);

      const expectedSnapshot = BigInt.fromI32(1000) // current balance
        .times(BigInt.fromI32(2)) // x2 because we take 2 snapshots since its from day 25 to 27
        .div(BigInt.fromI32(27)); // /27 as we are at day 27

      // Check vault balance snapshot was added
      assert.fieldEquals(
        "VaultBalance",
        CYSFLR_ADDRESS.concat(USER_1).toHexString(),
        "balanceAvgSnapshot",
        expectedSnapshot.toString()
      );

      // Check account total snapshot
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        expectedSnapshot.toString()
      );

      // Check vault total eligible
      assert.fieldEquals(
        "CycloVault",
        CYSFLR_ADDRESS.toHexString(),
        "totalEligibleSnapshot",
        expectedSnapshot.toString()
      );

      // Check account eligible share (should be 1.0 for single account)
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "eligibleShareSnapshot",
        "1"
      );

      // check total sum
      assert.fieldEquals(
        "EligibleTotals",
        TOTALS_ID,
        "totalEligibleSumSnapshot",
        expectedSnapshot.toString()
      );
    });

    test("should handle multiple snapshots and accounts and tokens with existing prior snpashots", () => {
      // Setup user 1 account and vault (with cysflr)
      createMockAccount(
        USER_1,
        BigInt.fromI32(1000),
        BigInt.zero(),
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );
      const user1Balance = BigInt.fromI32(5000);
      const user1PrevAvg = BigInt.fromI32(700);
      createMockVaultBalance(
        CYSFLR_ADDRESS,
        USER_1,
        user1Balance,
        user1PrevAvg,
      );
      createMockCycloVault(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(1),
        BigInt.fromI32(1),
        BigInt.fromI32(0),
        BigInt.fromI32(0),
      );

      // user 2 (with cysflr)
      createMockAccount(
        USER_2,
        BigInt.fromI32(1000),
        BigInt.zero(),
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );
      const user2Balance = BigInt.fromI32(5000);
      const user2PrevAvg = BigInt.fromI32(1650);
      createMockVaultBalance(
        CYSFLR_ADDRESS,
        USER_2,
        user2Balance,
        user2PrevAvg,
      );
      createMockCycloVault(
        CYSFLR_ADDRESS,
        USER_2,
        BigInt.fromI32(1),
        BigInt.fromI32(1),
        BigInt.fromI32(0),
        BigInt.fromI32(0),
      );

      // user 3 (with cyweth)
      createMockAccount(
        USER_3,
        BigInt.fromI32(5000),
        BigInt.zero(),
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );
      const user3Balance = BigInt.fromI32(5000);
      const user3PrevAvg = BigInt.fromI32(4800);
      createMockVaultBalance(
        CYWETH_ADDRESS,
        USER_3,
        user3Balance,
        user3PrevAvg,
      );
      createMockCycloVault(
        CYWETH_ADDRESS,
        USER_3,
        BigInt.fromI32(1),
        BigInt.fromI32(1),
        BigInt.fromI32(0),
        BigInt.fromI32(0),
      );

      // Take snapshot
      takeSnapshot(mockeEvent);

      // Check that old snapshots were removed and new ones added
      // user 1
      let updatedVaultUser1 = VaultBalance.load(CYSFLR_ADDRESS.concat(USER_1))!;
      // user 2
      let updatedVaultUser2 = VaultBalance.load(CYSFLR_ADDRESS.concat(USER_2))!;
      // user 3
      let updatedVaultUser3 = VaultBalance.load(CYWETH_ADDRESS.concat(USER_3))!;

      // check avg snapshot
      // user 1
      const expectedAvgSnapshotUser1 = user1Balance
        .times(BigInt.fromI32(2)) // 2 snapshot taken, last snapshot was at day 25, not its 27, 27 - 25 = 2
        .plus(user1PrevAvg.times(BigInt.fromI32(25))) // + (prev avg * prev snapshot day)
        .div(BigInt.fromI32(27)) // div by current snapshot day which is 27
      assert.bigIntEquals(updatedVaultUser1.balanceAvgSnapshot, expectedAvgSnapshotUser1);
      // user 2
      const expectedAvgSnapshotUser2 = user2Balance
        .times(BigInt.fromI32(2))
        .plus(user2PrevAvg.times(BigInt.fromI32(25)))
        .div(BigInt.fromI32(27))
      assert.bigIntEquals(updatedVaultUser2.balanceAvgSnapshot, expectedAvgSnapshotUser2);
      // user 3
      const expectedAvgSnapshotUser3 = user3Balance
        .times(BigInt.fromI32(2))
        .plus(user3PrevAvg.times(BigInt.fromI32(25)))
        .div(BigInt.fromI32(27))
      assert.bigIntEquals(updatedVaultUser3.balanceAvgSnapshot, expectedAvgSnapshotUser3);

      const totalSnapshot = expectedAvgSnapshotUser1.plus(expectedAvgSnapshotUser2).plus(expectedAvgSnapshotUser3);

      // Check vault balance snapshot was added
      // user 1
      assert.fieldEquals(
        "VaultBalance",
        CYSFLR_ADDRESS.concat(USER_1).toHexString(),
        "balanceAvgSnapshot",
        expectedAvgSnapshotUser1.toString()
      );
      // user 2
      assert.fieldEquals(
        "VaultBalance",
        CYSFLR_ADDRESS.concat(USER_2).toHexString(),
        "balanceAvgSnapshot",
        expectedAvgSnapshotUser2.toString()
      );
      // user 3
      assert.fieldEquals(
        "VaultBalance",
        CYWETH_ADDRESS.concat(USER_3).toHexString(),
        "balanceAvgSnapshot",
        expectedAvgSnapshotUser3.toString()
      );

      // Check account total snapshot
      // user 1
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        expectedAvgSnapshotUser1.toString()
      );
      // user 2
      assert.fieldEquals(
        "Account",
        USER_2.toHexString(),
        "totalCyBalanceSnapshot",
        expectedAvgSnapshotUser2.toString()
      );
      // user 3
      assert.fieldEquals(
        "Account",
        USER_3.toHexString(),
        "totalCyBalanceSnapshot",
        expectedAvgSnapshotUser3.toString()
      );

      // Check account eligible share
      // user 1
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "eligibleShareSnapshot",
        expectedAvgSnapshotUser1.toBigDecimal().div(totalSnapshot.toBigDecimal()).toString()
      );
      // user 2
      assert.fieldEquals(
        "Account",
        USER_2.toHexString(),
        "eligibleShareSnapshot",
        expectedAvgSnapshotUser2.toBigDecimal().div(totalSnapshot.toBigDecimal()).toString()
      );
      // user 3
      assert.fieldEquals(
        "Account",
        USER_3.toHexString(),
        "eligibleShareSnapshot",
        expectedAvgSnapshotUser3.toBigDecimal().div(totalSnapshot.toBigDecimal()).toString()
      );

      // Check vault total eligible
      // cysflr
      assert.fieldEquals(
        "CycloVault",
        CYSFLR_ADDRESS.toHexString(),
        "totalEligibleSnapshot",
        expectedAvgSnapshotUser1.plus(expectedAvgSnapshotUser2).toString() // 
      );
      // cyweth
      assert.fieldEquals(
        "CycloVault",
        CYWETH_ADDRESS.toHexString(),
        "totalEligibleSnapshot",
        expectedAvgSnapshotUser3.toString() // only user 3 has cyweth
      );

      // check total sum
      assert.fieldEquals(
        "EligibleTotals",
        TOTALS_ID,
        "totalEligibleSumSnapshot",
        totalSnapshot.toString()
      );
    });

    test("should handle multiple accounts with different vault balances", () => {
      // Setup Account 1 with cysFLR
      createMockAccount(
        USER_1,
        BigInt.fromI32(2000),
        BigInt.zero(),
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );
      createMockVaultBalance(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(2000),
        BigInt.zero(),
      );
      createMockCycloVault(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(1),
        BigInt.fromI32(1),
        BigInt.fromI32(0),
        BigInt.fromI32(0),
      );

      // Setup Account 2 with cyWETH
      createMockAccount(
        USER_2,
        BigInt.fromI32(1000),
        BigInt.zero(),
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );
      createMockVaultBalance(
        CYWETH_ADDRESS,
        USER_2,
        BigInt.fromI32(1000),
        BigInt.zero(),
      );
      createMockCycloVault(
        CYWETH_ADDRESS,
        USER_2,
        BigInt.fromI32(1),
        BigInt.fromI32(1),
        BigInt.fromI32(0),
        BigInt.fromI32(0),
      );

      // Take snapshot
      takeSnapshot(mockeEvent);

      const expectedSnapshot1 = BigInt.fromI32(2000) // user 1 current balance
        .times(BigInt.fromI32(2)) // x2 because we take 2 snapshots since its from day 25 to 27
        .div(BigInt.fromI32(27)); // /27 as we are at day 27

      const expectedSnapshot2 = BigInt.fromI32(1000) // user 2 current balance
        .times(BigInt.fromI32(2)) // x2 because we take 2 snapshots since its from day 25 to 27
        .div(BigInt.fromI32(27)); // /27 as we are at day 27

      const sum = expectedSnapshot1.plus(expectedSnapshot2)

      // Check account shares
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "eligibleShareSnapshot",
        expectedSnapshot1.toBigDecimal().div(sum.toBigDecimal()).toString()
      );
      assert.fieldEquals(
        "Account",
        USER_2.toHexString(),
        "eligibleShareSnapshot",
        expectedSnapshot2.toBigDecimal().div(sum.toBigDecimal()).toString()
      );

      // Check accounts total snapshot
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        expectedSnapshot1.toString()
      );
      assert.fieldEquals(
        "Account",
        USER_2.toHexString(),
        "totalCyBalanceSnapshot",
        expectedSnapshot2.toString()
      );

      // Check vault balance snapshot for user 1 and 2
      assert.fieldEquals(
        "VaultBalance",
        CYSFLR_ADDRESS.concat(USER_1).toHexString(),
        "balanceAvgSnapshot",
        expectedSnapshot1.toString()
      );
      assert.fieldEquals(
        "VaultBalance",
        CYWETH_ADDRESS.concat(USER_2).toHexString(),
        "balanceAvgSnapshot",
        expectedSnapshot2.toString()
      );
      
      // Check vault total eligible
      assert.fieldEquals(
        "CycloVault",
        CYSFLR_ADDRESS.toHexString(),
        "totalEligibleSnapshot",
        expectedSnapshot1.toString()
      );
      assert.fieldEquals(
        "CycloVault",
        CYWETH_ADDRESS.toHexString(),
        "totalEligibleSnapshot",
        expectedSnapshot2.toString()
      );

      // check total sum
      assert.fieldEquals(
        "EligibleTotals",
        TOTALS_ID,
        "totalEligibleSumSnapshot",
        sum.toString()
      );
    });

    test("should handle negative vault balances by normalizing to zero", () => {
      // Setup account with negative vault balance
      createMockAccount(
        USER_1,
        BigInt.fromI32(-500),
        BigInt.zero(),
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );
      createMockVaultBalance(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(-500),
        BigInt.zero(),
      );
      createMockCycloVault(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(1),
        BigInt.fromI32(1),
        BigInt.fromI32(0),
        BigInt.fromI32(0),
      );

      // Take snapshot
      takeSnapshot(mockeEvent);

      // Check that negative balance is normalized to zero
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        "0"
      );
      
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "eligibleShareSnapshot",
        "0"
      );

      // Check vault total eligible
      assert.fieldEquals(
        "CycloVault",
        CYSFLR_ADDRESS.toHexString(),
        "totalEligibleSnapshot",
        "0"
      );

      // check total sum
      assert.fieldEquals(
        "EligibleTotals",
        TOTALS_ID,
        "totalEligibleSumSnapshot",
        "0"
      );
    });

    test("should handle V3 liquidity positions in range", () => {
      mockSlot0(V3_POOL, -2000); // Current tick

      createMockAccount(
        USER_1,
        BigInt.fromI32(1000),
        BigInt.zero(),
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );
      createMockVaultBalance(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(1000),
        BigInt.zero(),
      );
      createMockCycloVault(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(1),
        BigInt.fromI32(1),
        BigInt.fromI32(0),
        BigInt.fromI32(0),
      );

      // Setup V3 liquidity position (in range: -3000 <= -2000 <= -1000)
      let tokenId = BigInt.fromI32(123);
      let lp3Id = getLiquidityV3OwnerBalanceId(SparkdexV3LiquidityManager, USER_1, CYSFLR_ADDRESS, tokenId);
      let lp3 = new LiquidityV3OwnerBalance(lp3Id);
      lp3.lpAddress = changetype<Bytes>(SparkdexV3LiquidityManager);
      lp3.owner = changetype<Bytes>(USER_1);
      lp3.tokenAddress = changetype<Bytes>(CYSFLR_ADDRESS);
      lp3.tokenId = tokenId;
      lp3.liquidity = BigInt.fromI32(500);
      lp3.depositBalance = BigInt.fromI32(500);
      lp3.poolAddress = changetype<Bytes>(V3_POOL);
      lp3.lowerTick = -3000;
      lp3.upperTick = -1000;
      lp3.fee = 3000;
      lp3.save();

      // add lp v2 for user but it should be ineffective
      let lp2Id = getLiquidityV2OwnerBalanceId(SparkdexV2LiquidityManager, USER_1, CYSFLR_ADDRESS);
      let lp2 = new LiquidityV2OwnerBalance(lp2Id);
      lp2.lpAddress = changetype<Bytes>(SparkdexV2LiquidityManager);
      lp2.owner = changetype<Bytes>(USER_1);
      lp2.tokenAddress = changetype<Bytes>(CYSFLR_ADDRESS);
      lp2.liquidity = BigInt.fromI32(500);
      lp2.depositBalance = BigInt.fromI32(500);
      lp2.save();

      // Take snapshot
      takeSnapshot(mockeEvent);

      const expectedSnapshot = BigInt.fromI32(1000) // user 1 current balance
        .times(BigInt.fromI32(2)) // x2 because we take 2 snapshots since its from day 25 to 27
        .div(BigInt.fromI32(27)); // /27 as we are at day 27

      // V3 position is in range, so deposit balance should NOT be deducted
      // Snapshot balance should be: 1000 (vault) - 0 (no deduction) = 1000
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        expectedSnapshot.toString()
      );
    });

    test("should handle V3 liquidity positions out of range", () => {
      mockSlot0(V3_POOL, -500); // Current tick (out of range)

      // Setup account
      createMockAccount(
        USER_1,
        BigInt.fromI32(1000),
        BigInt.zero(),
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );
      createMockVaultBalance(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(1000),
        BigInt.zero(),
      );
      createMockCycloVault(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(1),
        BigInt.fromI32(1),
        BigInt.fromI32(0),
        BigInt.fromI32(0),
      );

      // Setup V3 liquidity position (out of range: -500 not in [-3000, -1000])
      let tokenId = BigInt.fromI32(123);
      let lp3Id = getLiquidityV3OwnerBalanceId(SparkdexV3LiquidityManager, USER_1, CYSFLR_ADDRESS, tokenId);
      let lp3 = new LiquidityV3OwnerBalance(lp3Id);
      lp3.lpAddress = changetype<Bytes>(SparkdexV3LiquidityManager);
      lp3.owner = changetype<Bytes>(USER_1);
      lp3.tokenAddress = changetype<Bytes>(CYSFLR_ADDRESS);
      lp3.tokenId = tokenId;
      lp3.liquidity = BigInt.fromI32(500);
      lp3.depositBalance = BigInt.fromI32(500);
      lp3.poolAddress = changetype<Bytes>(V3_POOL);
      lp3.lowerTick = -3000;
      lp3.upperTick = -1000;
      lp3.fee = 3000;
      lp3.save();

      // Take snapshot
      takeSnapshot(mockeEvent);

      const expectedSnapshot = BigInt.fromI32(1000).minus(BigInt.fromI32(500)) // user 1 current balance - minus out of range balance
        .times(BigInt.fromI32(2)) // x2 because we take 2 snapshots since its from day 25 to 27
        .div(BigInt.fromI32(27)); // /27 as we are at day 27

      // V3 position is out of range, so deposit balance should be deducted
      // Snapshot balance should be: 1000 (vault) - 500 (deposit) = 500
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        expectedSnapshot.toString()
      );
    });

    test("should handle account with zero total balance correctly", () => {
      // Setup account with multiple users, one with zero balance
      createMockAccount(
        USER_1,
        BigInt.fromI32(0),
        BigInt.zero(),
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );

      createMockAccount(
        USER_2,
        BigInt.fromI32(1000),
        BigInt.zero(),
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );
      createMockVaultBalance(
        CYSFLR_ADDRESS,
        USER_2,
        BigInt.fromI32(1000),
        BigInt.zero(),
      );

      createMockCycloVault(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(1),
        BigInt.fromI32(1),
        BigInt.fromI32(0),
        BigInt.fromI32(0),
      );

      takeSnapshot(mockeEvent);

      // Account with zero balance should have 0 share
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "eligibleShareSnapshot",
        "0"
      );

      // Account with positive balance should have 100% share
      assert.fieldEquals(
        "Account",
        USER_2.toHexString(),
        "eligibleShareSnapshot",
        "1"
      );
    });
  });
});

describe("Test Epochs class", () => {
  describe("Test getCurrentEpoch() method", () => {
    test("should return first epoch for timestamp before first epoch", () => {      
      // Timestamp before 2024-07-06T12:00:00Z (1720267200)
      const earlyTimestamp = BigInt.fromI32(1720267199); // 1 second before
      
      const epoch = EPOCHS.getEpochByTimestamp(earlyTimestamp);
      
      assert.stringEquals(epoch.date, "2024-07-06T12:00:00Z");
      assert.bigIntEquals(epoch.timestamp, BigInt.fromI32(1720267200));
      assert.i32Equals(epoch.length, 30);
    });

    test("should return first epoch for timestamp equal to first epoch", () => {      
      // Timestamp exactly at first epoch: 2024-07-06T12:00:00Z
      const firstEpochTimestamp = BigInt.fromI32(1720267200);
      
      const epoch = EPOCHS.getEpochByTimestamp(firstEpochTimestamp);
      
      assert.stringEquals(epoch.date, "2024-07-06T12:00:00Z");
      assert.bigIntEquals(epoch.timestamp, BigInt.fromI32(1720267200));
      assert.i32Equals(epoch.length, 30);
    });

    test("should return correct epoch for timestamp in middle of 2024", () => {      
      // Timestamp between 2024-09-04T12:00:00Z and 2024-10-04T12:00:00Z
      const septemberTimestamp = BigInt.fromI32(1725451200 + 86400); // 1 day after 2024-09-04
      
      const epoch = EPOCHS.getEpochByTimestamp(septemberTimestamp);
      
      assert.stringEquals(epoch.date, "2024-10-04T12:00:00Z");
      assert.bigIntEquals(epoch.timestamp, BigInt.fromI32(1728043200));
      assert.i32Equals(epoch.length, 30);
    });

    test("should return correct epoch for timestamp in 2025", () => {      
      // Timestamp between 2025-03-03T12:00:00Z and 2025-04-02T12:00:00Z
      const marchTimestamp = BigInt.fromI32(1741003200 + 604800); // 1 week after 2025-03-03
      
      const epoch = EPOCHS.getEpochByTimestamp(marchTimestamp);
      
      assert.stringEquals(epoch.date, "2025-04-02T12:00:00Z");
      assert.bigIntEquals(epoch.timestamp, BigInt.fromI32(1743595200));
      assert.i32Equals(epoch.length, 30);
    });

    test("should return correct epoch for timestamp in 2026", () => {      
      // Timestamp between 2026-02-26T12:00:00Z and 2026-03-28T12:00:00Z
      const februaryTimestamp = BigInt.fromI32(1772107200 + 1209600); // 2 weeks after 2026-02-26
      
      const epoch = EPOCHS.getEpochByTimestamp(februaryTimestamp);
      
      assert.stringEquals(epoch.date, "2026-03-28T12:00:00Z");
      assert.bigIntEquals(epoch.timestamp, BigInt.fromI32(1774699200));
      assert.i32Equals(epoch.length, 30);
    });

    test("should return last epoch for timestamp after last epoch", () => {      
      // Timestamp after 2026-05-27T12:00:00Z (1779883200)
      const futureTimestamp = BigInt.fromI32(1779883200 + 86400000); // way in the future
      
      const epoch = EPOCHS.getEpochByTimestamp(futureTimestamp);
      
      assert.stringEquals(epoch.date, "2026-05-27T12:00:00Z");
      assert.bigIntEquals(epoch.timestamp, BigInt.fromI32(1779883200));
      assert.i32Equals(epoch.length, 30);
    });

    test("should return last epoch for timestamp equal to last epoch", () => {      
      // Timestamp exactly at last epoch: 2026-05-27T12:00:00Z
      const lastEpochTimestamp = BigInt.fromI32(1779883200);
      
      const epoch = EPOCHS.getEpochByTimestamp(lastEpochTimestamp);
      
      assert.stringEquals(epoch.date, "2026-05-27T12:00:00Z");
      assert.bigIntEquals(epoch.timestamp, BigInt.fromI32(1779883200));
      assert.i32Equals(epoch.length, 30);
    });

    test("should handle edge case between consecutive epochs", () => {      
      // Test timestamp exactly at the boundary between epochs
      // 2024-08-05T12:00:00Z (second epoch start)
      const boundaryTimestamp = BigInt.fromI32(1722859200);
      
      const epoch = EPOCHS.getEpochByTimestamp(boundaryTimestamp);
      
      assert.stringEquals(epoch.date, "2024-08-05T12:00:00Z");
      assert.bigIntEquals(epoch.timestamp, BigInt.fromI32(1722859200));
      assert.i32Equals(epoch.length, 30);
    });

    test("should handle timestamp just before epoch boundary", () => {      
      // Timestamp 1 second before 2024-08-05T12:00:00Z
      const beforeBoundaryTimestamp = BigInt.fromI32(1722859199);
      
      const epoch = EPOCHS.getEpochByTimestamp(beforeBoundaryTimestamp);
      
      // Should return the previous epoch (2024-07-06T12:00:00Z)
      assert.stringEquals(epoch.date, "2024-08-05T12:00:00Z");
      assert.bigIntEquals(epoch.timestamp, BigInt.fromI32(1722859200));
      assert.i32Equals(epoch.length, 30);
    });

    test("should return correct epoch for current date (December 2024)", () => {      
      // Approximate current timestamp (December 2024)
      const currentTimestamp = BigInt.fromI32(1733227200 + 86400 * 5); // 5 days after 2024-12-03
      
      const epoch = EPOCHS.getEpochByTimestamp(currentTimestamp);
      
      assert.stringEquals(epoch.date, "2025-01-02T12:00:00Z");
      assert.bigIntEquals(epoch.timestamp, BigInt.fromI32(1735819200));
      assert.i32Equals(epoch.length, 30);
    });

    test("should verify epoch list ordering", () => {      
      // Test that epochs are in chronological order by testing multiple consecutive epochs
      const timestamps = [
        BigInt.fromI32(1720267200 + 86400), // After first epoch
        BigInt.fromI32(1722859200 + 86400), // After second epoch  
        BigInt.fromI32(1725451200 + 86400), // After third epoch
        BigInt.fromI32(1728043200 + 86400), // After fourth epoch
      ];
      
      const expectedDates = [
        "2024-08-05T12:00:00Z",
        "2024-09-04T12:00:00Z", 
        "2024-10-04T12:00:00Z",
        "2024-11-03T12:00:00Z"
      ];
      
      for (let i = 0; i < timestamps.length; i++) {
        const epoch = EPOCHS.getEpochByTimestamp(timestamps[i]);
        assert.stringEquals(epoch.date, expectedDates[i]);
        assert.i32Equals(epoch.length, 30); // All epochs have 30-day length
      }
    });
  });
});

function createMockAccount(
  address: Address,
  totalCyBalance: BigInt,
  totalCyBalanceSnapshot: BigInt,
  eligibleShare: BigDecimal,
  eligibleShareSnapshot: BigDecimal,
): Account {
  let account = new Account(changetype<Bytes>(address));
  account.address = changetype<Bytes>(address);
  account.totalCyBalance = totalCyBalance;
  account.totalCyBalanceSnapshot = totalCyBalanceSnapshot;
  account.eligibleShare = eligibleShare;
  account.eligibleShareSnapshot = eligibleShareSnapshot;
  account.accountsMetadata = ACCOUNTS_METADATA_ID;
  account.save();

  return account;
}

function createMockVaultBalance(
  tokenAddress: Address,
  owner: Address,
  balance: BigInt,
  balanceAvgSnapshot: BigInt,
): VaultBalance {
  let vaultBalance = new VaultBalance(tokenAddress.concat(owner));
  vaultBalance.vault = changetype<Bytes>(tokenAddress);
  vaultBalance.owner = changetype<Bytes>(owner);
  vaultBalance.balance = balance;
  vaultBalance.balanceAvgSnapshot = balanceAvgSnapshot;
  vaultBalance.save();

  return vaultBalance;
}

function createMockCycloVault(
  tokenAddress: Address,
  deployer: Address,
  deployBlock: BigInt,
  deployTimestamp: BigInt,
  totalEligible: BigInt,
  totalEligibleSnapshot: BigInt,
): CycloVault {
  let cycloVault = new CycloVault(changetype<Bytes>(tokenAddress));
  cycloVault.address = changetype<Bytes>(tokenAddress);
  cycloVault.deployBlock = deployBlock;
  cycloVault.deployTimestamp = deployTimestamp;
  cycloVault.deployer = deployer;
  cycloVault.totalEligible = totalEligible;
  cycloVault.totalEligibleSnapshot = totalEligibleSnapshot;
  cycloVault.save();

  return cycloVault;
}
