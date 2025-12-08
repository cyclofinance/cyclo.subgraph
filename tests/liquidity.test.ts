import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
} from "matchstick-as/assembly/index";
import { LiquidityV2OwnerBalance, LiquidityV3OwnerBalance, CycloVault } from "../generated/schema";
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
      vault.save();

      mockLiquidityV3Positions(CYSFLR_ADDRESS, BigInt.fromI32(1), CY_TOKEN_ADDR, Address.fromString("0x0000000000000000000000000000000000000002"));

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
      initialBalance.save();

      // Call the handler
      handleLiquidityV3Transfer(transferEvent);

      // Assert that balances are updated correctly
      // V3 transfer removes the entity for old owner
      assert.notInStore("LiquidityV3OwnerBalance", id.toHexString());
    });
  });
});
