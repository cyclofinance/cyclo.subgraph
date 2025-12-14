import { dataSourceMock } from "matchstick-as";
import { createTransferEvent, mockSlot0 } from "./utils";
import { getLiquidityV3OwnerBalanceId } from "../src/liquidity";
import { takeSnapshot, maybeTakeSnapshot } from "../src/snapshot";
import { SparkdexV3LiquidityManager, TOTALS_ID } from "../src/constants";
import { getAccountsMetadata, updateTimeState, DAY } from "../src/common";
import { Address, BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Account, VaultBalance, LiquidityV3OwnerBalance, CycloVault } from "../generated/schema";
import { assert, describe, test, clearStore, beforeAll, beforeEach, afterEach } from "matchstick-as/assembly/index";

const SNAPSHOT_LENGTH = 30; // all snpahots have 30 length

// Test addresses
const USER_1 = Address.fromString("0x0000000000000000000000000000000000000001");
const USER_2 = Address.fromString("0x0000000000000000000000000000000000000002");

// Token addresses
const CYSFLR_ADDRESS = Address.fromString("0x19831cfB53A0dbeAD9866C43557C1D48DfF76567");
const CYWETH_ADDRESS = Address.fromString("0xd8BF1d2720E9fFD01a2F9A2eFc3E101a05B852b4");

// Pool address for V3 liquidity
const V3_POOL = Address.fromString("0x16b619B04c961E8f4F06C10B42FDAbb328980A89");

