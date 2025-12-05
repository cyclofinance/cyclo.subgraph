import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { handleLiquidityV2Transfer, handleLiquidityV3Transfer } from "../src/liquidity";
import { createTransferEvent, createERC721TransferEvent, mockLog } from "./utils";

// Test addresses
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
      // Create a V2 transfer event
      let transferEvent = createTransferEvent(
        USER_1,
        USER_2,
        BigInt.fromI32(100),
        CYSFLR_ADDRESS,
        mockLog(
            POOL,
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            [USER_1.toHexString(), USER_2.toHexString()],
            BigInt.fromI32(100)
        ),
      );

      // Call the handler
      handleLiquidityV2Transfer(transferEvent);

      // Assert that balances are updated correctly
      const id = transferEvent.address.concat(USER_1).concat(CYSFLR_ADDRESS).toHexString();
      assert.fieldEquals("LiquidityV2OwnerBalance", id, "liquidity", "0");
      assert.fieldEquals("LiquidityV2OwnerBalance", id, "depositBalance", "100");
    });
  });

  describe("handleLiquidityV3Transfer", () => {
    test("should handle V3 liquidity token transfers and update balances", () => {
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

      // Call the handler
      handleLiquidityV3Transfer(transferEvent);

      // Assert that balances are updated correctly
      const id = transferEvent.address.concat(USER_1).concat(CYSFLR_ADDRESS).concat(Bytes.fromByteArray(Bytes.fromBigInt(BigInt.fromI32(1)))).toHexString();
      assert.fieldEquals("LiquidityV3OwnerBalance", id, "liquidity", "0");
      assert.fieldEquals("LiquidityV3OwnerBalance", id, "depositBalance", "0");
    });
  });
});
