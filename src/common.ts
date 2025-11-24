import { Account } from "../generated/schema";
import { Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

export function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address);
  if (!account) {
    account = new Account(address);
    account.address = address;
    account.totalCyBalance = BigInt.fromI32(0);
    account.eligibleShare = BigDecimal.fromString("0");
    account.save();
  }
  return account;
}
