import { assert, describe, test, clearStore, beforeEach } from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { dataSourceMock } from "matchstick-as";
import { createReceiptOwnerBalanceId, getOrCreateReceiptOwnerBalance, handleBalanceChange } from "../src/receipt";
import { CycloReceipt } from "../generated/schema";

dataSourceMock.setNetwork("flare");

const RECEIPT_ADDRESS = Address.fromString("0xd387FC43E19a63036d8FCeD559E81f5dDeF7ef09");
const OWNER = Address.fromString("0x0000000000000000000000000000000000000001");
const TOKEN_ID = BigInt.fromI32(42);

describe("getOrCreateReceiptOwnerBalance", () => {
  beforeEach(() => {
    clearStore();

    // Create receipt entity (required for the receipt relation)
    const receipt = new CycloReceipt(RECEIPT_ADDRESS);
    receipt.address = RECEIPT_ADDRESS;
    receipt.deployBlock = BigInt.fromI32(1);
    receipt.deployTimestamp = BigInt.fromI32(1);
    receipt.deployer = OWNER;
    receipt.save();
  });

  test("creates new entity with zero balance", () => {
    const item = getOrCreateReceiptOwnerBalance(RECEIPT_ADDRESS, TOKEN_ID, changetype<Bytes>(OWNER));

    assert.bigIntEquals(item.balance, BigInt.zero());
    assert.bigIntEquals(item.tokenId, TOKEN_ID);
    assert.bytesEquals(item.receiptAddress, RECEIPT_ADDRESS);
    assert.bytesEquals(item.owner, changetype<Bytes>(OWNER));
  });

  test("returns existing entity on second call", () => {
    const item1 = getOrCreateReceiptOwnerBalance(RECEIPT_ADDRESS, TOKEN_ID, changetype<Bytes>(OWNER));
    item1.balance = BigInt.fromI32(999);
    item1.save();

    const item2 = getOrCreateReceiptOwnerBalance(RECEIPT_ADDRESS, TOKEN_ID, changetype<Bytes>(OWNER));
    assert.bigIntEquals(item2.balance, BigInt.fromI32(999));
  });

  test("different tokenIds produce different entities", () => {
    const item1 = getOrCreateReceiptOwnerBalance(RECEIPT_ADDRESS, BigInt.fromI32(1), changetype<Bytes>(OWNER));
    const item2 = getOrCreateReceiptOwnerBalance(RECEIPT_ADDRESS, BigInt.fromI32(2), changetype<Bytes>(OWNER));

    assert.assertTrue(!item1.id.equals(item2.id));
  });
});

describe("handleBalanceChange", () => {
  beforeEach(() => {
    clearStore();

    const receipt = new CycloReceipt(RECEIPT_ADDRESS);
    receipt.address = RECEIPT_ADDRESS;
    receipt.deployBlock = BigInt.fromI32(1);
    receipt.deployTimestamp = BigInt.fromI32(1);
    receipt.deployer = OWNER;
    receipt.save();
  });

  test("creates entity and applies positive change", () => {
    handleBalanceChange(RECEIPT_ADDRESS, TOKEN_ID, changetype<Bytes>(OWNER), BigInt.fromI32(100));

    const id = createReceiptOwnerBalanceId(RECEIPT_ADDRESS, TOKEN_ID, changetype<Bytes>(OWNER)).toHexString();
    assert.fieldEquals("ReceiptOwnerBalance", id, "balance", "100");
  });

  test("applies negative change", () => {
    handleBalanceChange(RECEIPT_ADDRESS, TOKEN_ID, changetype<Bytes>(OWNER), BigInt.fromI32(100));
    handleBalanceChange(RECEIPT_ADDRESS, TOKEN_ID, changetype<Bytes>(OWNER), BigInt.fromI32(-60));

    const id = createReceiptOwnerBalanceId(RECEIPT_ADDRESS, TOKEN_ID, changetype<Bytes>(OWNER)).toHexString();
    assert.fieldEquals("ReceiptOwnerBalance", id, "balance", "40");
  });

  test("handles zero change", () => {
    handleBalanceChange(RECEIPT_ADDRESS, TOKEN_ID, changetype<Bytes>(OWNER), BigInt.fromI32(50));
    handleBalanceChange(RECEIPT_ADDRESS, TOKEN_ID, changetype<Bytes>(OWNER), BigInt.zero());

    const id = createReceiptOwnerBalanceId(RECEIPT_ADDRESS, TOKEN_ID, changetype<Bytes>(OWNER)).toHexString();
    assert.fieldEquals("ReceiptOwnerBalance", id, "balance", "50");
  });
});
