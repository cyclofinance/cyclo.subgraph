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
import { getOrInitTrackingPeriod } from "../src/cys-flr";
let entityId: Bytes ;
import {
  TrackingPeriod,
} from "../generated/schema";

describe('Functions unit tests', () => {
  test("getOrInitTrackingPeriod initializes new TrackingPeriod", () => {
    let period = "JAN_2";
    let trackingPeriod = getOrInitTrackingPeriod(period);
    trackingPeriod.save();

    assert.fieldEquals("TrackingPeriod", Bytes.fromUTF8(period).toHexString(), "period", period);
    assert.fieldEquals("TrackingPeriod", Bytes.fromUTF8(period).toHexString(), "totalApprovedTransfersIn", "0");
  });

  test("getOrInitTrackingPeriod loads existing TrackingPeriod", () => {
    let period = "JAN_2";
    let id = Bytes.fromUTF8(period).toHexString();

    let trackingPeriod = new TrackingPeriod(Bytes.fromUTF8(period));
    trackingPeriod.period = period;
    trackingPeriod.totalApprovedTransfersIn = BigInt.fromI32(100);
    trackingPeriod.save();

    getOrInitTrackingPeriod(period);
    assert.fieldEquals("TrackingPeriod", id, "totalApprovedTransfersIn", "100");
  });
});

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
        entityId.toHex(),
        "from",
        "0x16b619b04c961e8f4f06c10b42fdabb328980a89"
    );
    assert.fieldEquals(
        "Transfer",
        entityId.toHex(),
        "to",
        "0x0000000000000000000000000000000000000002"
    );
    assert.fieldEquals(
        "Transfer",
        entityId.toHex(),
        "value",
        "1000"
    );
  });
});
