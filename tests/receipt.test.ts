import { Address, BigInt } from "@graphprotocol/graph-ts";
import { createReceiptTransferBatchEvent, createReceiptTransferSingleEvent } from "./utils";
import { test, assert, describe, clearStore, beforeAll, afterAll } from "matchstick-as/assembly/index";
import { createReceiptOwnerBalanceId, handleReceiptTransferBatch, handleReceiptTransferSingle } from "../src/receipt";
import { dataSourceMock } from "matchstick-as";

const FROM = Address.fromString("0x0000000000000000000000000000000000000001");
const TO = Address.fromString("0x0000000000000000000000000000000000000002");
const OPERATOR = Address.fromString("0x0000000000000000000000000000000000000003");
const RECEIPT_ADDRESS = Address.fromString("0xd387FC43E19a63036d8FCeD559E81f5dDeF7ef09");

describe("ReceiptOwnerBalance handling", () => {
  beforeAll(() => {
    clearStore();
    // Mock dataSource.network() to return "flare" for tests
    dataSourceMock.setNetwork("flare");
  });

  afterAll(() => {
    clearStore();
  });

  describe("single", () => {
    test("should build, apply balance changes and store ReceiptOwnerBalance items from SingleTransfer event", () => {
      let transferEvent = createReceiptTransferSingleEvent(
        RECEIPT_ADDRESS,
        FROM,
        TO,
        OPERATOR,
        BigInt.fromI32(100),
        BigInt.fromI32(1)
      );
      handleReceiptTransferSingle(transferEvent);

      assert.entityCount("Account", 2); // from, to
      assert.entityCount("ReceiptOwnerBalance", 2);

      const fromId = createReceiptOwnerBalanceId(transferEvent.address, transferEvent.params.id, transferEvent.params.from).toHexString();
      const toId = createReceiptOwnerBalanceId(transferEvent.address, transferEvent.params.id, transferEvent.params.to).toHexString();

      assert.fieldEquals("ReceiptOwnerBalance", fromId, "receiptAddress", RECEIPT_ADDRESS.toHexString());
      assert.fieldEquals("ReceiptOwnerBalance", fromId, "owner", FROM.toHexString());
      assert.fieldEquals("ReceiptOwnerBalance", fromId, "balance", "-100");
      assert.fieldEquals("ReceiptOwnerBalance", fromId, "tokenId", "1");

      assert.fieldEquals("ReceiptOwnerBalance", toId, "receiptAddress", RECEIPT_ADDRESS.toHexString());
      assert.fieldEquals("ReceiptOwnerBalance", toId, "owner", TO.toHexString());
      assert.fieldEquals("ReceiptOwnerBalance", toId, "balance", "100");
      assert.fieldEquals("ReceiptOwnerBalance", toId, "tokenId", "1");
    });
  });

  describe("batch", () => {
    test("should build, apply balance changes and store ReceiptOwnerBalance items from BatchTransfer event", () => {
      let transferEvent = createReceiptTransferBatchEvent(
        RECEIPT_ADDRESS,
        FROM,
        TO,
        OPERATOR,
        [BigInt.fromI32(100), BigInt.fromI32(200)],
        [BigInt.fromI32(1), BigInt.fromI32(2)]
      );
      handleReceiptTransferBatch(transferEvent);

      assert.entityCount("Account", 2); // from, to
      assert.entityCount("ReceiptOwnerBalance", 4);

      const fromId0 = createReceiptOwnerBalanceId(transferEvent.address, transferEvent.params.ids[0], transferEvent.params.from).toHexString();
      const toId0 = createReceiptOwnerBalanceId(transferEvent.address, transferEvent.params.ids[0], transferEvent.params.to).toHexString();

      assert.fieldEquals("ReceiptOwnerBalance", fromId0, "receiptAddress", RECEIPT_ADDRESS.toHexString());
      assert.fieldEquals("ReceiptOwnerBalance", fromId0, "owner", FROM.toHexString());
      assert.fieldEquals("ReceiptOwnerBalance", fromId0, "balance", "-100");
      assert.fieldEquals("ReceiptOwnerBalance", fromId0, "tokenId", "1");

      assert.fieldEquals("ReceiptOwnerBalance", toId0, "receiptAddress", RECEIPT_ADDRESS.toHexString());
      assert.fieldEquals("ReceiptOwnerBalance", toId0, "owner", TO.toHexString());
      assert.fieldEquals("ReceiptOwnerBalance", toId0, "balance", "100");
      assert.fieldEquals("ReceiptOwnerBalance", toId0, "tokenId", "1");

      const fromId1 = createReceiptOwnerBalanceId(transferEvent.address, transferEvent.params.ids[1], transferEvent.params.from).toHexString();
      const toId1 = createReceiptOwnerBalanceId(transferEvent.address, transferEvent.params.ids[1], transferEvent.params.to).toHexString();

      assert.fieldEquals("ReceiptOwnerBalance", fromId1, "receiptAddress", RECEIPT_ADDRESS.toHexString());
      assert.fieldEquals("ReceiptOwnerBalance", fromId1, "owner", FROM.toHexString());
      assert.fieldEquals("ReceiptOwnerBalance", fromId1, "balance", "-200");
      assert.fieldEquals("ReceiptOwnerBalance", fromId1, "tokenId", "2");

      assert.fieldEquals("ReceiptOwnerBalance", toId1, "receiptAddress", RECEIPT_ADDRESS.toHexString());
      assert.fieldEquals("ReceiptOwnerBalance", toId1, "owner", TO.toHexString());
      assert.fieldEquals("ReceiptOwnerBalance", toId1, "balance", "200");
      assert.fieldEquals("ReceiptOwnerBalance", toId1, "tokenId", "2");
    });
  });
});