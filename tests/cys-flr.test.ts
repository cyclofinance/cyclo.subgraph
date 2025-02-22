import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
  createMockedFunction,
  beforeEach,
} from "matchstick-as/assembly/index";
import { Address, BigInt, log, ethereum } from "@graphprotocol/graph-ts";
import { EligibleTotals, Account } from "../generated/schema";
import { handleTransfer } from "../src/cys-flr";
import { createTransferEvent } from "./cys-flr-utils";

// Test addresses
const APPROVED_DEX_ROUTER = Address.fromString(
  "0x0f3D8a38D4c74afBebc2c42695642f0e3acb15D3"
); // Sparkdex Router
const APPROVED_DEX_POOL = Address.fromString(
  "0x16b619B04c961E8f4F06C10B42FDAbb328980A89"
); // Sparkdex V2 Pool
const UNAPPROVED_DEX = Address.fromString(
  "0x1234567890123456789012345678901234567890"
);
const USER_1 = Address.fromString("0x0000000000000000000000000000000000000001");
const USER_2 = Address.fromString("0x0000000000000000000000000000000000000002");
const ZERO_ADDRESS = Address.fromString(
  "0x0000000000000000000000000000000000000000"
);

// Token addresses
const CYSFLR_ADDRESS = Address.fromString(
  "0x19831cfB53A0dbeAD9866C43557C1D48DfF76567"
);
const CYWETH_ADDRESS = Address.fromString(
  "0xd8BF1d2720E9fFD01a2F9A2eFc3E101a05B852b4"
);

const TOTALS_ID = "SINGLETON";

// Add this helper function
function mockFactoryCall(address: Address, isApproved: boolean): void {
  createMockedFunction(address, "factory", "factory():(address)").returns([
    ethereum.Value.fromAddress(
      Address.fromString(
        isApproved
          ? APPROVED_DEX_POOL.toHexString()
          : ZERO_ADDRESS.toHexString()
      )
    ),
  ]);
}

describe("Transfer handling", () => {
  beforeEach(() => {
    clearStore();

    // Initialize totals
    const totals = new EligibleTotals(TOTALS_ID);
    totals.totalEligibleCysFLR = BigInt.fromI32(0);
    totals.totalEligibleCyWETH = BigInt.fromI32(0);
    totals.totalEligibleSum = BigInt.fromI32(0);
    totals.save();
  });

  test("Initializes totals at zero", () => {
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleCysFLR", "0");
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleCyWETH", "0");
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "0");
  });

  test("Updates totals with approved transfers", () => {
    // Mock DEX router as approved source
    mockFactoryCall(APPROVED_DEX_ROUTER, true);

    // User 1 gets 100 cysFLR from DEX
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(100),
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCysFLR",
      "100"
    );

    // Mock DEX pool as approved source
    mockFactoryCall(APPROVED_DEX_POOL, true);

    // User 2 gets 150 cyWETH from DEX
    transferEvent = createTransferEvent(
      APPROVED_DEX_POOL,
      USER_2,
      BigInt.fromI32(150),
      CYWETH_ADDRESS
    );
    handleTransfer(transferEvent);

    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCyWETH",
      "150"
    );
  });

  test("Excludes negative balances from totals", () => {
    // First, give User 2 some cyWETH from an approved source
    mockFactoryCall(APPROVED_DEX_POOL, true);
    let transferEvent = createTransferEvent(
      APPROVED_DEX_POOL,
      USER_2,
      BigInt.fromI32(150),
      CYWETH_ADDRESS
    );
    handleTransfer(transferEvent);

    const user2Initial = Account.load(USER_2);

    // Now do the negative balance test with cysFLR
    mockFactoryCall(USER_1, false);
    transferEvent = createTransferEvent(
      USER_1,
      USER_2,
      BigInt.fromI32(100),
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    // Log final state
    const user1 = Account.load(USER_1);
    const user2 = Account.load(USER_2);

    // Check totals - cysFLR should be 0 (all negative), cyWETH should be 150
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleCysFLR", "0");
    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCyWETH",
      "150"
    );
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "150");
  });

  test("Handles complex balance changes", () => {
    clearStore();

    // 1. User 1 gets 1000 cysFLR and 500 cyWETH from DEX
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(1000),
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    transferEvent = createTransferEvent(
      APPROVED_DEX_POOL,
      USER_1,
      BigInt.fromI32(500),
      CYWETH_ADDRESS
    );
    handleTransfer(transferEvent);

    // Check initial totals
    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCysFLR",
      "1000"
    );
    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCyWETH",
      "500"
    );
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "1500");

    // 2. User 1 transfers some to User 2 (making User 2's balances negative)
    transferEvent = createTransferEvent(
      USER_1,
      USER_2,
      BigInt.fromI32(300),
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    transferEvent = createTransferEvent(
      USER_1,
      USER_2,
      BigInt.fromI32(200),
      CYWETH_ADDRESS
    );
    handleTransfer(transferEvent);

    // Check updated totals (only User 1's positive balances should count)
    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCysFLR",
      "700"
    );
    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCyWETH",
      "300"
    );
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "1000");
  });

  test("Handles large numbers in totals", () => {
    clearStore();
    const largeValue = BigInt.fromString("1000000000000000000000000"); // 1M tokens

    // Give large amounts to both users from approved sources
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      largeValue,
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_2,
      largeValue,
      CYWETH_ADDRESS
    );
    handleTransfer(transferEvent);

    // Check totals handle large numbers
    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCysFLR",
      largeValue.toString()
    );
    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCyWETH",
      largeValue.toString()
    );
    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleSum",
      largeValue.plus(largeValue).toString()
    );
  });

  test("Initializes account with zero balances", () => {
    const transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(0),
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    assert.fieldEquals("Account", USER_1.toHexString(), "cysFLRBalance", "0");
    assert.fieldEquals("Account", USER_1.toHexString(), "cyWETHBalance", "0");
    assert.fieldEquals("Account", USER_1.toHexString(), "totalCyBalance", "0");
  });

  test("Calculates total balance for single account", () => {
    // Mock approved sources
    mockFactoryCall(APPROVED_DEX_ROUTER, true);

    // User gets 100 cysFLR
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(100),
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "totalCyBalance",
      "100"
    );

    // User gets 50 cyWETH
    transferEvent = createTransferEvent(
      APPROVED_DEX_POOL,
      USER_1,
      BigInt.fromI32(50),
      CYWETH_ADDRESS
    );
    handleTransfer(transferEvent);

    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "totalCyBalance",
      "150"
    ); // 100 + 50
  });

  test("Calculates total balance using only positive balances", () => {
    clearStore();

    // User 1 gets 100 cyWETH from DEX
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(100),
      CYWETH_ADDRESS
    );
    handleTransfer(transferEvent);

    // User 1 transfers 150 cysFLR to User 2 (making User 1's cysFLR balance negative)
    transferEvent = createTransferEvent(
      USER_1,
      USER_2,
      BigInt.fromI32(150),
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    // Check User 1's balances
    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "cysFLRBalance",
      "-150"
    );
    assert.fieldEquals("Account", USER_1.toHexString(), "cyWETHBalance", "100");
    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "totalCyBalance",
      "100" // Only includes the positive cyWETH balance
    );

    // Check totals
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleCysFLR", "0");
    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCyWETH",
      "100"
    );
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "100");
  });
});
