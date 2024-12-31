import {
    assert,
    describe,
    test,
} from "matchstick-as";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { getOrInitTrackingPeriod } from "../src/cys-flr";
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
