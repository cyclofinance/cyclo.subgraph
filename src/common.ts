import { Account } from "../generated/schema";
import { factory } from "../generated/cysFLR/factory";
import { Address, BigInt, BigDecimal, Bytes } from "@graphprotocol/graph-ts";
import { REWARDS_SOURCES, V2_POOL_FACTORIES, V3_POOL_FACTORIES } from "./constants";

export function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address);
  if (!account) {
    account = new Account(address);
    account.address = address;
    account.cysFLRBalance = BigInt.fromI32(0);
    account.cyWETHBalance = BigInt.fromI32(0);
    account.cyFXRPBalance = BigInt.fromI32(0);
    account.cyWBTCBalance = BigInt.fromI32(0);
    account.cycbBTCBalance = BigInt.fromI32(0);
    account.totalCyBalance = BigInt.fromI32(0);
    account.eligibleShare = BigDecimal.fromString("0");
    account.save();
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