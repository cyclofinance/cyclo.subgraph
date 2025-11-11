import { Account } from "../generated/schema";
import { factory } from "../generated/cysFLR/factory";
import { Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import { REWARDS_SOURCES, V2_POOL_FACTORIES, V3_POOL_FACTORIES } from "./constants";

export function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address);
  if (!account) {
    account = new Account(address);
    account.address = address;
    account.cysFLRBalance = BigInt.fromI32(0);
    account.cyWETHBalance = BigInt.fromI32(0);
    account.totalCyBalance = BigInt.fromI32(0);
    account.eligibleShare = BigDecimal.fromString("0");
    account.save();
  }
  return account;
}

// Check if the address is a pool from approved factories
export function isV2Pool(address: Address): bool {
  return V2_POOL_FACTORIES.includes(address);
}

// Check if the address is a pool from approved factories
export function isV3Pool(address: Address): bool {
  return V3_POOL_FACTORIES.includes(address);
}

// Check if the address is a pool from approved factories
export function isPool(address: Address): bool {
  const maybeHasFactory = factory.bind(address);
  const factoryAddress = maybeHasFactory.try_factory();
  return !factoryAddress.reverted && (isV2Pool(factoryAddress.value) || isV3Pool(factoryAddress.value));
}

// Check if the address is from approved source (pool or known reward source)
export function isApprovedSource(address: Address): bool {
  return REWARDS_SOURCES.includes(address) || isPool(address);
}
