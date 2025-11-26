import { Address, BigInt, BigDecimal, dataSource } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/cysFLR/cysFLR";
import { Account, Transfer, EligibleTotals } from "../generated/schema";
import { factory } from "../generated/cysFLR/factory";
import { getOrCreateAccount } from "./common";
import { NetworkImplementation } from "./networkImplementation";

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

const TOTALS_ID = "SINGLETON";

function isApprovedSource(address: Address): boolean {
  // Non-flare networks consider all sources approved.
  if (dataSource.network() != "flare") {
    return true;
  }

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

function calculateEligibleShare(
  account: Account,
  totals: EligibleTotals
): BigDecimal {
  // Sum only positive balances
  let positiveTotal = BigInt.fromI32(0);
  if (account.cysFLRBalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cysFLRBalance);
  }
  if (account.cyWETHBalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cyWETHBalance);
  }
  if (account.cyFXRPBalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cyFXRPBalance);
  }
  if (account.cyWBTCBalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cyWBTCBalance);
  }
  if (account.cycbBTCBalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cycbBTCBalance);
  }
  if (account.cyLINKBalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cyLINKBalance);
  }
  if (account.cyDOTBalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cyDOTBalance);
  }
  if (account.cyUNIBalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cyUNIBalance);
  }
  if (account.cyPEPEBalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cyPEPEBalance);
  }
  if (account.cyENABalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cyENABalance);
  }
  if (account.cyARBBalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cyARBBalance);
  }
  if (account.cywstETHBalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cywstETHBalance);
  }
  if (account.cyXAUt0Balance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cyXAUt0Balance);
  }
  if (account.cyPYTHBalance.gt(BigInt.fromI32(0))) {
    positiveTotal = positiveTotal.plus(account.cyPYTHBalance);
  }

  account.totalCyBalance = positiveTotal;

  // If account has no positive balance, their share is 0
  if (account.totalCyBalance.equals(BigInt.fromI32(0))) {
    return BigDecimal.fromString("0");
  }

  // If there's no eligible total, but account has positive balance, they have 100%
  if (totals.totalEligibleSum.equals(BigInt.fromI32(0))) {
    return BigDecimal.fromString("1");
  }

  // Calculate share as decimal percentage
  return account.totalCyBalance
    .toBigDecimal()
    .div(totals.totalEligibleSum.toBigDecimal());
}

function getOrCreateTotals(): EligibleTotals {
  let totals = EligibleTotals.load(TOTALS_ID);
  if (!totals) {
    totals = new EligibleTotals(TOTALS_ID);
    totals.totalEligibleCysFLR = BigInt.fromI32(0);
    totals.totalEligibleCyWETH = BigInt.fromI32(0);
    totals.totalEligibleCyFXRP = BigInt.fromI32(0);
    totals.totalEligibleCyWBTC = BigInt.fromI32(0);
    totals.totalEligibleCycbBTC = BigInt.fromI32(0);
    totals.totalEligibleCyLINK = BigInt.fromI32(0);
    totals.totalEligibleCyDOT = BigInt.fromI32(0);
    totals.totalEligibleCyUNI = BigInt.fromI32(0);
    totals.totalEligibleCyPEPE = BigInt.fromI32(0);
    totals.totalEligibleCyENA = BigInt.fromI32(0);
    totals.totalEligibleCyARB = BigInt.fromI32(0);
    totals.totalEligibleCywstETH = BigInt.fromI32(0);
    totals.totalEligibleCyXAUt0 = BigInt.fromI32(0);
    totals.totalEligibleCyPYTH = BigInt.fromI32(0);
    totals.totalEligibleSum = BigInt.fromI32(0);
    totals.save();
  }
  return totals;
}

