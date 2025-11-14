import { Account } from "../generated/schema";
import { Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

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
    account.cyLINKBalance = BigInt.fromI32(0);
    account.cyDOTBalance = BigInt.fromI32(0);
    account.cyUNIBalance = BigInt.fromI32(0);
    account.cyPEPEBalance = BigInt.fromI32(0);
    account.cyENABalance = BigInt.fromI32(0);
    account.cyARBBalance = BigInt.fromI32(0);
    account.totalCyBalance = BigInt.fromI32(0);
    account.eligibleShare = BigDecimal.fromString("0");
    account.save();
  }
  return account;
}
