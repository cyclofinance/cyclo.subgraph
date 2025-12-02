import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
} from "matchstick-as/assembly/index";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/schema";
import { handleTransfer } from "../src/cys-flr";
import { dataSourceMock } from "matchstick-as";
import { createTransferEvent, mockLog } from "./utils";

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

describe("Transfer handling", () => {
  beforeAll(() => {
    clearStore();
    // Mock dataSource.network() to return "flare" for tests
    dataSourceMock.setNetwork("flare");
  });

  afterAll(() => {
    clearStore();
  });

  test("Initializes totals at zero", () => {
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleCysFLR", "0");
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleCyWETH", "0");
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "0");
  });

  test("Updates totals with approved transfers", () => {
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
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleCyWETH", "0");
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "100");

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
      "totalEligibleCysFLR",
      "100"
    );
    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCyWETH",
      "150"
    );
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "250");
  });

  test("Excludes negative balances from totals", () => {
    // User 1 transfers all cysFLR to User 2 (making User 2's balance negative)
    let transferEvent = createTransferEvent(
      USER_1,
      USER_2,
      BigInt.fromI32(100),
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    // User 1's balance is now 0, User 2's cysFLR balance is -100
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

  test("Initializes account with zero balances and share", () => {
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
    assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "0");
  });

  test("Calculates total balance and share for single account", () => {
    clearStore();

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
    assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "1"); // Should be 100%

    // User gets 50 cyWETH
    transferEvent = createTransferEvent(
      APPROVED_DEX_POOL,
      USER_1,
      BigInt.fromI32(50),
      CYWETH_ADDRESS,
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

    // User 1 gets 300 cysFLR
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(300),
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    // User 2 gets 100 cyWETH
    transferEvent = createTransferEvent(
      APPROVED_DEX_POOL,
      USER_2,
      BigInt.fromI32(100),
      CYWETH_ADDRESS
    );
    handleTransfer(transferEvent);

    // Total eligible = 400, User 1 has 300/400 = 0.75, User 2 has 100/400 = 0.25
    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "eligibleShare",
      "0.75"
    );
    assert.fieldEquals(
      "Account",
      USER_2.toHexString(),
      "eligibleShare",
      "0.25"
    );
  });

  test("Handles negative balances in share calculation", () => {
    clearStore();

    // User 1 gets 100 cysFLR from DEX
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(100),
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    // User 1 transfers 150 to User 2 (making User 2's balance negative)
    transferEvent = createTransferEvent(
      USER_1,
      USER_2,
      BigInt.fromI32(150),
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "totalCyBalance",
      "-50"
    );
    assert.fieldEquals("Account", USER_1.toHexString(), "eligibleShare", "0"); // No share with negative balance
    assert.fieldEquals(
      "Account",
      USER_2.toHexString(),
      "totalCyBalance",
      "-150"
    );
    assert.fieldEquals("Account", USER_2.toHexString(), "eligibleShare", "0"); // No share with negative balance
  });

  test("Handles complex share calculations", () => {
    clearStore();

    // 1. User 1 gets tokens from DEX
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
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    // Total is now 2000, User 1 has 1500/2000 = 0.75, User 2 has 500/2000 = 0.25
    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "eligibleShare",
      "0.75"
    );
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

    // User 1 gets 1M cysFLR
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      largeValue,
      CYSFLR_ADDRESS
    );
    handleTransfer(transferEvent);

    // User 2 gets 500K cyWETH
    transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_2,
      halfValue,
      CYWETH_ADDRESS
    );
    handleTransfer(transferEvent);

    // User 1 should have 0.666... share (1M/1.5M)
    assert.fieldEquals(
      "Account",
      USER_1.toHexString(),
      "eligibleShare",
      "0.666666666666666666"
    );
    // User 2 should have 0.333... share (500K/1.5M)
    assert.fieldEquals(
      "Account",
      USER_2.toHexString(),
      "eligibleShare",
      "0.333333333333333333"
    );
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

    test("Updates totals with liquidity add", () => {
    // User 1 sends 100 cysFLR to DEX
    let transferEvent = createTransferEvent(
      USER_1,
      APPROVED_DEX_ROUTER,
      BigInt.fromI32(100),
      CYSFLR_ADDRESS,
      mockLog(
        APPROVED_DEX_POOL,
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        [USER_1.toHexString(), APPROVED_DEX_POOL.toHexString()],
        BigInt.fromI32(100)
      ),
    );
    handleTransfer(transferEvent);

    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCysFLR",
      "100"
    );
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleCyWETH", "0");
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "100");
  });

  test("Updates totals with liquidity withdraw", () => {
    // User 1 gets 100 cysFLR from DEX
    let transferEvent = createTransferEvent(
      APPROVED_DEX_ROUTER,
      USER_1,
      BigInt.fromI32(100),
      CYSFLR_ADDRESS,
      mockLog(
        APPROVED_DEX_POOL,
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        [APPROVED_DEX_POOL.toHexString(), USER_1.toHexString()],
        BigInt.fromI32(100)
      ),
    );
    handleTransfer(transferEvent);

    assert.fieldEquals(
      "EligibleTotals",
      TOTALS_ID,
      "totalEligibleCysFLR",
      "0"
    );
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleCyWETH", "0");
    assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "0");
  });
});
