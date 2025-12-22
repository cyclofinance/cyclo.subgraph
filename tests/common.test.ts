import { createTransferEvent } from "./utils";
import { TimeState } from "../generated/schema";
import { TIME_STATE_ID } from "../src/constants";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";
import { currentDay, DAY, getAccountsMetadata, getOrCreateAccount, prevDay, updateTimeState } from "../src/common";

// Test addresses
const USER_1 = Address.fromString("0x0000000000000000000000000000000000000001");
const USER_2 = Address.fromString("0x0000000000000000000000000000000000000002");

// Token address
const CYSFLR_ADDRESS = Address.fromString(
  "0x19831cfB53A0dbeAD9866C43557C1D48DfF76567"
);

describe("Test AccountsMetadata", () => {
    test("should derive accounts list correctly", () => {
        getOrCreateAccount(USER_1);
        let accountsMetadata = getAccountsMetadata();

        let list = accountsMetadata.accounts.load();
        assert.assertTrue(list.length == 1);

        // add another address
        getOrCreateAccount(USER_2);
        accountsMetadata = getAccountsMetadata();

        list = accountsMetadata.accounts.load();
        assert.assertTrue(list.length == 2);
    })
});

describe("Test TimeState", () => {
    test("should start TimeState and update it correctly", () => {
        const originTimestamp = BigInt.fromI32(1720267123);
        const nextTimestamp = BigInt.fromI32(1720268123);
        const dayPassedTimestamp = BigInt.fromI32(1720267123 + DAY.toI32() + 46);
        const anotherDayPassedTimestamp = BigInt.fromI32(1720267123 + (DAY.toI32() * 2) + 46);
        const mockEvent1 = createTransferEvent(
            USER_1,
            USER_2,
            BigInt.fromI32(100),
            CYSFLR_ADDRESS,
            null,
            null,
            null,
            originTimestamp,
        );
        const mockEvent2 = createTransferEvent(
            USER_1,
            USER_2,
            BigInt.fromI32(100),
            CYSFLR_ADDRESS,
            null,
            null,
            null,
            nextTimestamp,
        );
        const mockEvent3 = createTransferEvent(
            USER_1,
            USER_2,
            BigInt.fromI32(100),
            CYSFLR_ADDRESS,
            null,
            null,
            null,
            dayPassedTimestamp,
        );
        const mockEvent4 = createTransferEvent(
            USER_1,
            USER_2,
            BigInt.fromI32(100),
            CYSFLR_ADDRESS,
            null,
            null,
            null,
            anotherDayPassedTimestamp,
        );

        updateTimeState(mockEvent1);
        let timeState = TimeState.load(TIME_STATE_ID)!;

        assert.bigIntEquals(timeState.originTimestamp, originTimestamp);
        assert.bigIntEquals(timeState.currentTimestamp, originTimestamp);
        assert.bigIntEquals(timeState.prevTimestamp, originTimestamp);
        assert.bigIntEquals(prevDay(), BigInt.fromI32(0));
        assert.bigIntEquals(currentDay(), BigInt.fromI32(0));

        // update with second event
        updateTimeState(mockEvent2);
        timeState = TimeState.load(TIME_STATE_ID)!;

        assert.bigIntEquals(timeState.originTimestamp, originTimestamp);
        assert.bigIntEquals(timeState.currentTimestamp, nextTimestamp);
        assert.bigIntEquals(timeState.prevTimestamp, originTimestamp);
        assert.bigIntEquals(prevDay(), BigInt.fromI32(0));
        assert.bigIntEquals(currentDay(), BigInt.fromI32(0));

        // update with third event (day passed)
        updateTimeState(mockEvent3);
        timeState = TimeState.load(TIME_STATE_ID)!;

        assert.bigIntEquals(timeState.originTimestamp, originTimestamp);
        assert.bigIntEquals(timeState.currentTimestamp, dayPassedTimestamp);
        assert.bigIntEquals(timeState.prevTimestamp, nextTimestamp);
        assert.bigIntEquals(prevDay(), BigInt.fromI32(0));
        assert.bigIntEquals(currentDay(), BigInt.fromI32(1)); // current should be 1, ie 1 day passed since origin

        // update with 4th event (2 days passed)
        updateTimeState(mockEvent4);
        timeState = TimeState.load(TIME_STATE_ID)!;

        assert.bigIntEquals(timeState.originTimestamp, originTimestamp);
        assert.bigIntEquals(timeState.currentTimestamp, anotherDayPassedTimestamp);
        assert.bigIntEquals(timeState.prevTimestamp, dayPassedTimestamp); // prev day
        assert.bigIntEquals(prevDay(), BigInt.fromI32(1)); // last should be 1, ie 1 day was passed before the current (up to prev event)
        assert.bigIntEquals(currentDay(), BigInt.fromI32(2)); // current should be 2, ie 2 days passed since origin (up to the current event)
        
    });
})
