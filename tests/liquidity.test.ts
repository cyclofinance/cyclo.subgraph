import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
} from "matchstick-as/assembly/index";
import { LiquidityV2OwnerBalance, LiquidityV3OwnerBalance, CycloVault, VaultBalance, Account, EligibleTotals } from "../generated/schema";
import { ACCOUNTS_METADATA_ID, TOTALS_ID } from "../src/constants";
import { getOrCreateAccount } from "../src/common";
import { getOrCreateVaultBalance, getOrCreateTotals } from "../src/cys-flr";
import { dataSourceMock } from "matchstick-as";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { handleLiquidityV2Transfer, handleLiquidityV3Transfer, getLiquidityV2OwnerBalanceId, getLiquidityV3OwnerBalanceId } from "../src/liquidity";

import { createTransferEvent, createERC721TransferEvent, mockLog, mockLiquidityV3Positions, mockLiquidityV2Pairs } from "./utils";
const POOL = Address.fromString("0x16b619B04c961E8f4F06C10B42FDAbb328980A89"); // approved
const USER_1 = Address.fromString("0x0000000000000000000000000000000000000001");
const USER_2 = Address.fromString("0x0000000000000000000000000000000000000002");

// Token addresses
const CYSFLR_ADDRESS = Address.fromString(
  "0x19831cfB53A0dbeAD9866C43557C1D48DfF76567"
);
const CYWETH_ADDRESS = Address.fromString(
  "0xd8BF1d2720E9fFD01a2F9A2eFc3E101a05B852b4"
);