function updateTotalsForAccount(
  account: Account,
  oldCysFLRBalance: BigInt,
  oldCyWETHBalance: BigInt,
  oldCyFXRPBalance: BigInt,
  oldCyWBTCBalance: BigInt,
  oldCycbBTCBalance: BigInt,
  oldCyLINKBalance: BigInt,
  oldCyDOTBalance: BigInt,
  oldCyUNIBalance: BigInt,
  oldCyPEPEBalance: BigInt,
  oldCyENABalance: BigInt,
  oldCyARBBalance: BigInt,
  oldCywstETHBalance: BigInt,
  oldCyXAUt0Balance: BigInt,
  oldCyPYTHBalance: BigInt
): void {
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

  // Handle cyFXRP changes
  if (oldCyFXRPBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyFXRP =
      totals.totalEligibleCyFXRP.minus(oldCyFXRPBalance);
  }
  if (account.cyFXRPBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyFXRP = totals.totalEligibleCyFXRP.plus(
      account.cyFXRPBalance
    );
  }

  // Handle cyWBTC changes
  if (oldCyWBTCBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyWBTC =
      totals.totalEligibleCyWBTC.minus(oldCyWBTCBalance);
  }
  if (account.cyWBTCBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyWBTC = totals.totalEligibleCyWBTC.plus(
      account.cyWBTCBalance
    );
  }

  // Handle cycbBTC changes
  if (oldCycbBTCBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCycbBTC =
      totals.totalEligibleCycbBTC.minus(oldCycbBTCBalance);
  }
  if (account.cycbBTCBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCycbBTC = totals.totalEligibleCycbBTC.plus(
      account.cycbBTCBalance
    );
  }

  // Handle cyLINK changes
  if (oldCyLINKBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyLINK =
      totals.totalEligibleCyLINK.minus(oldCyLINKBalance);
  }
  if (account.cyLINKBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyLINK = totals.totalEligibleCyLINK.plus(
      account.cyLINKBalance
    );
  }

  // Handle cyDOT changes
  if (oldCyDOTBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyDOT = totals.totalEligibleCyDOT.minus(
      oldCyDOTBalance
    );
  }
  if (account.cyDOTBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyDOT = totals.totalEligibleCyDOT.plus(
      account.cyDOTBalance
    );
  }

  // Handle cyUNI changes
  if (oldCyUNIBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyUNI = totals.totalEligibleCyUNI.minus(
      oldCyUNIBalance
    );
  }
  if (account.cyUNIBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyUNI = totals.totalEligibleCyUNI.plus(
      account.cyUNIBalance
    );
  }

  // Handle cyPEPE changes
  if (oldCyPEPEBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyPEPE = totals.totalEligibleCyPEPE.minus(
      oldCyPEPEBalance
    );
  }
  if (account.cyPEPEBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyPEPE = totals.totalEligibleCyPEPE.plus(
      account.cyPEPEBalance
    );
  }

  // Handle cyENA changes
  if (oldCyENABalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyENA = totals.totalEligibleCyENA.minus(
      oldCyENABalance
    );
  }
  if (account.cyENABalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyENA = totals.totalEligibleCyENA.plus(
      account.cyENABalance
    );
  }

  // Handle cyARB changes
  if (oldCyARBBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyARB = totals.totalEligibleCyARB.minus(
      oldCyARBBalance
    );
  }
  if (account.cyARBBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyARB = totals.totalEligibleCyARB.plus(
      account.cyARBBalance
    );
  }

  // Handle cywstETH changes
  if (oldCywstETHBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCywstETH =
      totals.totalEligibleCywstETH.minus(oldCywstETHBalance);
  }
  if (account.cywstETHBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCywstETH = totals.totalEligibleCywstETH.plus(
      account.cywstETHBalance
    );
  }

  // Handle cyXAUt0 changes
  if (oldCyXAUt0Balance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyXAUt0 =
      totals.totalEligibleCyXAUt0.minus(oldCyXAUt0Balance);
  }
  if (account.cyXAUt0Balance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyXAUt0 = totals.totalEligibleCyXAUt0.plus(
      account.cyXAUt0Balance
    );
  }

  // Handle cyPYTH changes
  if (oldCyPYTHBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyPYTH =
      totals.totalEligibleCyPYTH.minus(oldCyPYTHBalance);
  }
  if (account.cyPYTHBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleCyPYTH = totals.totalEligibleCyPYTH.plus(
      account.cyPYTHBalance
    );
  }

  // Update total sum
  totals.totalEligibleSum = totals.totalEligibleCysFLR
    .plus(totals.totalEligibleCyWETH)
    .plus(totals.totalEligibleCyFXRP)
    .plus(totals.totalEligibleCyWBTC)
    .plus(totals.totalEligibleCycbBTC)
    .plus(totals.totalEligibleCyLINK)
    .plus(totals.totalEligibleCyDOT)
    .plus(totals.totalEligibleCyUNI)
    .plus(totals.totalEligibleCyPEPE)
    .plus(totals.totalEligibleCyENA)
    .plus(totals.totalEligibleCyARB)
    .plus(totals.totalEligibleCywstETH)
    .plus(totals.totalEligibleCyXAUt0)
    .plus(totals.totalEligibleCyPYTH);
  totals.save();

  // Update account's share
  account.eligibleShare = calculateEligibleShare(account, totals);
  account.save();
}

