import { TOTALS_ID } from "./constants";
import { takeSnapshot } from "./snapshot";
import { getOrCreateAccount, isApprovedSource } from "./common";
import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts";
import { handleLiquidityAdd, handleLiquidityWithdraw } from "./liquidity";
import { Transfer as TransferEvent } from "../generated/templates/CycloVaultTemplate/CycloVault";
import { Account, Transfer, EligibleTotals, CycloVault, VaultBalance } from "../generated/schema";

function calculateEligibleShare(
  account: Account,
  totals: EligibleTotals
): BigDecimal {
  // If account has no positive balance, their share is 0
  if (account.totalCyBalance.le(BigInt.fromI32(0))) {
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

export function getOrCreateTotals(): EligibleTotals {
  let totals = EligibleTotals.load(TOTALS_ID);
  if (!totals) {
    totals = new EligibleTotals(TOTALS_ID);
    totals.totalEligibleSum = BigInt.fromI32(0);
    totals.totalEligibleSumSnapshot = BigInt.fromI32(0);
    totals.save();
  }
  return totals;
}

export function updateTotalsForAccount(
  account: Account,
  vaultAddress: Address,
  oldBalance: BigInt,
  newBalance: BigInt
): void {
  const totals = getOrCreateTotals();

  // Handle vault total changes
  let vault = CycloVault.load(vaultAddress);
  if (vault) {
    // Subtract old balance from vault total if positive
    if (oldBalance.gt(BigInt.fromI32(0))) {
      vault.totalEligible = vault.totalEligible.minus(oldBalance);
    }
    // Add new balance to vault total if positive
    if (newBalance.gt(BigInt.fromI32(0))) {
      vault.totalEligible = vault.totalEligible.plus(newBalance);
    }
    vault.save();
  }

  // Handle global totals
  if (oldBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleSum = totals.totalEligibleSum.minus(oldBalance);
  }
  if (newBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleSum = totals.totalEligibleSum.plus(newBalance);
  }
  totals.save();

  // Update account's share
  account.eligibleShare = calculateEligibleShare(account, totals);
  account.save();
}

export function getOrCreateVaultBalance(vaultAddress: Address, account: Account): VaultBalance {
  let id = vaultAddress.concat(account.address);
  let vaultBalance = VaultBalance.load(id);

  if (!vaultBalance) {
    vaultBalance = new VaultBalance(id);
    vaultBalance.vault = vaultAddress;
    vaultBalance.owner = account.id;
    vaultBalance.boughtCap = BigInt.fromI32(0);
    vaultBalance.lpBalance = BigInt.fromI32(0);
    vaultBalance.balance = BigInt.fromI32(0);
    vaultBalance.balanceAvgSnapshot = BigInt.fromI32(0);
    vaultBalance.save();
  }

  return vaultBalance;
}

/** Clamp a BigInt to a minimum of 0 */
export function clamp0(val: BigInt): BigInt {
  return val.gt(BigInt.zero()) ? val : BigInt.zero();
}

/** Eligible balance = min(clamp0(boughtCap), clamp0(lpBalance)) */
export function eligibleBalance(boughtCap: BigInt, lpBalance: BigInt): BigInt {
  const cap = clamp0(boughtCap);
  const lp = clamp0(lpBalance);
  return cap.lt(lp) ? cap : lp;
}

export function handleTransfer(event: TransferEvent): void {
  const fromAccount = getOrCreateAccount(event.params.from);
  const toAccount = getOrCreateAccount(event.params.to);
  const vaultAddress = event.address;

  // Get vault balances
  const fromVaultBalance = getOrCreateVaultBalance(vaultAddress, fromAccount);
  const toVaultBalance = getOrCreateVaultBalance(vaultAddress, toAccount);

  // Store old balances
  const oldFromBalance = fromVaultBalance.balance;
  const oldToBalance = toVaultBalance.balance;

  // Check if transfer is from approved source
  const fromIsApprovedSource = isApprovedSource(event.params.from);

  // Detect LP operations (these have side effects: creating entities, updating LP balances)
  const isLpDeposit = handleLiquidityAdd(event, event.address);
  let lpWithdrawDeduction = BigInt.zero();
  if (fromIsApprovedSource) {
    lpWithdrawDeduction = handleLiquidityWithdraw(event, event.address);
  }
  const isLpWithdraw = lpWithdrawDeduction.gt(BigInt.zero());

  if (isLpDeposit) {
    // LP deposit: tokens move from wallet to pool — only affects lpBalance
    fromVaultBalance.lpBalance = fromVaultBalance.lpBalance.plus(event.params.value);
  } else if (isLpWithdraw) {
    // LP withdrawal: tokens move from pool to wallet — only affects lpBalance
    toVaultBalance.lpBalance = toVaultBalance.lpBalance.minus(lpWithdrawDeduction);
  } else {
    // Regular transfer: affects boughtCap
    if (fromIsApprovedSource) {
      toVaultBalance.boughtCap = toVaultBalance.boughtCap.plus(event.params.value);
    }
    fromVaultBalance.boughtCap = fromVaultBalance.boughtCap.minus(event.params.value);
  }

  // Derive eligible balance from boughtCap and lpBalance
  fromVaultBalance.balance = eligibleBalance(fromVaultBalance.boughtCap, fromVaultBalance.lpBalance);
  toVaultBalance.balance = eligibleBalance(toVaultBalance.boughtCap, toVaultBalance.lpBalance);

  // Update "to" account's total eligible cy balance
  if (oldToBalance.gt(BigInt.zero())) {
    toAccount.totalCyBalance = toAccount.totalCyBalance.minus(oldToBalance);
  }
  if (toVaultBalance.balance.gt(BigInt.zero())) {
    toAccount.totalCyBalance = toAccount.totalCyBalance.plus(toVaultBalance.balance);
  }

  // Update "from" account's total eligible cy balance
  if (oldFromBalance.gt(BigInt.zero())) {
    fromAccount.totalCyBalance = fromAccount.totalCyBalance.minus(oldFromBalance);
  }
  if (fromVaultBalance.balance.gt(BigInt.zero())) {
    fromAccount.totalCyBalance = fromAccount.totalCyBalance.plus(fromVaultBalance.balance);
  }

  // Save vault balances
  fromVaultBalance.save();
  toVaultBalance.save();

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
  updateTotalsForAccount(fromAccount, vaultAddress, oldFromBalance, fromVaultBalance.balance);
  updateTotalsForAccount(toAccount, vaultAddress, oldToBalance, toVaultBalance.balance);

  // try to take snapshot
  takeSnapshot(event);
}
