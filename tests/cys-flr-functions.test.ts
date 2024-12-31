import {
    assert,
    createMockedFunction,
    describe,
    test,
} from "matchstick-as";
import {BigInt, Bytes, Address, ethereum} from "@graphprotocol/graph-ts";
import { getOrInitTrackingPeriod, isApprovedSource } from "../src/cys-flr";
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

    test("isApprovedSource returns true for approved factory", () => {
        createMockedFunction(Address.fromString("0x16b619B04c961E8f4F06C10B42FDAbb328980A89"), 'factory', 'factory():(address)')
            .withArgs([])
            .returns([ethereum.Value.fromAddress(Address.fromString('0x16b619B04c961E8f4F06C10B42FDAbb328980A89'))])
        let approvedFactory = Address.fromString("0x16b619B04c961E8f4F06C10B42FDAbb328980A89");
        assert.assertTrue(isApprovedSource(approvedFactory));
    });
});
