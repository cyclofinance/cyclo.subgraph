import { Account, AccountsMetadata, TimeState } from "../generated/schema";
import { factory } from "../generated/templates/CycloVaultTemplate/factory";
import { Address, BigInt, BigDecimal, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { REWARDS_SOURCES, V2_POOL_FACTORIES, V3_POOL_FACTORIES } from "./constants";

// day in timestamp in seconds
export const DAY = BigInt.fromI32(24 * 60 * 60);

export function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address);
  if (!account) {
    account = new Account(address);
    account.address = address;
    account.totalCyBalance = BigInt.fromI32(0);
    account.eligibleShare = BigDecimal.fromString("0");
    account.totalCyBalanceSnapshot = BigInt.fromI32(0);
    account.eligibleShareSnapshot = BigDecimal.fromString("0");
    account.save();

    // add new address to the address metadata entity
    // doing this here ensures no dups as we are inside the scope
    // where an Account record doesnt exists for the address
    getAccountsMetadata(address.toHexString());
  }

  return account;
}

// Check if the address is a pool from approved factories
export function isV2Pool(address: Address): boolean {
  return V2_POOL_FACTORIES.includes(address) as boolean;
}

// Check if the address is a pool from approved factories
export function isV3Pool(address: Address): boolean {
  return V3_POOL_FACTORIES.includes(address) as boolean;
}

// Check if the address is a pool from approved factories
export function isPool(address: Address): boolean {
  const maybeHasFactory = factory.bind(address);
  const factoryAddress = maybeHasFactory.try_factory();
  return !factoryAddress.reverted && (isV2Pool(factoryAddress.value) || isV3Pool(factoryAddress.value));
}

// Check if the address is from approved source (pool or known reward source)
export function isApprovedSource(address: Address): boolean {
  return REWARDS_SOURCES.includes(address) as boolean || isPool(address) as boolean;
}

// a unified fn to convert bigint to bytes
export function bigintToBytes(value: BigInt): Bytes {
  let hex = value.toHexString().toLowerCase();
  if (hex.startsWith("0x")) {
    hex = hex.substr(2);
  }
  hex = hex.padStart(64, "0");
  return changetype<Bytes>(Bytes.fromHexString(hex));
}

export function getAccountsMetadata(newAccount: string | null = null): AccountsMetadata {
  let accountsMetadata = AccountsMetadata.load(Bytes.fromI32(0));
  if (!accountsMetadata) {
    accountsMetadata = new AccountsMetadata(Bytes.fromI32(0));
    accountsMetadata.accounts = new Array<Bytes>();
  }

  // push the new account
  // dont need to check for dups as we only call this with new address
  // inside getOrCreateAccount() that already has guard against dups
  if (newAccount) {
    const list = accountsMetadata.accounts;
    list.push(Address.fromString(newAccount));
    accountsMetadata.accounts = list;
  }

  accountsMetadata.save();

  return accountsMetadata;
}

/**
 * Get the time state or create it once at first call, the
 * current and prev timestamp are updated upon the call
 * @param event - Current event
 * @returns The TimeState instance
 */
export function updateTimeState(event: ethereum.Event): TimeState {
  let timeState = TimeState.load(Bytes.fromI32(0));
  if (!timeState) {
    timeState = new TimeState(Bytes.fromI32(0));
    timeState.originBlock = event.block.number;
    timeState.originTimestamp = event.block.timestamp;
    timeState.currentBlock = event.block.number;
    timeState.currentTimestamp = event.block.timestamp;
  }

  timeState.prevBlock = timeState.currentBlock;
  timeState.prevTimestamp = timeState.currentTimestamp;
  timeState.currentBlock = event.block.number;
  timeState.currentTimestamp = event.block.timestamp;
  timeState.save();

  return timeState;
}

/** Returns the current timestamp */
export function currentTimestamp(): BigInt {
  let timeState = TimeState.load(Bytes.fromI32(0));
  if (!timeState) {
    return BigInt.zero();
  }
  return timeState.currentTimestamp;
}

/**
 * Returns the days passed (since origin event) before the latest
 * triggered event (ie the event prior to the latest triggered event)
 */
export function prevDay(): BigInt {
  let timeState = TimeState.load(Bytes.fromI32(0));
  if (!timeState) {
    return BigInt.zero();
  }
  return timeState.prevTimestamp
    .minus(timeState.originTimestamp)
    .div(DAY);
}

/** Returns the days passed (since origin event) until the latest triggered event */
export function currentDay(): BigInt {
  let timeState = TimeState.load(Bytes.fromI32(0));
  if (!timeState) {
    return BigInt.zero();
  }
  return timeState.currentTimestamp
    .minus(timeState.originTimestamp)
    .div(DAY);
}