describe("Liquidity Transfer Handling", () => {
  beforeAll(() => {
    clearStore();
    dataSourceMock.setNetwork("flare");
  });

  afterAll(() => {
    clearStore();
  });

  describe("handleLiquidityV2Transfer", () => {
    test("should handle V2 liquidity token transfers and update balances", () => {
      // Create CycloVault for CY_TOKEN_ADDR
      const CY_TOKEN_ADDR = Address.fromString("0x0000000000000000000000000000000000000003");
      const vault = new CycloVault(CY_TOKEN_ADDR);
      vault.address = CY_TOKEN_ADDR;
      vault.deployBlock = BigInt.fromI32(1);
      vault.deployTimestamp = BigInt.fromI32(1);
      vault.deployer = USER_1;
      vault.totalEligible = BigInt.fromI32(0);
      vault.totalEligibleSnapshot = BigInt.fromI32(0);
      vault.save();

      mockLiquidityV2Pairs(CYSFLR_ADDRESS, CY_TOKEN_ADDR, Address.fromString("0x0000000000000000000000000000000000000002"));

      // Create a V2 transfer event
      let transferEvent = createTransferEvent(
        USER_1,
        USER_2,
        BigInt.fromI32(100),
        CYSFLR_ADDRESS, // This is treated as the LP token address in the handler
        mockLog(
            POOL,
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            [USER_1.toHexString(), USER_2.toHexString()],
            BigInt.fromI32(100)
        ),
      );

      // Create initial LiquidityV2OwnerBalance
      // In the handler: const id = getLiquidityV2OwnerBalanceId(event.address, owner, cyToken);
      // event.address = CYSFLR_ADDRESS
      // cyToken = CY_TOKEN_ADDR
      const id = getLiquidityV2OwnerBalanceId(transferEvent.address, USER_1, CY_TOKEN_ADDR);
      const initialBalance = new LiquidityV2OwnerBalance(id);
      initialBalance.lpAddress = POOL;
      initialBalance.owner = USER_1;
      initialBalance.liquidity = BigInt.fromI32(1000); // Some mock liquidity
      initialBalance.depositBalance = BigInt.fromI32(100);
      initialBalance.tokenAddress = CY_TOKEN_ADDR;
      initialBalance.save();

      // Call the handler
      handleLiquidityV2Transfer(transferEvent);

      // Assert that balances are updated correctly
      assert.fieldEquals("LiquidityV2OwnerBalance", id.toHexString(), "liquidity", "900"); // 1000 - 100
      assert.fieldEquals("LiquidityV2OwnerBalance", id.toHexString(), "depositBalance", "90");
    });

    test("should update lpBalance, balance, and account totals on V2 LP transfer", () => {
      clearStore();
      const CY_TOKEN_ADDR = Address.fromString("0x0000000000000000000000000000000000000003");

      // Create vault
      const vault = new CycloVault(CY_TOKEN_ADDR);
      vault.address = CY_TOKEN_ADDR;
      vault.deployBlock = BigInt.fromI32(1);
      vault.deployTimestamp = BigInt.fromI32(1);
      vault.deployer = USER_1;
      vault.totalEligible = BigInt.fromI32(500);
      vault.totalEligibleSnapshot = BigInt.fromI32(0);
      vault.save();

      // Setup account and vault balance with existing boughtCap and lpBalance
      const account = getOrCreateAccount(USER_1);
      const vaultBalance = getOrCreateVaultBalance(CY_TOKEN_ADDR, account);
      vaultBalance.boughtCap = BigInt.fromI32(500);
      vaultBalance.lpBalance = BigInt.fromI32(500);
      vaultBalance.balance = BigInt.fromI32(500);
      vaultBalance.save();
      account.totalCyBalance = BigInt.fromI32(500);
      account.save();

      // Setup totals
      const totals = getOrCreateTotals();
      totals.totalEligibleSum = BigInt.fromI32(500);
      totals.save();

      mockLiquidityV2Pairs(CYSFLR_ADDRESS, CY_TOKEN_ADDR, Address.fromString("0x0000000000000000000000000000000000000002"));

      // Create LP owner balance (full liquidity = 1000, deposit = 500)
      const lpId = getLiquidityV2OwnerBalanceId(CYSFLR_ADDRESS, USER_1, CY_TOKEN_ADDR);
      const lpBalance = new LiquidityV2OwnerBalance(lpId);
      lpBalance.lpAddress = POOL;
      lpBalance.owner = USER_1;
      lpBalance.liquidity = BigInt.fromI32(1000);
      lpBalance.depositBalance = BigInt.fromI32(500);
      lpBalance.tokenAddress = CY_TOKEN_ADDR;
      lpBalance.save();

      // Transfer 500 LP tokens (half) → depositDeduction = 500 * 500/1000 = 250
      let transferEvent = createTransferEvent(
        USER_1, USER_2,
        BigInt.fromI32(500),
        CYSFLR_ADDRESS,
        mockLog(POOL,
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          [USER_1.toHexString(), USER_2.toHexString()],
          BigInt.fromI32(500)
        ),
      );
      handleLiquidityV2Transfer(transferEvent);

      // lpBalance should decrease by 250 (deposit deduction): 500 - 250 = 250
      const vbId = CY_TOKEN_ADDR.concat(USER_1).toHexString();
      assert.fieldEquals("VaultBalance", vbId, "lpBalance", "250");
      // boughtCap unchanged
      assert.fieldEquals("VaultBalance", vbId, "boughtCap", "500");
      // balance = min(clamp0(500), clamp0(250)) = 250
      assert.fieldEquals("VaultBalance", vbId, "balance", "250");
      // account totalCyBalance updated
      assert.fieldEquals("Account", USER_1.toHexString(), "totalCyBalance", "250");
      // totals updated
      assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "250");
    });

    test("should remove entity on full V2 withdrawal (burn to zero address)", () => {
      clearStore();
      const CY_TOKEN_ADDR = Address.fromString("0x0000000000000000000000000000000000000003");

      // Create vault
      const vault = new CycloVault(CY_TOKEN_ADDR);
      vault.address = CY_TOKEN_ADDR;
      vault.deployBlock = BigInt.fromI32(1);
      vault.deployTimestamp = BigInt.fromI32(1);
      vault.deployer = USER_1;
      vault.totalEligible = BigInt.fromI32(200);
      vault.totalEligibleSnapshot = BigInt.fromI32(0);
      vault.save();

      const account = getOrCreateAccount(USER_1);
      const vaultBalance = getOrCreateVaultBalance(CY_TOKEN_ADDR, account);
      vaultBalance.boughtCap = BigInt.fromI32(200);
      vaultBalance.lpBalance = BigInt.fromI32(200);
      vaultBalance.balance = BigInt.fromI32(200);
      vaultBalance.save();
      account.totalCyBalance = BigInt.fromI32(200);
      account.save();

      const totals = getOrCreateTotals();
      totals.totalEligibleSum = BigInt.fromI32(200);
      totals.save();

      mockLiquidityV2Pairs(CYSFLR_ADDRESS, CY_TOKEN_ADDR, Address.fromString("0x0000000000000000000000000000000000000002"));

      // Create LP balance with liquidity = 500, deposit = 200
      const lpId = getLiquidityV2OwnerBalanceId(CYSFLR_ADDRESS, USER_1, CY_TOKEN_ADDR);
      const lpBalance = new LiquidityV2OwnerBalance(lpId);
      lpBalance.lpAddress = POOL;
      lpBalance.owner = USER_1;
      lpBalance.liquidity = BigInt.fromI32(500);
      lpBalance.depositBalance = BigInt.fromI32(200);
      lpBalance.tokenAddress = CY_TOKEN_ADDR;
      lpBalance.save();

      // Burn ALL LP tokens to zero address
      let transferEvent = createTransferEvent(
        USER_1, Address.zero(),
        BigInt.fromI32(500),
        CYSFLR_ADDRESS,
        mockLog(POOL,
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          [USER_1.toHexString(), Address.zero().toHexString()],
          BigInt.fromI32(500)
        ),
      );
      handleLiquidityV2Transfer(transferEvent);

      // Entity should be removed
      assert.notInStore("LiquidityV2OwnerBalance", lpId.toHexString());

      // lpBalance zeroed, balance zeroed
      const vbId = CY_TOKEN_ADDR.concat(USER_1).toHexString();
      assert.fieldEquals("VaultBalance", vbId, "lpBalance", "0");
      assert.fieldEquals("VaultBalance", vbId, "balance", "0");
      assert.fieldEquals("Account", USER_1.toHexString(), "totalCyBalance", "0");
      assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "0");
    });

    test("should be a no-op when LiquidityV2OwnerBalance does not exist", () => {
      clearStore();
      const CY_TOKEN_ADDR = Address.fromString("0x0000000000000000000000000000000000000003");

      const vault = new CycloVault(CY_TOKEN_ADDR);
      vault.address = CY_TOKEN_ADDR;
      vault.deployBlock = BigInt.fromI32(1);
      vault.deployTimestamp = BigInt.fromI32(1);
      vault.deployer = USER_1;
      vault.totalEligible = BigInt.fromI32(0);
      vault.totalEligibleSnapshot = BigInt.fromI32(0);
      vault.save();

      mockLiquidityV2Pairs(CYSFLR_ADDRESS, CY_TOKEN_ADDR, Address.fromString("0x0000000000000000000000000000000000000002"));

      // No LiquidityV2OwnerBalance created — handler should early-return
      let transferEvent = createTransferEvent(
        USER_1, USER_2,
        BigInt.fromI32(100),
        CYSFLR_ADDRESS,
        mockLog(POOL,
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          [USER_1.toHexString(), USER_2.toHexString()],
          BigInt.fromI32(100)
        ),
      );
      handleLiquidityV2Transfer(transferEvent);

      // No VaultBalance should be created for the user
      assert.entityCount("VaultBalance", 0);
    });

    test("should handle non-trivial ratio rounding in V2 LP transfer", () => {
      clearStore();
      const CY_TOKEN_ADDR = Address.fromString("0x0000000000000000000000000000000000000003");

      const vault = new CycloVault(CY_TOKEN_ADDR);
      vault.address = CY_TOKEN_ADDR;
      vault.deployBlock = BigInt.fromI32(1);
      vault.deployTimestamp = BigInt.fromI32(1);
      vault.deployer = USER_1;
      vault.totalEligible = BigInt.fromI32(0);
      vault.totalEligibleSnapshot = BigInt.fromI32(0);
      vault.save();

      mockLiquidityV2Pairs(CYSFLR_ADDRESS, CY_TOKEN_ADDR, Address.fromString("0x0000000000000000000000000000000000000002"));

      // liquidity=3, deposit=10: transferring 1 LP token
      // ratio = 1 * 1e18 / 3 = 333333333333333333
      // deduction = 10 * 333333333333333333 / 1e18 = 3 (truncated)
      const lpId = getLiquidityV2OwnerBalanceId(CYSFLR_ADDRESS, USER_1, CY_TOKEN_ADDR);
      const lpBal = new LiquidityV2OwnerBalance(lpId);
      lpBal.lpAddress = POOL;
      lpBal.owner = USER_1;
      lpBal.liquidity = BigInt.fromI32(3);
      lpBal.depositBalance = BigInt.fromI32(10);
      lpBal.tokenAddress = CY_TOKEN_ADDR;
      lpBal.save();

      const account = getOrCreateAccount(USER_1);
      const vaultBalance = getOrCreateVaultBalance(CY_TOKEN_ADDR, account);
      vaultBalance.boughtCap = BigInt.fromI32(10);
      vaultBalance.lpBalance = BigInt.fromI32(10);
      vaultBalance.balance = BigInt.fromI32(10);
      vaultBalance.save();
      account.totalCyBalance = BigInt.fromI32(10);
      account.save();

      const totals = getOrCreateTotals();
      totals.totalEligibleSum = BigInt.fromI32(10);
      totals.save();

      let transferEvent = createTransferEvent(
        USER_1, USER_2,
        BigInt.fromI32(1),
        CYSFLR_ADDRESS,
        mockLog(POOL,
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          [USER_1.toHexString(), USER_2.toHexString()],
          BigInt.fromI32(1)
        ),
      );
      handleLiquidityV2Transfer(transferEvent);

      // depositBalance: 10 - 3 = 7, liquidity: 3 - 1 = 2
      assert.fieldEquals("LiquidityV2OwnerBalance", lpId.toHexString(), "depositBalance", "7");
      assert.fieldEquals("LiquidityV2OwnerBalance", lpId.toHexString(), "liquidity", "2");

      // lpBalance: 10 - 3 = 7, balance = min(10, 7) = 7
      const vbId = CY_TOKEN_ADDR.concat(USER_1).toHexString();
      assert.fieldEquals("VaultBalance", vbId, "lpBalance", "7");
      assert.fieldEquals("VaultBalance", vbId, "balance", "7");
    });
  });

  describe("handleLiquidityV3Transfer", () => {
    test("should handle V3 liquidity token transfers and update balances", () => {
      const CY_TOKEN_ADDR = Address.fromString("0x0000000000000000000000000000000000000003");
      
      // Ensure vault exists
      const vault = new CycloVault(CY_TOKEN_ADDR);
      vault.address = CY_TOKEN_ADDR;
      vault.deployBlock = BigInt.fromI32(1);
      vault.deployTimestamp = BigInt.fromI32(1);
      vault.deployer = USER_1;
      vault.totalEligible = BigInt.fromI32(0);
      vault.totalEligibleSnapshot = BigInt.fromI32(0);
      vault.save();

      mockLiquidityV3Positions(CYSFLR_ADDRESS, BigInt.fromI32(1), CY_TOKEN_ADDR, Address.fromString("0x0000000000000000000000000000000000000002"), 0, 0);

      // Create a V3 transfer event
      let transferEvent = createERC721TransferEvent(
        USER_1,
        USER_2,
        BigInt.fromI32(1), // Token ID
        CYSFLR_ADDRESS,
        mockLog(
            POOL,
            "0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f",
            [USER_1.toHexString(), USER_2.toHexString()],
            BigInt.fromI32(1)
        )
      );

      // Create initial LiquidityV3OwnerBalance
      // In handler: const id = getLiquidityV3OwnerBalanceId(event.address, owner, cyToken, tokenId);
      // event.address = CYSFLR_ADDRESS
      const id = getLiquidityV3OwnerBalanceId(transferEvent.address, USER_1, CY_TOKEN_ADDR, BigInt.fromI32(1));
      const initialBalance = new LiquidityV3OwnerBalance(id);
      initialBalance.lpAddress = POOL;
      initialBalance.owner = USER_1;
      initialBalance.liquidity = BigInt.fromI32(100);
      initialBalance.tokenId = BigInt.fromI32(1);
      initialBalance.depositBalance = BigInt.fromI32(100);
      initialBalance.tokenAddress = CY_TOKEN_ADDR;
      initialBalance.poolAddress = transferEvent.params.to;
      initialBalance.fee = 500;
      initialBalance.lowerTick = -34864;
      initialBalance.upperTick = -22593;
      initialBalance.save();

      // Call the handler
      handleLiquidityV3Transfer(transferEvent);

      // Assert that balances are updated correctly
      // V3 transfer removes the entity for old owner
      assert.notInStore("LiquidityV3OwnerBalance", id.toHexString());
    });

    test("should update lpBalance, balance, and account totals on V3 LP transfer", () => {
      clearStore();
      const CY_TOKEN_ADDR = Address.fromString("0x0000000000000000000000000000000000000003");

      // Create vault
      const vault = new CycloVault(CY_TOKEN_ADDR);
      vault.address = CY_TOKEN_ADDR;
      vault.deployBlock = BigInt.fromI32(1);
      vault.deployTimestamp = BigInt.fromI32(1);
      vault.deployer = USER_1;
      vault.totalEligible = BigInt.fromI32(300);
      vault.totalEligibleSnapshot = BigInt.fromI32(0);
      vault.save();

      // Setup account and vault balance
      const account = getOrCreateAccount(USER_1);
      const vaultBalance = getOrCreateVaultBalance(CY_TOKEN_ADDR, account);
      vaultBalance.boughtCap = BigInt.fromI32(300);
      vaultBalance.lpBalance = BigInt.fromI32(300);
      vaultBalance.balance = BigInt.fromI32(300);
      vaultBalance.save();
      account.totalCyBalance = BigInt.fromI32(300);
      account.save();

      const totals = getOrCreateTotals();
      totals.totalEligibleSum = BigInt.fromI32(300);
      totals.save();

      mockLiquidityV3Positions(CYSFLR_ADDRESS, BigInt.fromI32(1), CY_TOKEN_ADDR, Address.fromString("0x0000000000000000000000000000000000000002"), 0, 0);

      // Create V3 LP position (depositBalance = 300)
      const lpId = getLiquidityV3OwnerBalanceId(CYSFLR_ADDRESS, USER_1, CY_TOKEN_ADDR, BigInt.fromI32(1));
      const lpPos = new LiquidityV3OwnerBalance(lpId);
      lpPos.lpAddress = POOL;
      lpPos.owner = USER_1;
      lpPos.liquidity = BigInt.fromI32(100);
      lpPos.tokenId = BigInt.fromI32(1);
      lpPos.depositBalance = BigInt.fromI32(300);
      lpPos.tokenAddress = CY_TOKEN_ADDR;
      lpPos.poolAddress = changetype<Bytes>(USER_2);
      lpPos.fee = 500;
      lpPos.lowerTick = -34864;
      lpPos.upperTick = -22593;
      lpPos.save();

      // Transfer NFT (full position transferred)
      let transferEvent = createERC721TransferEvent(
        USER_1, USER_2,
        BigInt.fromI32(1),
        CYSFLR_ADDRESS,
        mockLog(POOL,
          "0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f",
          [USER_1.toHexString(), USER_2.toHexString()],
          BigInt.fromI32(1)
        )
      );
      handleLiquidityV3Transfer(transferEvent);

      // lpBalance reduced by full depositBalance: 300 - 300 = 0
      const vbId = CY_TOKEN_ADDR.concat(USER_1).toHexString();
      assert.fieldEquals("VaultBalance", vbId, "lpBalance", "0");
      // boughtCap unchanged
      assert.fieldEquals("VaultBalance", vbId, "boughtCap", "300");
      // balance = min(clamp0(300), clamp0(0)) = 0
      assert.fieldEquals("VaultBalance", vbId, "balance", "0");
      // account totalCyBalance updated
      assert.fieldEquals("Account", USER_1.toHexString(), "totalCyBalance", "0");
      // totals updated
      assert.fieldEquals("EligibleTotals", TOTALS_ID, "totalEligibleSum", "0");
    });
  });
});
