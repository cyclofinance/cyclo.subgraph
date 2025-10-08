import { Address, BigInt, Bytes, store } from "@graphprotocol/graph-ts";
import { handleReceiptTransferBatch, handleReceiptTransferSingle } from "../src/receipt";
import { createReceiptTransferBatchEvent, createReceiptTransferSingleEvent } from "./utils";
import { test, assert, describe, clearStore, beforeAll, afterAll } from "matchstick-as/assembly/index";

const FROM = Address.fromString("0x0000000000000000000000000000000000000001");
const TO = Address.fromString("0x0000000000000000000000000000000000000002");
const OPERATOR = Address.fromString("0x0000000000000000000000000000000000000003");
const RECEIPT_ADDRESS = Address.fromString("0xd387FC43E19a63036d8FCeD559E81f5dDeF7ef09");

function getId(hash: Bytes, logIndex: BigInt, index: i32): Bytes {
    return hash.concatI32(logIndex.toI32()).concatI32(index);
}

describe("ReceiptTransfer handling", () => {
  beforeAll(() => {
    clearStore();
  });

  afterAll(() => {
    clearStore();
  });

  describe("single", () => {
    test("should build and store ReceiptTransfer item from SingleTransfer event", () => {
      let transferEvent = createReceiptTransferSingleEvent(
        RECEIPT_ADDRESS,
        FROM,
        TO,
        OPERATOR,
        BigInt.fromI32(100),
        BigInt.fromI32(1)
      );
      handleReceiptTransferSingle(transferEvent);

      const id = getId(transferEvent.transaction.hash, transferEvent.logIndex, 0).toHexString();

      assert.entityCount("Account", 3); // from, to, operator
      assert.entityCount("ReceiptTransfer", 1);
      assert.fieldEquals("ReceiptTransfer", id, "from", FROM.toHexString());
      assert.fieldEquals("ReceiptTransfer", id, "to", TO.toHexString());
      assert.fieldEquals("ReceiptTransfer", id, "operator", OPERATOR.toHexString());
      assert.fieldEquals("ReceiptTransfer", id, "amount", "100");
      assert.fieldEquals("ReceiptTransfer", id, "tokenId", "1");
    });
  });

  describe("batch", () => {
    test("should build and store ReceiptTransfer item from BatchTransfer event", () => {
      let transferEvent = createReceiptTransferBatchEvent(
        RECEIPT_ADDRESS,
        FROM,
        TO,
        OPERATOR,
        [BigInt.fromI32(100), BigInt.fromI32(200)],
        [BigInt.fromI32(1), BigInt.fromI32(2)]
      );
      handleReceiptTransferBatch(transferEvent);

      const id0 = getId(transferEvent.transaction.hash, transferEvent.logIndex, 0).toHexString();
      const id1 = getId(transferEvent.transaction.hash, transferEvent.logIndex, 1).toHexString();

      assert.entityCount("Account", 3); // from, to, operator
      assert.entityCount("ReceiptTransfer", 2);
      assert.fieldEquals("ReceiptTransfer", id0, "from", FROM.toHexString());
      assert.fieldEquals("ReceiptTransfer", id0, "to", TO.toHexString());
      assert.fieldEquals("ReceiptTransfer", id0, "operator", OPERATOR.toHexString());
      assert.fieldEquals("ReceiptTransfer", id0, "amount", "100");
      assert.fieldEquals("ReceiptTransfer", id0, "tokenId", "1");

      assert.fieldEquals("ReceiptTransfer", id1, "from", FROM.toHexString());
      assert.fieldEquals("ReceiptTransfer", id1, "to", TO.toHexString());
      assert.fieldEquals("ReceiptTransfer", id1, "operator", OPERATOR.toHexString());
      assert.fieldEquals("ReceiptTransfer", id1, "amount", "200");
      assert.fieldEquals("ReceiptTransfer", id1, "tokenId", "2");
    });
  });
});