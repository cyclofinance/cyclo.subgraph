import { createTransferEvent } from "./utils";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as/assembly/index";
import { currentDay, DAY, getAccountsMetadata, lastDay, updateTimeState } from "../src/common";

// Test addresses
const USER_1 = Address.fromString("0x0000000000000000000000000000000000000001");
const USER_2 = Address.fromString("0x0000000000000000000000000000000000000002");

// Token address
const CYSFLR_ADDRESS = Address.fromString(
  "0x19831cfB53A0dbeAD9866C43557C1D48DfF76567"
);

describe("Test AccountsMetadata", () => {
    test("should create and add new address to the list", () => {
        let accountsMetadata = getAccountsMetadata(USER_1.toHexString());

        assert.assertTrue(accountsMetadata.accounts.length == 1);
        assert.fieldEquals(
            "AccountsMetadata",
            Bytes.fromI32(0).toHexString(),
            "accounts",
            `[${USER_1.toHexString()}]`
        );

        // add another address
        accountsMetadata = getAccountsMetadata(USER_2.toHexString());

        assert.assertTrue(accountsMetadata.accounts.length == 2);
        assert.fieldEquals(
            "AccountsMetadata",
            Bytes.fromI32(0).toHexString(),
            "accounts",
            `[${USER_1.toHexString()}, ${USER_2.toHexString()}]`
        );
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

        let timeState = updateTimeState(mockEvent1);

        assert.assertTrue(timeState.originTimestamp.equals(originTimestamp));
        assert.assertTrue(timeState.currentTimestamp.equals(originTimestamp));
        assert.assertTrue(timeState.daysElapsedBeforeCurrent.equals(BigInt.fromI32(0)));
        assert.assertTrue(lastDay().equals(BigInt.fromI32(0)));
        assert.assertTrue(currentDay().equals(BigInt.fromI32(0)));

        // update with second event
        timeState = updateTimeState(mockEvent2);

        assert.assertTrue(timeState.originTimestamp.equals(originTimestamp));
        assert.assertTrue(timeState.currentTimestamp.equals(nextTimestamp));
        assert.assertTrue(timeState.daysElapsedBeforeCurrent.equals(BigInt.fromI32(0)));
        assert.assertTrue(lastDay().equals(BigInt.fromI32(0)));
        assert.assertTrue(currentDay().equals(BigInt.fromI32(0)));

        // update with third event (day passed)
        timeState = updateTimeState(mockEvent3);

        assert.assertTrue(timeState.originTimestamp.equals(originTimestamp));
        assert.assertTrue(timeState.currentTimestamp.equals(dayPassedTimestamp));
        assert.assertTrue(timeState.daysElapsedBeforeCurrent.equals(BigInt.fromI32(0)));
        assert.assertTrue(lastDay().equals(BigInt.fromI32(0)));
        assert.assertTrue(currentDay().equals(BigInt.fromI32(1))); // current should be 1, ie 1 day passed since origin

        // update with 4th event (2 days passed)
        timeState = updateTimeState(mockEvent4);

        assert.assertTrue(timeState.originTimestamp.equals(originTimestamp));
        assert.assertTrue(timeState.currentTimestamp.equals(anotherDayPassedTimestamp));
        assert.assertTrue(timeState.daysElapsedBeforeCurrent.equals(BigInt.fromI32(1))); // 1 day has passed before current
        assert.assertTrue(lastDay().equals(BigInt.fromI32(1))); // last should be 1, ie 1 day was passed before the current (up to prev event)
        assert.assertTrue(currentDay().equals(BigInt.fromI32(2))); // current should be 2, ie 2 days passed since origin (up to the current event)
        
    });
})
