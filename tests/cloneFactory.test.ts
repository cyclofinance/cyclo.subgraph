import { assert, describe, test, clearStore, beforeAll, beforeEach, afterEach } from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent, dataSourceMock } from "matchstick-as";

// Set network BEFORE importing cloneFactory, which triggers cloneFactoryImplementation singleton init
dataSourceMock.setNetwork("flare");

import { NewClone } from "../generated/CloneFactory/CloneFactory";
import { handleNewClone } from "../src/cloneFactory";
import {
  FLARE_TOKEN_IMPLEMENTATION_ADDRESS,
  FLARE_TOKEN_IMPLEMENTATION_ADDRESS_2,
  FLARE_TOKEN_IMPLEMENTATION_ADDRESS_3,
  FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS,
  FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_2,
  FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_3,
} from "../src/cloneFactoryImplementation";

const SENDER = Address.fromString("0x0000000000000000000000000000000000000001");
const CLONE_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000099");
const UNKNOWN_IMPL = Address.fromString("0x0000000000000000000000000000000000abcdef");

function createNewCloneEvent(sender: Address, implementation: Address, clone: Address): NewClone {
  let event = changetype<NewClone>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender)));
  event.parameters.push(new ethereum.EventParam("implementation", ethereum.Value.fromAddress(implementation)));
  event.parameters.push(new ethereum.EventParam("clone", ethereum.Value.fromAddress(clone)));
  event.block.number = BigInt.fromI32(1000);
  event.block.timestamp = BigInt.fromI32(1234567890);
  return event;
}

describe("handleNewClone", () => {
  beforeAll(() => {
    dataSourceMock.setNetwork("flare");
  });

  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  test("Creates CycloReceipt for receipt implementation", () => {
    let event = createNewCloneEvent(SENDER, FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS, CLONE_ADDRESS);
    handleNewClone(event);

    assert.entityCount("CycloReceipt", 1);
    assert.fieldEquals("CycloReceipt", CLONE_ADDRESS.toHexString(), "deployBlock", "1000");
    assert.fieldEquals("CycloReceipt", CLONE_ADDRESS.toHexString(), "deployTimestamp", "1234567890");
  });

  test("Does not create CycloVault for receipt implementation", () => {
    let event = createNewCloneEvent(SENDER, FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS, CLONE_ADDRESS);
    handleNewClone(event);

    assert.entityCount("CycloVault", 0);
  });

  test("Creates CycloVault for vault implementation", () => {
    let event = createNewCloneEvent(SENDER, FLARE_TOKEN_IMPLEMENTATION_ADDRESS, CLONE_ADDRESS);
    handleNewClone(event);

    assert.entityCount("CycloVault", 1);
    assert.fieldEquals("CycloVault", CLONE_ADDRESS.toHexString(), "deployBlock", "1000");
    assert.fieldEquals("CycloVault", CLONE_ADDRESS.toHexString(), "deployTimestamp", "1234567890");
    assert.fieldEquals("CycloVault", CLONE_ADDRESS.toHexString(), "totalEligible", "0");
    assert.fieldEquals("CycloVault", CLONE_ADDRESS.toHexString(), "totalEligibleSnapshot", "0");
  });

  test("Does not create CycloReceipt for vault implementation", () => {
    let event = createNewCloneEvent(SENDER, FLARE_TOKEN_IMPLEMENTATION_ADDRESS, CLONE_ADDRESS);
    handleNewClone(event);

    assert.entityCount("CycloReceipt", 0);
  });

  test("Unknown implementation creates neither entity", () => {
    let event = createNewCloneEvent(SENDER, UNKNOWN_IMPL, CLONE_ADDRESS);
    handleNewClone(event);

    assert.entityCount("CycloVault", 0);
    assert.entityCount("CycloReceipt", 0);
  });

  test("Receipt and vault implementation addresses are disjoint", () => {
    const vaultImpls: Address[] = [
      FLARE_TOKEN_IMPLEMENTATION_ADDRESS,
      FLARE_TOKEN_IMPLEMENTATION_ADDRESS_2,
      FLARE_TOKEN_IMPLEMENTATION_ADDRESS_3,
    ];
    const receiptImpls: Address[] = [
      FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS,
      FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_2,
      FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_3,
    ];
    for (let i = 0; i < vaultImpls.length; i++) {
      for (let j = 0; j < receiptImpls.length; j++) {
        assert.assertTrue(!vaultImpls[i].equals(receiptImpls[j]));
      }
    }
  });
});
