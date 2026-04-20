import { takeSnapshot, EPOCHS } from "../src/snapshot";
import { createTransferEvent, mockSlot0, mockSlot0Revert } from "./utils";
import { dataSourceMock, newMockEvent } from "matchstick-as";
import { getAccountsMetadata, updateTimeState, DAY } from "../src/common";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
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
      // user 2
      // user 3
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
      );

      createMockAccount(
        USER_2,
        BigInt.fromI32(1000),
        BigInt.zero(),
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
      // Account with positive balance should have 100% share
    });

    test("should not deduct V3 position when slot0 reverts", () => {
      const REVERT_POOL = Address.fromString("0x0000000000000000000000000000000000aaaaaa");
      mockSlot0Revert(REVERT_POOL);

      createMockAccount(
        USER_1,
        BigInt.fromI32(1000),
        BigInt.zero(),
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

      // V3 position with a pool that reverts on slot0
      let tokenId = BigInt.fromI32(999);
      let lp3Id = getLiquidityV3OwnerBalanceId(SparkdexV3LiquidityManager, USER_1, CYSFLR_ADDRESS, tokenId);
      let lp3 = new LiquidityV3OwnerBalance(lp3Id);
      lp3.lpAddress = changetype<Bytes>(SparkdexV3LiquidityManager);
      lp3.owner = changetype<Bytes>(USER_1);
      lp3.tokenAddress = changetype<Bytes>(CYSFLR_ADDRESS);
      lp3.tokenId = tokenId;
      lp3.liquidity = BigInt.fromI32(500);
      lp3.depositBalance = BigInt.fromI32(500);
      lp3.poolAddress = changetype<Bytes>(REVERT_POOL);
      lp3.lowerTick = -3000;
      lp3.upperTick = -1000;
      lp3.fee = 3000;
      lp3.save();

      takeSnapshot(mockeEvent);

      // slot0 reverted → position not deducted → full balance used
      const expectedSnapshot = BigInt.fromI32(1000)
        .times(BigInt.fromI32(2))
        .div(BigInt.fromI32(27));

      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        expectedSnapshot.toString()
      );
    });

    test("should clamp to zero when V3 deductions exceed eligible balance", () => {
      mockSlot0(V3_POOL, 5000); // Out of range for [-3000, -1000]

      createMockAccount(
        USER_1,
        BigInt.fromI32(300),
        BigInt.zero(),
      );
      createMockVaultBalance(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(300),
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

      // V3 position with depositBalance (500) > eligible balance (300)
      let tokenId = BigInt.fromI32(777);
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

      takeSnapshot(mockeEvent);

      // 300 - 500 = -200, clamped to 0
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        "0"
      );
    });

    test("should deduct only out-of-range V3 position when mixed with in-range", () => {
      mockSlot0(V3_POOL, -2000); // Current tick: in range for pos1, out of range for pos2

      createMockAccount(
        USER_1,
        BigInt.fromI32(1000),
        BigInt.zero(),
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

      // Position 1: IN RANGE (-3000 <= -2000 <= -1000), deposit = 400
      let tokenId1 = BigInt.fromI32(101);
      let lp3Id1 = getLiquidityV3OwnerBalanceId(SparkdexV3LiquidityManager, USER_1, CYSFLR_ADDRESS, tokenId1);
      let lp3_1 = new LiquidityV3OwnerBalance(lp3Id1);
      lp3_1.lpAddress = changetype<Bytes>(SparkdexV3LiquidityManager);
      lp3_1.owner = changetype<Bytes>(USER_1);
      lp3_1.tokenAddress = changetype<Bytes>(CYSFLR_ADDRESS);
      lp3_1.tokenId = tokenId1;
      lp3_1.liquidity = BigInt.fromI32(400);
      lp3_1.depositBalance = BigInt.fromI32(400);
      lp3_1.poolAddress = changetype<Bytes>(V3_POOL);
      lp3_1.lowerTick = -3000;
      lp3_1.upperTick = -1000;
      lp3_1.fee = 3000;
      lp3_1.save();

      // Position 2: OUT OF RANGE (-1500 to -500, tick is -2000), deposit = 300
      let tokenId2 = BigInt.fromI32(102);
      let lp3Id2 = getLiquidityV3OwnerBalanceId(SparkdexV3LiquidityManager, USER_1, CYSFLR_ADDRESS, tokenId2);
      let lp3_2 = new LiquidityV3OwnerBalance(lp3Id2);
      lp3_2.lpAddress = changetype<Bytes>(SparkdexV3LiquidityManager);
      lp3_2.owner = changetype<Bytes>(USER_1);
      lp3_2.tokenAddress = changetype<Bytes>(CYSFLR_ADDRESS);
      lp3_2.tokenId = tokenId2;
      lp3_2.liquidity = BigInt.fromI32(300);
      lp3_2.depositBalance = BigInt.fromI32(300);
      lp3_2.poolAddress = changetype<Bytes>(V3_POOL);
      lp3_2.lowerTick = -1500;
      lp3_2.upperTick = -500;
      lp3_2.fee = 3000;
      lp3_2.save();

      takeSnapshot(mockeEvent);

      // Only pos2 deducted: 1000 - 300 = 700
      const expectedSnapshot = BigInt.fromI32(700)
        .times(BigInt.fromI32(2))
        .div(BigInt.fromI32(27));

      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        expectedSnapshot.toString()
      );
    });

    test("should use min(boughtCap, lpBalance) when they differ", () => {
      createMockAccount(
        USER_1,
        BigInt.fromI32(800),
        BigInt.zero(),
      );

      // boughtCap = 300, lpBalance = 800 → eligible = 300
      let vaultBalance = new VaultBalance(CYSFLR_ADDRESS.concat(USER_1));
      vaultBalance.vault = changetype<Bytes>(CYSFLR_ADDRESS);
      vaultBalance.owner = changetype<Bytes>(USER_1);
      vaultBalance.boughtCap = BigInt.fromI32(300);
      vaultBalance.lpBalance = BigInt.fromI32(800);
      vaultBalance.balance = BigInt.fromI32(300);
      vaultBalance.balanceAvgSnapshot = BigInt.zero();
      vaultBalance.save();

      createMockCycloVault(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(1),
        BigInt.fromI32(1),
        BigInt.fromI32(0),
        BigInt.fromI32(0),
      );

      takeSnapshot(mockeEvent);

      // Snapshot should use 300 (min of boughtCap, lpBalance), not 800
      const expectedSnapshot = BigInt.fromI32(300)
        .times(BigInt.fromI32(2))
        .div(BigInt.fromI32(27));

      assert.fieldEquals(
        "VaultBalance",
        CYSFLR_ADDRESS.concat(USER_1).toHexString(),
        "balanceAvgSnapshot",
        expectedSnapshot.toString()
      );
    });

    test("should skip V3 position with different token than vault", () => {
      mockSlot0(V3_POOL, 5000); // Out of range

      createMockAccount(
        USER_1,
        BigInt.fromI32(1000),
        BigInt.zero(),
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

      // V3 position for CYWETH, not CYSFLR — should be skipped for this vault
      let tokenId = BigInt.fromI32(555);
      let lp3Id = getLiquidityV3OwnerBalanceId(SparkdexV3LiquidityManager, USER_1, CYWETH_ADDRESS, tokenId);
      let lp3 = new LiquidityV3OwnerBalance(lp3Id);
      lp3.lpAddress = changetype<Bytes>(SparkdexV3LiquidityManager);
      lp3.owner = changetype<Bytes>(USER_1);
      lp3.tokenAddress = changetype<Bytes>(CYWETH_ADDRESS);
      lp3.tokenId = tokenId;
      lp3.liquidity = BigInt.fromI32(500);
      lp3.depositBalance = BigInt.fromI32(500);
      lp3.poolAddress = changetype<Bytes>(V3_POOL);
      lp3.lowerTick = -3000;
      lp3.upperTick = -1000;
      lp3.fee = 3000;
      lp3.save();

      takeSnapshot(mockeEvent);

      // Position is for wrong token — should not be deducted from CYSFLR vault
      const expectedSnapshot = BigInt.fromI32(1000)
        .times(BigInt.fromI32(2))
        .div(BigInt.fromI32(27));

      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        expectedSnapshot.toString()
      );
    });

    test("should use cached slot0 for multiple V3 positions on same pool", () => {
      mockSlot0(V3_POOL, -2000); // In range for both positions

      createMockAccount(
        USER_1,
        BigInt.fromI32(1000),
        BigInt.zero(),
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

      // Two V3 positions on the same pool, both in range
      let tokenId1 = BigInt.fromI32(201);
      let lp3Id1 = getLiquidityV3OwnerBalanceId(SparkdexV3LiquidityManager, USER_1, CYSFLR_ADDRESS, tokenId1);
      let lp3_1 = new LiquidityV3OwnerBalance(lp3Id1);
      lp3_1.lpAddress = changetype<Bytes>(SparkdexV3LiquidityManager);
      lp3_1.owner = changetype<Bytes>(USER_1);
      lp3_1.tokenAddress = changetype<Bytes>(CYSFLR_ADDRESS);
      lp3_1.tokenId = tokenId1;
      lp3_1.liquidity = BigInt.fromI32(300);
      lp3_1.depositBalance = BigInt.fromI32(300);
      lp3_1.poolAddress = changetype<Bytes>(V3_POOL);
      lp3_1.lowerTick = -3000;
      lp3_1.upperTick = -1000;
      lp3_1.fee = 3000;
      lp3_1.save();

      let tokenId2 = BigInt.fromI32(202);
      let lp3Id2 = getLiquidityV3OwnerBalanceId(SparkdexV3LiquidityManager, USER_1, CYSFLR_ADDRESS, tokenId2);
      let lp3_2 = new LiquidityV3OwnerBalance(lp3Id2);
      lp3_2.lpAddress = changetype<Bytes>(SparkdexV3LiquidityManager);
      lp3_2.owner = changetype<Bytes>(USER_1);
      lp3_2.tokenAddress = changetype<Bytes>(CYSFLR_ADDRESS);
      lp3_2.tokenId = tokenId2;
      lp3_2.liquidity = BigInt.fromI32(200);
      lp3_2.depositBalance = BigInt.fromI32(200);
      lp3_2.poolAddress = changetype<Bytes>(V3_POOL);
      lp3_2.lowerTick = -3000;
      lp3_2.upperTick = -1000;
      lp3_2.fee = 3000;
      lp3_2.save();

      takeSnapshot(mockeEvent);

      // Both in range, no deductions, slot0 cached after first call
      const expectedSnapshot = BigInt.fromI32(1000)
        .times(BigInt.fromI32(2))
        .div(BigInt.fromI32(27));

      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        expectedSnapshot.toString()
      );
    });
  });
});

