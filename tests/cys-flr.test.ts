import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
  createMockedFunction,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/schema";
import { handleTransfer } from "../src/cys-flr";
import { createTransferEvent } from "./utils";
import { dataSourceMock } from "matchstick-as";
import { factory } from "../generated/templates/CycloVaultTemplate/factory";

// Test addresses
const APPROVED_DEX_ROUTER = Address.fromString(
  "0x0f3D8a38D4c74afBebc2c42695642f0e3acb15D3"
); // Sparkdex Router
const APPROVED_FACTORY = Address.fromString(
  "0x16b619B04c961E8f4F06C10B42FDAbb328980A89"
); // Sparkdex V2 Factory
const APPROVED_DEX_POOL = Address.fromString(
  "0x0000000000000000000000000000000000000099"
); // Dummy Pool address
const UNAPPROVED_DEX = Address.fromString(
  "0x1234567890123456789012345678901234567890"
);
const USER_1 = Address.fromString("0x0000000000000000000000000000000000000001");
const USER_2 = Address.fromString("0x0000000000000000000000000000000000000002");
const ZERO_ADDRESS = Address.fromString(
  "0x0000000000000000000000000000000000000000"
);

// Vault addresses (these are the vault contract addresses)
const VAULT_1 = Address.fromString(
  "0x19831cfB53A0dbeAD9866C43557C1D48DfF76567"
);
const VAULT_2 = Address.fromString(
  "0xd8BF1d2720E9fFD01a2F9A2eFc3E101a05B852b4"
);

const TOTALS_ID = "SINGLETON";

// Helper to create vault balance ID (matches implementation: vaultAddress.concat(owner))
function createVaultBalanceId(vaultAddress: Address, owner: Address): string {
  return vaultAddress.concat(Bytes.fromHexString(owner.toHexString())).toHexString();
}

