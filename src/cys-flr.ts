import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/cysFLR/cysFLR";
import { Account, Transfer, EligibleTotals } from "../generated/schema";
import { getOrCreateAccount, isApprovedSource } from "./common";
import { CYSFLR_ADDRESS, CYWETH_ADDRESS, TOTALS_ID } from "./constants";
import { handleLiquidityAdd, handleLiquidityWithdraw } from "./liquidity";

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
    totals.totalEligibleSum = BigInt.fromI32(0);
    totals.save();
  }
  return totals;
}

export function updateTotalsForAccount(
  account: Account,
  oldCysFLRBalance: BigInt,
  oldCyWETHBalance: BigInt
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

  // Update total sum
  totals.totalEligibleSum = totals.totalEligibleCysFLR.plus(
    totals.totalEligibleCyWETH
  );
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
  const oldToCysFLR = toAccount.cysFLRBalance;
  const oldToCyWETH = toAccount.cyWETHBalance;

  // Check if transfer is from approved source
  const fromIsApprovedSource = isApprovedSource(event.params.from);

  // Update balances based on which token this is
  const tokenAddress = event.address;
  if (tokenAddress.equals(CYSFLR_ADDRESS)) {
    if (fromIsApprovedSource) {
      toAccount.cysFLRBalance = toAccount.cysFLRBalance.plus(
        event.params.value
      );

      // deduct the calculated lp position value if this transfer belongs to a lp withdraw
      const lpDeductionValue = handleLiquidityWithdraw(event, event.address);
      toAccount.cysFLRBalance = toAccount.cysFLRBalance.minus(lpDeductionValue);
    }

    // deduct if not a liq add
    if (!handleLiquidityAdd(event, event.address)) {
      fromAccount.cysFLRBalance = fromAccount.cysFLRBalance.minus(
        event.params.value
      );
    }
  } else if (tokenAddress.equals(CYWETH_ADDRESS)) {
    if (fromIsApprovedSource) {
      toAccount.cyWETHBalance = toAccount.cyWETHBalance.plus(
        event.params.value
      );

      // deduct the calculated lp position value if this transfer belongs to a lp withdraw
      const lpDeductionValue = handleLiquidityWithdraw(event, event.address);
      toAccount.cyWETHBalance = toAccount.cyWETHBalance.minus(lpDeductionValue);
    }

    // deduct if not a liq add
    if (!handleLiquidityAdd(event, event.address)) {
      fromAccount.cyWETHBalance = fromAccount.cyWETHBalance.minus(
        event.params.value
      );
    }
  } else {
    return;
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
  updateTotalsForAccount(fromAccount, oldFromCysFLR, oldFromCyWETH);
  updateTotalsForAccount(toAccount, oldToCysFLR, oldToCyWETH);
}
