import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
  createMockedFunction
} from "matchstick-as";
import {Address, BigInt, Bytes, ethereum} from "@graphprotocol/graph-ts";
import { handleTransfer } from "../src/cys-flr";
import { createTransferEvent } from "./cys-flr-utils";

let entityId: Bytes ;

describe("Handle Transfer event tests", () => {
  // Mock the factory function for the address we're interested in
  beforeAll(() => {
    createMockedFunction(Address.fromString("0x16b619B04c961E8f4F06C10B42FDAbb328980A89"), 'factory', 'factory():(address)')
        .withArgs([])
        .returns([ethereum.Value.fromAddress(Address.fromString('0x16b619B04c961E8f4F06C10B42FDAbb328980A89'))])

    // Now, simulate the transfer event
    let from = Address.fromString("0x16b619B04c961E8f4F06C10B42FDAbb328980A89");
    let to = Address.fromString("0x0000000000000000000000000000000000000002");
    let value = BigInt.fromI32(1000);

    let transferEvent = createTransferEvent(from, to, value);

    entityId = transferEvent.transaction.hash.concatI32(
        transferEvent.logIndex.toI32()
    );

    handleTransfer(transferEvent);
  });

  afterAll(() => {
    clearStore();
  });

  test("Transfer entity is created and stored", () => {
    assert.entityCount("Transfer", 1);

    // Check if the transfer event data was correctly stored
    assert.fieldEquals(
        "Transfer",
        entityId.toHex(), // Entity ID
        "from",
        "0x16b619b04c961e8f4f06c10b42fdabb328980a89"
    );
    assert.fieldEquals(
        "Transfer",
        entityId.toHex(), // Entity ID
        "to",
        "0x0000000000000000000000000000000000000002"
    );
    assert.fieldEquals(
        "Transfer",
        entityId.toHex(), // Entity ID
        "value",
        "1000"
    );
  });
});