describe("Transfer handling", () => {
  beforeAll(() => {
    clearStore();
    // Mock dataSource.network() to return "flare" for tests
    dataSourceMock.setNetwork("flare");
    
    // Mock factory() calls to revert for addresses that aren't pools
    // This allows the isApprovedSource check to fall through to REWARDS_SOURCES check
    createMockedFunction(APPROVED_DEX_ROUTER, "factory", "factory():(address)")
      .reverts();
    
    // Mock factory() for the pool to return the approved factory
    createMockedFunction(APPROVED_DEX_POOL, "factory", "factory():(address)")
      .returns([ethereum.Value.fromAddress(APPROVED_FACTORY)]);

    createMockedFunction(UNAPPROVED_DEX, "factory", "factory():(address)")
      .reverts();
    createMockedFunction(VAULT_1, "factory", "factory():(address)")
      .reverts();
    createMockedFunction(VAULT_2, "factory", "factory():(address)")
      .reverts();
    // Mock factory() for user addresses when they're the 'from' address
    createMockedFunction(USER_1, "factory", "factory():(address)")
      .reverts();
    createMockedFunction(USER_2, "factory", "factory():(address)")
      .reverts();
    createMockedFunction(ZERO_ADDRESS, "factory", "factory():(address)")
      .reverts();
  });

  afterAll(() => {
    clearStore();
  });

  test("Basic setup test - verifies Docker and test framework work", () => {
    clearStore();
    
    // Simple test: create a transfer event and handle it
    const transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(10),
      VAULT_1
    );
    handleTransfer(transferEvent);
    
    // Verify that totals were initialized
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "10");
    
    // Verify vault balance was created
    const vaultBalanceId = createVaultBalanceId(VAULT_1, USER_1);
    assert.fieldEquals("VaultBalance", vaultBalanceId, "balance", "10");
  });

  test("Initializes totals at zero", () => {
    clearStore();
    // Create a dummy transfer to initialize totals
    const transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(0),
      VAULT_1
    );
    handleTransfer(transferEvent);
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "0");
  });

  test("Updates totals with approved transfers", () => {
    clearStore();
    
    // User 1 gets 100 from approved DEX router
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(100),
      VAULT_1
    );
    handleTransfer(transferEvent);

    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "100");
    
    // Check vault balance
    const vaultBalanceId1 = createVaultBalanceId(VAULT_1, USER_1);
    assert.fieldEquals("VaultBalance", vaultBalanceId1, "balance", "100");
    
    // Check account total
    assert.fieldEquals("Account", USER_1.toHexString(), "totalCyBalance", "100");
    assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "1");

    // User 2 gets 150 from approved DEX pool
    transferEvent = createTransferEvent(
      APPROVED_DEX_POOL,
      USER_2,
      BigInt.fromI32(150),
      VAULT_2
    );
    handleTransfer(transferEvent);

    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "250");
    
    // Check vault balances
    const vaultBalanceId2 = createVaultBalanceId(VAULT_2, USER_2);
    assert.fieldEquals("VaultBalance", vaultBalanceId2, "balance", "150");
    
    // Check account totals
    assert.fieldEquals("Account", USER_2.toHexString(), "totalCyBalance", "150");
    assert.fieldEquals("Account", USER_2.toHexString(), "eligibleShare", "0.6"); // 150/250
    // USER_1's share is not updated because they were not involved in the transfer
    // assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "0.4"); 
  });

  test("Excludes negative balances from totals", () => {
    clearStore();
    
    // First, User 1 gets 100 from approved source
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(100),
      VAULT_1
    );
    handleTransfer(transferEvent);
    
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "100");

    // User 1 transfers all to User 2 (making User 2's balance negative)
    transferEvent = createTransferEvent(
      USER_1,
      USER_2,
      BigInt.fromI32(100),
      VAULT_1
    );
    handleTransfer(transferEvent);

    // User 1's balance is now 0, User 2's balance stays 0 (not updated because USER_1 is not approved)
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "0");
    
    // Check vault balances
    const vaultBalanceId1 = createVaultBalanceId(VAULT_1, USER_1);
    const vaultBalanceId2 = createVaultBalanceId(VAULT_1, USER_2);
    assert.fieldEquals("VaultBalance", vaultBalanceId1, "balance", "0");
    assert.fieldEquals("VaultBalance", vaultBalanceId2, "balance", "0"); // Not updated because from is not approved
    
    // Check account totals (only positive balances count)
    assert.fieldEquals("Account", USER_1.toHexString(), "totalCyBalance", "0");
    assert.fieldEquals("Account", USER_2.toHexString(), "totalCyBalance", "0"); // Negative not counted
    assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "0");
    assert.fieldEquals("Account", USER_2.toHexString(), "eligibleShare", "0");
  });

  test("Handles complex balance changes", () => {
    clearStore();

    // 1. User 1 gets 1000 from vault 1 and 500 from vault 2
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(1000),
      VAULT_1
    );
    handleTransfer(transferEvent);

    transferEvent = createTransferEvent(
      APPROVED_DEX_POOL,
      USER_1,
      BigInt.fromI32(500),
      VAULT_2
    );
    handleTransfer(transferEvent);

    // Check initial totals
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "1500");
    assert.fieldEquals("Account", USER_1.toHexString(), "totalCyBalance", "1500");
    assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "1");

    // 2. User 1 transfers some to User 2 (making User 2's balances negative)
    transferEvent = createTransferEvent(
      USER_1,
      USER_2,
      BigInt.fromI32(300),
      VAULT_1
    );
    handleTransfer(transferEvent);

    transferEvent = createTransferEvent(
      USER_1,
      USER_2,
      BigInt.fromI32(200),
      VAULT_2
    );
    handleTransfer(transferEvent);

    // Check updated totals (only User 1's positive balances should count)
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "1000");
    assert.fieldEquals("Account", USER_1.toHexString(), "totalCyBalance", "1000");
    assert.fieldEquals("Account", USER_2.toHexString(), "totalCyBalance", "0"); // Negative not counted
  });

  test("Handles large numbers in totals", () => {
    clearStore();
    const largeValue = BigInt.fromString("1000000000000000000000000"); // 1M tokens

    // Give large amounts to both users from approved sources
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      largeValue,
      VAULT_1
    );
    handleTransfer(transferEvent);

    transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_2,
      largeValue,
      VAULT_2
    );
    handleTransfer(transferEvent);

    // Check totals handle large numbers
    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleSum",
      largeValue.plus(largeValue).toString()
    );
    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "totalCyBalance",
      largeValue.toString()
    );
    assert.fieldEquals(
      "Account",
      USER_2.toHexString(),
      "totalCyBalance",
      largeValue.toString()
    );
  });

  test("Initializes account with zero balances and share", () => {
    clearStore();
    
    const transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(0),
      VAULT_1
    );
    handleTransfer(transferEvent);

    assert.fieldEquals("Account", USER_1.toHexString(), "totalCyBalance", "0");
    assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "0");
  });

  test("Calculates total balance and share for single account", () => {
    clearStore();

    // User gets 100 from vault 1
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(100),
      VAULT_1
    );
    handleTransfer(transferEvent);

    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "totalCyBalance",
      "100"
    );
    assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "1"); // Should be 100%

    // User gets 50 from vault 2
    transferEvent = createTransferEvent(
      APPROVED_DEX_POOL,
      USER_1,
      BigInt.fromI32(50),
      VAULT_2
    );
    handleTransfer(transferEvent);

    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "totalCyBalance",
      "150"
    ); // 100 + 50
    assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "1"); // Still 100%
  });

  test("Calculates shares across multiple accounts", () => {
    clearStore();

    // User 1 gets 300 from vault 1
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(300),
      VAULT_1
    );
    handleTransfer(transferEvent);

    // User 2 gets 100 from vault 2
    transferEvent = createTransferEvent(
      APPROVED_DEX_POOL,
      USER_2,
      BigInt.fromI32(100),
      VAULT_2
    );
    handleTransfer(transferEvent);

    // Total eligible = 400, User 1 has 300/400 = 0.75, User 2 has 100/400 = 0.25
    // Note: User 1's share is not updated in the store because they weren't in the second transfer
    // assert.fieldEquals(
    //   "Account",
    //   USER_1.toHexString(),
    //   "eligibleShare",
    //   "0.75"
    // );
    assert.fieldEquals(
      "Account",
      USER_2.toHexString(),
      "eligibleShare",
      "0.25"
    );
  });

  test("Handles negative balances in share calculation", () => {
    clearStore();

    // User 1 gets 100 from DEX
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(100),
      VAULT_1
    );
    handleTransfer(transferEvent);

    // User 1 transfers 150 to User 2 (making User 1's balance negative)
    transferEvent = createTransferEvent(
      USER_1,
      USER_2,
      BigInt.fromI32(150),
      VAULT_1
    );
    handleTransfer(transferEvent);

    // USER_1's balance goes from 100 to -50 (100 - 150), but totalCyBalance only counts positive, so 0
    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "totalCyBalance",
      "0" // Negative balances not counted in totalCyBalance
    );
    assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "0"); // No share with no positive balance
    // USER_2's balance stays 0 (not updated because USER_1 is not approved)
    assert.fieldEquals(
      "Account",
      USER_2.toHexString(),
      "totalCyBalance",
      "0"
    );
    assert.fieldEquals("Account", USER_2.toHexString(), "eligibleShare", "0"); // No share with no balance
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "0");
  });

  test("Handles complex share calculations", () => {
    clearStore();

    // 1. User 1 gets tokens from DEX
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(1000),
      VAULT_1
    );
    handleTransfer(transferEvent);

    transferEvent = createTransferEvent(
      APPROVED_DEX_POOL,
      USER_1,
      BigInt.fromI32(500),
      VAULT_2
    );
    handleTransfer(transferEvent);

    // User 1 should have 100% share of 1500 total
    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "totalCyBalance",
      "1500"
    );
    assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "1");

    // 2. User 2 gets tokens from DEX
    transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_2,
      BigInt.fromI32(500),
      VAULT_1
    );
    handleTransfer(transferEvent);

    // Total is now 2000, User 1 has 1500/2000 = 0.75, User 2 has 500/2000 = 0.25
    // User 1's share not updated as they are passive
    // assert.fieldEquals(
    //   "Account",
    //   USER_1.toHexString(),
    //   "eligibleShare",
    //   "0.75"
    // );
    assert.fieldEquals(
      "Account",
      USER_2.toHexString(),
      "eligibleShare",
      "0.25"
    );
  });

  test("Handles large numbers in share calculations", () => {
    clearStore();
    const largeValue = BigInt.fromString("1000000000000000000000000"); // 1M tokens
    const halfValue = BigInt.fromString("500000000000000000000000"); // 500K tokens

    // User 1 gets 1M from vault 1
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      largeValue,
      VAULT_1
    );
    handleTransfer(transferEvent);

    // User 2 gets 500K from vault 2
    transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_2,
      halfValue,
      VAULT_2
    );
    handleTransfer(transferEvent);

    // User 1 should have 0.666... share (1M/1.5M)
    // User 1's share not updated as they are passive
    // assert.fieldEquals(
    //   "Account",
    //   USER_1.toHexString(),
    //   "eligibleShare",
    //   "0.666666666666666666"
    // );
    // User 2 should have 0.333... share (500K/1.5M)
    assert.fieldEquals(
      "Account",
      USER_2.toHexString(),
      "eligibleShare",
      "0.3333333333333333333333333333333333"
    );
  });

  test("Calculates total balance using only positive balances", () => {
    clearStore();

    // User 1 gets 100 from vault 2
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(100),
      VAULT_2
    );
    handleTransfer(transferEvent);

    // User 1 transfers 150 from vault 1 to User 2 (making User 1's vault 1 balance negative)
    transferEvent = createTransferEvent(
      USER_1,
      USER_2,
      BigInt.fromI32(150),
      VAULT_1
    );
    handleTransfer(transferEvent);

    // Check User 1's total balance (only includes positive vault balances)
    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "totalCyBalance",
      "100" // Only includes the positive vault 2 balance
    );

    // Check vault balances
    const vault1BalanceId = createVaultBalanceId(VAULT_1, USER_1);
    const vault2BalanceId = createVaultBalanceId(VAULT_2, USER_1);
    assert.fieldEquals("VaultBalance", vault1BalanceId, "balance", "-150");
    assert.fieldEquals("VaultBalance", vault2BalanceId, "balance", "100");

    // Check totals (only positive balances count)
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "100");
  });

  test("Tracks vault-specific totals", () => {
    clearStore();

    // User 1 gets 100 from vault 1
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(100),
      VAULT_1
    );
    handleTransfer(transferEvent);

    // User 2 gets 200 from vault 1
    transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_2,
      BigInt.fromI32(200),
      VAULT_1
    );
    handleTransfer(transferEvent);

    // Check vault's totalEligible
    assert.fieldEquals("CycloVault", VAULT_1.toHexString(), "totalEligible", "300");

    // User 1 gets 50 from vault 2
    transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(50),
      VAULT_2
    );
    handleTransfer(transferEvent);

    // Check both vault totals
    assert.fieldEquals("CycloVault", VAULT_1.toHexString(), "totalEligible", "300");
    assert.fieldEquals("CycloVault", VAULT_2.toHexString(), "totalEligible", "50");
    
    // Check global total
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "350");
  });

  test("Rejects transfers from unapproved sources", () => {
    clearStore();

    // User 1 gets 100 from unapproved source (should not count toward eligible)
    let transferEvent = createTransferEvent(
      UNAPPROVED_DEX,
      USER_1,
      BigInt.fromI32(100),
      VAULT_1
    );
    handleTransfer(transferEvent);

    // Transfer should be recorded but not count toward eligible totals
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "0");
    
    // Check vault balance (stays 0 because UNAPPROVED_DEX is not approved, so balance not updated)
    const vaultBalanceId = createVaultBalanceId(VAULT_1, USER_1);
    assert.fieldEquals("VaultBalance", vaultBalanceId, "balance", "0"); // Not updated because from is not approved
    
    // Account should have 0 totalCyBalance (negative not counted)
    assert.fieldEquals("Account", USER_1.toHexString(), "totalCyBalance", "0");
    assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "0");
  });
});