export function handleTransfer(event: TransferEvent): void {
  const fromAccount = getOrCreateAccount(event.params.from);
  const toAccount = getOrCreateAccount(event.params.to);

  // Store old balances for totals calculation
  const oldFromCysFLR = fromAccount.cysFLRBalance;
  const oldFromCyWETH = fromAccount.cyWETHBalance;
  const oldFromCyFXRP = fromAccount.cyFXRPBalance;
  const oldFromCyWBTC = fromAccount.cyWBTCBalance;
  const oldFromCycbBTC = fromAccount.cycbBTCBalance;
  const oldFromCyLINK = fromAccount.cyLINKBalance;
  const oldFromCyDOT = fromAccount.cyDOTBalance;
  const oldFromCyUNI = fromAccount.cyUNIBalance;
  const oldFromCyPEPE = fromAccount.cyPEPEBalance;
  const oldFromCyENA = fromAccount.cyENABalance;
  const oldFromCyARB = fromAccount.cyARBBalance;
  const oldFromCywstETH = fromAccount.cywstETHBalance;
  const oldFromCyXAUt0 = fromAccount.cyXAUt0Balance;
  const oldFromCyPYTH = fromAccount.cyPYTHBalance;
  const oldToCysFLR = toAccount.cysFLRBalance;
  const oldToCyWETH = toAccount.cyWETHBalance;
  const oldToCyFXRP = toAccount.cyFXRPBalance;
  const oldToCyWBTC = toAccount.cyWBTCBalance;
  const oldToCycbBTC = toAccount.cycbBTCBalance;
  const oldToCyLINK = toAccount.cyLINKBalance;
  const oldToCyDOT = toAccount.cyDOTBalance;
  const oldToCyUNI = toAccount.cyUNIBalance;
  const oldToCyPEPE = toAccount.cyPEPEBalance;
  const oldToCyENA = toAccount.cyENABalance;
  const oldToCyARB = toAccount.cyARBBalance;
  const oldToCywstETH = toAccount.cywstETHBalance;
  const oldToCyXAUt0 = toAccount.cyXAUt0Balance;
  const oldToCyPYTH = toAccount.cyPYTHBalance;

  // Check if transfer is from approved source
  const fromIsApprovedSource = isApprovedSource(event.params.from);

  // Get network implementation to access addresses
  const networkImplementation = new NetworkImplementation(dataSource.network());

  // Update balances based on which token this is
  const tokenAddress = event.address.toHexString().toLowerCase();
  if (tokenAddress == networkImplementation.getCysFLRAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cysFLRBalance = toAccount.cysFLRBalance.plus(
        event.params.value
      );
    }
    fromAccount.cysFLRBalance = fromAccount.cysFLRBalance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCyWETHAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cyWETHBalance = toAccount.cyWETHBalance.plus(
        event.params.value
      );
    }
    fromAccount.cyWETHBalance = fromAccount.cyWETHBalance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCyFXRPAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cyFXRPBalance = toAccount.cyFXRPBalance.plus(
        event.params.value
      );
    }
    fromAccount.cyFXRPBalance = fromAccount.cyFXRPBalance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCyWBTCAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cyWBTCBalance = toAccount.cyWBTCBalance.plus(
        event.params.value
      );
    }
    fromAccount.cyWBTCBalance = fromAccount.cyWBTCBalance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCycbBTCAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cycbBTCBalance = toAccount.cycbBTCBalance.plus(
        event.params.value
      );
    }
    fromAccount.cycbBTCBalance = fromAccount.cycbBTCBalance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCyLINKAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cyLINKBalance = toAccount.cyLINKBalance.plus(
        event.params.value
      );
    }
    fromAccount.cyLINKBalance = fromAccount.cyLINKBalance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCyDOTAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cyDOTBalance = toAccount.cyDOTBalance.plus(
        event.params.value
      );
    }
    fromAccount.cyDOTBalance = fromAccount.cyDOTBalance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCyUNIAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cyUNIBalance = toAccount.cyUNIBalance.plus(
        event.params.value
      );
    }
    fromAccount.cyUNIBalance = fromAccount.cyUNIBalance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCyPEPEAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cyPEPEBalance = toAccount.cyPEPEBalance.plus(
        event.params.value
      );
    }
    fromAccount.cyPEPEBalance = fromAccount.cyPEPEBalance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCyENAAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cyENABalance = toAccount.cyENABalance.plus(
        event.params.value
      );
    }
    fromAccount.cyENABalance = fromAccount.cyENABalance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCyARBAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cyARBBalance = toAccount.cyARBBalance.plus(
        event.params.value
      );
    }
    fromAccount.cyARBBalance = fromAccount.cyARBBalance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCywstETHAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cywstETHBalance = toAccount.cywstETHBalance.plus(
        event.params.value
      );
    }
    fromAccount.cywstETHBalance = fromAccount.cywstETHBalance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCyXAUt0Address()) {
    if (fromIsApprovedSource) {
      toAccount.cyXAUt0Balance = toAccount.cyXAUt0Balance.plus(
        event.params.value
      );
    }
    fromAccount.cyXAUt0Balance = fromAccount.cyXAUt0Balance.minus(
      event.params.value
    );
  } else if (tokenAddress == networkImplementation.getCyPYTHAddress()) {
    if (fromIsApprovedSource) {
      toAccount.cyPYTHBalance = toAccount.cyPYTHBalance.plus(
        event.params.value
      );
    }
    fromAccount.cyPYTHBalance = fromAccount.cyPYTHBalance.minus(
      event.params.value
    );
  }

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
  updateTotalsForAccount(
    fromAccount,
    oldFromCysFLR,
    oldFromCyWETH,
    oldFromCyFXRP,
    oldFromCyWBTC,
    oldFromCycbBTC,
    oldFromCyLINK,
    oldFromCyDOT,
    oldFromCyUNI,
    oldFromCyPEPE,
    oldFromCyENA,
    oldFromCyARB,
    oldFromCywstETH,
    oldFromCyXAUt0,
    oldFromCyPYTH
  );
  updateTotalsForAccount(
    toAccount,
    oldToCysFLR,
    oldToCyWETH,
    oldToCyFXRP,
    oldToCyWBTC,
    oldToCycbBTC,
    oldToCyLINK,
    oldToCyDOT,
    oldToCyUNI,
    oldToCyPEPE,
    oldToCyENA,
    oldToCyARB,
    oldToCywstETH,
    oldToCyXAUt0,
    oldToCyPYTH
  );
}