describe("Snapshot edge cases", () => {
  beforeAll(() => {
    dataSourceMock.setNetwork("flare");
  });

  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  test("should not take snapshot for past epoch", () => {
    // Init time state at epoch 3 day 25
    updateTimeState(createTransferEvent(
      Address.zero(), Address.zero(), BigInt.zero(), Address.zero(),
      null, null, null,
      EPOCHS.list[3].timestamp.minus(DAY.times(BigInt.fromI32(5))),
    ));
    const timeState = TimeState.load(TIME_STATE_ID)!;
    timeState.lastSnapshotEpoch = 3;
    timeState.lastSnapshotDayOfEpoch = 25;
    timeState.save();

    // Fire event with timestamp in epoch 2 (earlier epoch)
    const pastEvent = createTransferEvent(
      Address.zero(), Address.zero(), BigInt.zero(), Address.zero(),
      null, null, null,
      EPOCHS.list[2].timestamp.minus(DAY.times(BigInt.fromI32(3))),
    );
    updateTimeState(pastEvent);

    getAccountsMetadata();
    createMockAccount(
      USER_1,
      BigInt.fromI32(1000),
      BigInt.zero(),
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

    // Use a mock event with past-epoch timestamp
    const mockPastEvent = newMockEvent();
    mockPastEvent.block.timestamp = EPOCHS.list[2].timestamp.minus(DAY.times(BigInt.fromI32(3)));
    takeSnapshot(mockPastEvent);

    // Snapshot should not have been taken — balanceAvgSnapshot stays 0
    assert.fieldEquals(
      "VaultBalance",
      CYSFLR_ADDRESS.concat(USER_1).toHexString(),
      "balanceAvgSnapshot",
      "0"
    );
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
): Account {
  let account = new Account(changetype<Bytes>(address));
  account.address = changetype<Bytes>(address);
  account.totalCyBalance = totalCyBalance;
  account.totalCyBalanceSnapshot = totalCyBalanceSnapshot;
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
  vaultBalance.boughtCap = balance;
  vaultBalance.lpBalance = balance;
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
