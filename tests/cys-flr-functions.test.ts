import {
    assert,
    createMockedFunction,
    describe,
    test,
} from "matchstick-as";
import {BigInt, Bytes, Address, ethereum} from "@graphprotocol/graph-ts";
import {getOrInitTrackingPeriod, isApprovedSource, getOrInitAccount, getPeriodFromTimestamp, idFromTimestampAndAddress, getOrInitTrackingPeriodForAccount} from "../src/cys-flr";
import {
    TrackingPeriod,
    Account,
    TrackingPeriodForAccount
} from "../generated/schema";

const JAN_1 = BigInt.fromI32(1735680000);
const JAN_31 = BigInt.fromI32(1738262399);
const MAR_2 = BigInt.fromI32(1740854399);
const APR_1 = BigInt.fromI32(1743446399);
const MAY_1 = BigInt.fromI32(1746038399);


function mockFactory(address: string): void{
    createMockedFunction(Address.fromString(address), 'factory', 'factory():(address)')
        .withArgs([])
        .returns([ethereum.Value.fromAddress(Address.fromString(address))])
}

describe('Functions unit tests', () => {

    // Test getOrInitTrackingPeriod function
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

    // Test isApprovedSource function
    test("isApprovedSource returns true for approved factory", () => {
        mockFactory("0x16b619B04c961E8f4F06C10B42FDAbb328980A89")
        let approvedFactory = Address.fromString("0x16b619B04c961E8f4F06C10B42FDAbb328980A89");
        assert.assertTrue(isApprovedSource(approvedFactory));
    });

    test("isApprovedSource returns true for approved rewards source", () => {
        mockFactory("0xcee8cd002f151a536394e564b84076c41bbbcd4d")

        let approvedSource = Address.fromString("0xcee8cd002f151a536394e564b84076c41bbbcd4d");
        assert.assertTrue(isApprovedSource(approvedSource));
    });

    test("isApprovedSource returns false for unapproved address", () => {
        mockFactory("0x0000000000000000000000000000000000000000")

        let unapprovedAddress = Address.fromString("0x0000000000000000000000000000000000000000");
        assert.assertTrue(!isApprovedSource(unapprovedAddress));
    });

    // Test getOrInitAccount function
    test("getOrInitAccount initializes new Account", () => {
        let address = Address.fromString("0x0000000000000000000000000000000000000001");
        getOrInitAccount(address);

        assert.fieldEquals("Account", address.toHexString(), "address", address.toHexString());
    });

    test("getOrInitAccount loads existing Account", () => {
        let address = Address.fromString("0x0000000000000000000000000000000000000001");

        let account = new Account(address);
        account.address = address;
        account.save();

        getOrInitAccount(address);
        assert.fieldEquals("Account", address.toHexString(), "address", address.toHexString());
    });

    // Test getPeriodFromTimestamp function
    test("getPeriodFromTimestamp returns ALL_TIME for given timestamp", () => {
        assert.stringEquals(getPeriodFromTimestamp(JAN_1), "ALL_TIME");
        assert.stringEquals(getPeriodFromTimestamp(JAN_31), "ALL_TIME");
        assert.stringEquals(getPeriodFromTimestamp(MAR_2), "ALL_TIME");
        assert.stringEquals(getPeriodFromTimestamp(APR_1), "ALL_TIME");
        assert.stringEquals(getPeriodFromTimestamp(MAY_1), "ALL_TIME");
    });

    // Test idFromTimestampAndAddress function
    test("should concatenate period and address into Bytes", () => {
        const period = "JAN_2";
        const address = Address.fromString("0x1234567890abcdef1234567890abcdef12345678");

        const expectedBytes = Bytes.fromUTF8(period).concat(address);

        const result = idFromTimestampAndAddress(period, address);

        assert.bytesEquals(result, expectedBytes);
        assert.stringEquals(result.toHexString(), expectedBytes.toHexString());
    });

    // Test getOrInitTrackingPeriodForAccount function
    test("should initialize a new TrackingPeriodForAccount when none exists", () => {
        const address = Address.fromString("0x1234567890abcdef1234567890abcdef12345678");
        const trackingPeriod = getOrInitTrackingPeriodForAccount(address, JAN_1);
        trackingPeriod.save();
        const id = Bytes.fromUTF8("ALL_TIME").concat(address).toHexString();

        assert.fieldEquals("TrackingPeriodForAccount", id, "id", id);
        assert.fieldEquals("TrackingPeriodForAccount", id, "account", address.toHexString());
        assert.fieldEquals("TrackingPeriodForAccount", id, "period", "ALL_TIME");
        assert.fieldEquals("TrackingPeriodForAccount", id, "culmulativeTransfersInFromApprovedSources", "0");
        assert.fieldEquals("TrackingPeriodForAccount", id, "culmulativeTransfersOut", "0");
        assert.fieldEquals("TrackingPeriodForAccount", id, "netApprovedTransfersIn", "0");
    });

    test("should retrieve an existing TrackingPeriodForAccount", () => {
        // Input values
        const address = Address.fromString("0x1234567890abcdef1234567890abcdef12345678");

        // Create and save an entity
        const id = Bytes.fromUTF8("ALL_TIME").concat(address);
        const idString = id.toHexString()
        const existingTrackingPeriod = new TrackingPeriodForAccount(id);
        existingTrackingPeriod.account = address;
        existingTrackingPeriod.period = "ALL_TIME";
        existingTrackingPeriod.culmulativeTransfersInFromApprovedSources = BigInt.fromI32(10);
        existingTrackingPeriod.culmulativeTransfersOut = BigInt.fromI32(5);
        existingTrackingPeriod.netApprovedTransfersIn = BigInt.fromI32(5);
        existingTrackingPeriod.save();

        getOrInitTrackingPeriodForAccount(address, APR_1);

        assert.fieldEquals("TrackingPeriodForAccount", idString, "id", idString);
        assert.fieldEquals("TrackingPeriodForAccount", idString, "culmulativeTransfersInFromApprovedSources", "10");
        assert.fieldEquals("TrackingPeriodForAccount", idString, "culmulativeTransfersOut", "5");
        assert.fieldEquals("TrackingPeriodForAccount", idString, "netApprovedTransfersIn", "5");
    });
});
