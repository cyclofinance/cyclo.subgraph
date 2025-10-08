import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/cysFLR/cysFLR";
import { Account, Transfer, EligibleTotals } from "../generated/schema";
import { factory } from "../generated/cysFLR/factory";
import { log } from "@graphprotocol/graph-ts";

const REWARDS_SOURCES = [
  Address.fromString("0xcee8cd002f151a536394e564b84076c41bbbcd4d"), // orderbook
  Address.fromString("0x0f3D8a38D4c74afBebc2c42695642f0e3acb15D3"), // Sparkdex Universal Router
  Address.fromString("0x6352a56caadC4F1E25CD6c75970Fa768A3304e64"), // OpenOcean Exchange Proxy
  Address.fromString("0xeD85325119cCFc6aCB16FA931bAC6378B76e4615"), // OpenOcean Exchange Impl
  Address.fromString("0x8c7ba8f245aef3216698087461e05b85483f791f"), // OpenOcean Exchange Router
  Address.fromString("0x9D70B0b90915Bb8b9bdAC7e6a7e6435bBF1feC4D"), // Sparkdex TWAP
];

const FACTORIES = [
  Address.fromString("0x16b619B04c961E8f4F06C10B42FDAbb328980A89"), // Sparkdex V2
  Address.fromString("0xb3fB4f96175f6f9D716c17744e5A6d4BA9da8176"), // Sparkdex V3
  Address.fromString("0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652"), // Sparkdex V3.1
  Address.fromString("0x440602f459D7Dd500a74528003e6A20A46d6e2A6"), // Blazeswap
];

const CYSFLR_ADDRESS =
  "0x19831cfB53A0dbeAD9866C43557C1D48DfF76567".toLowerCase();
const CYWETH_ADDRESS =
  "0xd8BF1d2720E9fFD01a2F9A2eFc3E101a05B852b4".toLowerCase();
const TOTALS_ID = "SINGLETON";

function isApprovedSource(address: Address): boolean {
  // Check if the address is a pool from approved factories
  const maybeHasFactory = factory.bind(address);
  const factoryAddress = maybeHasFactory.try_factory();

  if (!factoryAddress.reverted) {
    if (FACTORIES.includes(factoryAddress.value)) {
      return true;
    }
  }

  // Check if address is directly an approved source
  if (REWARDS_SOURCES.includes(address)) {
    return true;
  }

  return false;
}

function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address);
  if (!account) {
    account = new Account(address);
    account.address = address;
    account.cysFLRBalance = BigInt.fromI32(0);
    account.cyWETHBalance = BigInt.fromI32(0);
    account.totalCyBalance = BigInt.fromI32(0);
    account.save();
  }
  return account;
}

function getOrCreateTotals(): EligibleTotals {
  let totals = EligibleTotals.load(TOTALS_ID);
  if (!totals) {
    totals = new EligibleTotals(TOTALS_ID);
    totals.totalEligibleCysFLR = BigInt.fromI32(0);
    totals.totalEligibleCyWETH = BigInt.fromI32(0);
    totals.totalEligibleSum = BigInt.fromI32(0);
    totals.save();
  }
  return totals;
}

function updateTotals(
  account: Account,
  oldCysFLRBalance: BigInt,
  oldCyWETHBalance: BigInt
): EligibleTotals {
  const totals = getOrCreateTotals();

  // Handle cysFLR changes
  if (oldCysFLRBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCysFLR =
      totals.totalEligibleCysFLR.minus(oldCysFLRBalance);
  }
  if (account.cysFLRBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCysFLR = totals.totalEligibleCysFLR.plus(
      account.cysFLRBalance
    );
  }

  // Handle cyWETH changes
  if (oldCyWETHBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyWETH =
      totals.totalEligibleCyWETH.minus(oldCyWETHBalance);
  }
  if (account.cyWETHBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyWETH = totals.totalEligibleCyWETH.plus(
      account.cyWETHBalance
    );
  }

  // Update total sum
  totals.totalEligibleSum = totals.totalEligibleCysFLR.plus(
    totals.totalEligibleCyWETH
  );
  totals.save();

  return totals;
}

function updateTotalBalance(account: Account): void {
  // Only count positive balances towards total
  const cysFLRContribution = account.cysFLRBalance.gt(BigInt.fromI32(0))
    ? account.cysFLRBalance
    : BigInt.fromI32(0);

  const cyWETHContribution = account.cyWETHBalance.gt(BigInt.fromI32(0))
    ? account.cyWETHBalance
    : BigInt.fromI32(0);

  account.totalCyBalance = cysFLRContribution.plus(cyWETHContribution);
}

export function handleTransfer(event: TransferEvent): void {
  const fromAccount = getOrCreateAccount(event.params.from);
  const toAccount = getOrCreateAccount(event.params.to);

  // Store old balances for totals calculation
  const oldFromCysFLR = fromAccount.cysFLRBalance;
  const oldFromCyWETH = fromAccount.cyWETHBalance;
  const oldToCysFLR = toAccount.cysFLRBalance;
  const oldToCyWETH = toAccount.cyWETHBalance;

  // Check if transfer is from approved source
  const fromIsApprovedSource = isApprovedSource(event.params.from);

  // Update balances based on which token this is
  const tokenAddress = event.address.toHexString().toLowerCase();
  if (tokenAddress == CYSFLR_ADDRESS) {
    fromAccount.cysFLRBalance = fromAccount.cysFLRBalance.minus(
      event.params.value
    );
    // Only increase recipient balance if from approved source
    if (fromIsApprovedSource) {
      toAccount.cysFLRBalance = toAccount.cysFLRBalance.plus(
        event.params.value
      );
    }
  } else if (tokenAddress == CYWETH_ADDRESS) {
    fromAccount.cyWETHBalance = fromAccount.cyWETHBalance.minus(
      event.params.value
    );
    // Only increase recipient balance if from approved source
    if (fromIsApprovedSource) {
      toAccount.cyWETHBalance = toAccount.cyWETHBalance.plus(
        event.params.value
      );
    }
  }

  // Update account total balances
  updateTotalBalance(fromAccount);
  updateTotalBalance(toAccount);

  // Save accounts
  fromAccount.save();
  toAccount.save();

  // Create transfer entity
  const transfer = new Transfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  transfer.tokenAddress = event.address;
  transfer.fromIsApprovedSource = fromIsApprovedSource;
  transfer.from = fromAccount.id;
  transfer.to = toAccount.id;
  transfer.value = event.params.value;
  transfer.blockNumber = event.block.number;
  transfer.blockTimestamp = event.block.timestamp;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();

  // Update totals for both accounts
  updateTotals(fromAccount, oldFromCysFLR, oldFromCyWETH);
  updateTotals(toAccount, oldToCysFLR, oldToCyWETH);

  // No more share updates needed
}