describe("Snapshot handling", () => {
  beforeAll(() => {
    dataSourceMock.setNetwork("flare");
  });

  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  describe("takeSnapshot()", () => {
    test("should handle empty accounts list", () => {
      // Initialize empty AccountsMetadata
      getAccountsMetadata();
      
      // Should not throw error with empty accounts
      takeSnapshot(1);
      
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
        [],
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

      // Add account to metadata
      getAccountsMetadata(USER_1.toHexString());

      // Take snapshot
      takeSnapshot(1);

      // Check vault balance snapshot was added
      assert.fieldEquals(
        "VaultBalance",
        CYSFLR_ADDRESS.concat(USER_1).toHexString(),
        "balanceAvgSnapshot",
        "1000"
      );

      // Check account total snapshot
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        "1000"
      );

      // Check vault total eligible
      assert.fieldEquals(
        "CycloVault",
        CYSFLR_ADDRESS.toHexString(),
        "totalEligibleSnapshot",
        "1000"
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
        "1000"
      );
    });

    test("should handle multiple snapshots with SNAPSHOT_LENGTH limit", () => {
      // Setup account and vault
      createMockAccount(
        USER_1,
        BigInt.fromI32(1000),
        BigInt.zero(),
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );
      // Pre-fill with SNAPSHOT_LENGTH snapshots
      let snapshots = new Array<BigInt>();
      for (let i = 0; i < SNAPSHOT_LENGTH; i++) {
        snapshots.push(BigInt.fromI32(500 + i));
      }
      createMockVaultBalance(
        CYSFLR_ADDRESS,
        USER_1,
        BigInt.fromI32(1000),
        snapshots,
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

      // add address to meta list
      getAccountsMetadata(USER_1.toHexString());

      // Take 2 snapshot (count = 2)
      takeSnapshot(2);

      // Check that old snapshots were removed and new ones added
      let updatedVault = VaultBalance.load(CYSFLR_ADDRESS.concat(USER_1))!;
      assert.i32Equals(updatedVault.balanceSnapshots.length, 2); // we took 2 snapshots
      
      // two entries should be the current balance (1000)
      assert.bigIntEquals(updatedVault.balanceSnapshots[0], BigInt.fromI32(1000));
      assert.bigIntEquals(updatedVault.balanceSnapshots[1], BigInt.fromI32(1000));

      // check avg snapshot
      const expectedAvgSnapshot = BigInt.fromI32(1000); // (1000 + 1000) / 2 
      assert.bigIntEquals(updatedVault.balanceAvgSnapshot, expectedAvgSnapshot);

      // Check vault balance snapshot was added
      assert.fieldEquals(
        "VaultBalance",
        CYSFLR_ADDRESS.concat(USER_1).toHexString(),
        "balanceAvgSnapshot",
        expectedAvgSnapshot.toString()
      );

      // Check account total snapshot
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        expectedAvgSnapshot.toString()
      );

      // Check vault total eligible
      assert.fieldEquals(
        "CycloVault",
        CYSFLR_ADDRESS.toHexString(),
        "totalEligibleSnapshot",
        expectedAvgSnapshot.toString()
      );

      // Check account eligible share
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
        expectedAvgSnapshot.toString()
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
        [],
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
        [],
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

      // Add accounts to metadata
      getAccountsMetadata(USER_1.toHexString());
      getAccountsMetadata(USER_2.toHexString());

      // Take snapshot
      takeSnapshot(1);

      // Check account shares
      // Total: 2000 + 1000 = 3000
      // Account 1: 2000/3000 = 0.666...
      // Account 2: 1000/3000 = 0.333...
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "eligibleShareSnapshot",
        "0.6666666666666666666666666666666667"
      );
      assert.fieldEquals(
        "Account",
        USER_2.toHexString(),
        "eligibleShareSnapshot",
        "0.3333333333333333333333333333333333"
      );

      // Check accounts total snapshot
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        "2000"
      );
      assert.fieldEquals(
        "Account",
        USER_2.toHexString(),
        "totalCyBalanceSnapshot",
        "1000"
      );

      // Check vault balance snapshot for user 1 and 2
      assert.fieldEquals(
        "VaultBalance",
        CYSFLR_ADDRESS.concat(USER_1).toHexString(),
        "balanceAvgSnapshot",
        "2000"
      );
      assert.fieldEquals(
        "VaultBalance",
        CYWETH_ADDRESS.concat(USER_2).toHexString(),
        "balanceAvgSnapshot",
        "1000"
      );
      
      // Check vault total eligible
      assert.fieldEquals(
        "CycloVault",
        CYSFLR_ADDRESS.toHexString(),
        "totalEligibleSnapshot",
        "2000"
      );
      assert.fieldEquals(
        "CycloVault",
        CYWETH_ADDRESS.toHexString(),
        "totalEligibleSnapshot",
        "1000"
      );

      // check total sum
      assert.fieldEquals(
        "EligibleTotals",
        TOTALS_ID,
        "totalEligibleSumSnapshot",
        "3000"
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
        [],
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

      // add account to meta list
      getAccountsMetadata(USER_1.toHexString());

      // Take snapshot
      takeSnapshot(1);

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
        [],
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

      // add user 1 to meta list
      getAccountsMetadata(USER_1.toHexString());

      // Take snapshot
      takeSnapshot(1);

      // V3 position is in range, so deposit balance should NOT be deducted
      // Snapshot balance should be: 1000 (vault) - 0 (no deduction) = 1000
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        "1000"
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
        [],
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

      // add user 1 to meta list
      getAccountsMetadata(USER_1.toHexString());

      // Take snapshot
      takeSnapshot(1);

      // V3 position is out of range, so deposit balance should be deducted
      // Snapshot balance should be: 1000 (vault) - 500 (deposit) = 500
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        "500"
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
        [],
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

      // add accounts to meta list
      getAccountsMetadata(USER_1.toHexString());
      getAccountsMetadata(USER_2.toHexString());

      takeSnapshot(1);

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

  describe("maybeTakeSnapshot()", () => {
    test("should take snapshot when day has elapsed", () => {
      // Initialize TimeState
      const originEventTimestamp = BigInt.fromI32(1000000);
      const nextDayFirstEventTimestamp = originEventTimestamp.plus(DAY).plus(BigInt.fromI32(3600)); // +1 day + 1 hour
      
      let mockEvent1 = createTransferEvent(
        USER_1,
        USER_2,
        BigInt.fromI32(100),
        CYSFLR_ADDRESS,
        null,
        null,
        null,
        originEventTimestamp,
      );
      updateTimeState(mockEvent1);

      let mockEvent2 = createTransferEvent(
        USER_1,
        USER_2,
        BigInt.fromI32(100),
        CYSFLR_ADDRESS,
        null,
        null,
        null,
        nextDayFirstEventTimestamp,
      );
      updateTimeState(mockEvent2);

      // Setup test account and vault
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
        [],
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

      // add user 1 to the meta list
      getAccountsMetadata(USER_1.toHexString());

      // Should trigger snapshot
      maybeTakeSnapshot();

      // Verify snapshot was taken
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        "1000"
      );
    });

    test("should not take snapshot when no day has elapsed", () => {
      // Initialize TimeState with same day
      const originEventTimestamp = BigInt.fromI32(1000000);
      const sameDayEventtimestamp = originEventTimestamp.plus(BigInt.fromI32(3600)); // +1 hour (same day)
      
      let mockEvent1 = createTransferEvent(
        USER_1,
        USER_2,
        BigInt.fromI32(100),
        CYSFLR_ADDRESS,
        null,
        null,
        null,
        originEventTimestamp,
      );
      updateTimeState(mockEvent1);

      let mockEvent2 = createTransferEvent(
        USER_1,
        USER_2,
        BigInt.fromI32(100),
        CYSFLR_ADDRESS,
        null,
        null,
        null,
        sameDayEventtimestamp,
      );
      updateTimeState(mockEvent2);

      // Setup test account
      createMockAccount(
        USER_1,
        BigInt.fromI32(1000),
        BigInt.fromI32(500), // Pre-existing snapshot value
        BigInt.zero().toBigDecimal(),
        BigInt.zero().toBigDecimal(),
      );
      
      // add user 1 to meta list
      getAccountsMetadata(USER_1.toHexString());

      // Should not trigger snapshot
      maybeTakeSnapshot();

      // Verify snapshot was not updated (should remain 500)
      assert.fieldEquals(
        "Account",
        USER_1.toHexString(),
        "totalCyBalanceSnapshot",
        "500"
      );
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
  account.save();

  return account;
}

function createMockVaultBalance(
  tokenAddress: Address,
  owner: Address,
  balance: BigInt,
  balanceSnapshots: BigInt[],
  balanceAvgSnapshot: BigInt,
): VaultBalance {
  let vaultBalance = new VaultBalance(tokenAddress.concat(owner));
  vaultBalance.vault = changetype<Bytes>(tokenAddress);
  vaultBalance.owner = changetype<Bytes>(owner);
  vaultBalance.balance = balance;
  vaultBalance.balanceSnapshots = balanceSnapshots;
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
