import { Address, BigInt, BigDecimal, Bytes, dataSource } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/templates/CycloVaultTemplate/CycloVault";
import { Account, Transfer, EligibleTotals, VaultBalance, CycloVault } from "../generated/schema";
import { factory } from "../generated/templates/CycloVaultTemplate/factory";
import { getOrCreateAccount } from "./common";

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

// Get or create CycloVault entity
function getOrCreateCycloVault(vaultAddress: Address): CycloVault {
  let vault = CycloVault.load(vaultAddress);
  if (!vault) {
    // If vault doesn't exist, it should have been created by cloneFactory
    // But in case it wasn't, create it with minimal info
    vault = new CycloVault(vaultAddress);
    vault.address = vaultAddress;
    vault.deployBlock = BigInt.fromI32(0);
    vault.deployTimestamp = BigInt.fromI32(0);
    vault.deployer = Address.zero();
    vault.totalEligible = BigInt.fromI32(0);
    vault.save();
  }
  return vault;
}

// Create a unique ID for the vault balance entity
function createVaultBalanceId(vaultAddress: Address, owner: Bytes): Bytes {
  return vaultAddress.concat(owner);
}

// Get or create a VaultBalance entity
function getOrCreateVaultBalance(
  vaultAddress: Address,
  owner: Bytes
): VaultBalance {
  const id = createVaultBalanceId(vaultAddress, owner);
  let vaultBalance = VaultBalance.load(id);
  if (!vaultBalance) {
    const vault = getOrCreateCycloVault(vaultAddress);
    vaultBalance = new VaultBalance(id);
    vaultBalance.vault = vault.id;
    vaultBalance.owner = owner;
    vaultBalance.balance = BigInt.zero();
    vaultBalance.save();
  }
  return vaultBalance;
}

// Get vault balance for an account (returns 0 if doesn't exist)
function getVaultBalanceForAccount(
  vaultAddress: Address,
  account: Account
): BigInt {
  const id = createVaultBalanceId(vaultAddress, account.id);
  const vaultBalance = VaultBalance.load(id);
  if (!vaultBalance) {
    return BigInt.zero();
  }
  return vaultBalance.balance;
}

// Calculate total positive balance across all vaults for an account
function calculateTotalPositiveBalance(account: Account): BigInt {
  // Note: In AssemblyScript/The Graph, we can't easily iterate over derived fields
  // So we'll calculate this in updateTotalsForAccount by summing vault balances
  // For now, we'll use account.totalCyBalance which is updated elsewhere
  return account.totalCyBalance;
}

function calculateEligibleShare(
  account: Account,
  totals: EligibleTotals
): BigDecimal {
  // Use the totalCyBalance which is calculated from vault balances
  const positiveTotal = calculateTotalPositiveBalance(account);
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
    totals.totalEligibleSum = BigInt.fromI32(0);
    totals.save();
  }
  return totals;
}

function updateTotalsForAccount(
  account: Account,
  vaultAddress: Address,
  oldBalance: BigInt,
  newBalance: BigInt
): void {
  const totals = getOrCreateTotals();
  const vault = getOrCreateCycloVault(vaultAddress);
  
  // Update vault's totalEligible based on balance changes
  // Only count positive balances as eligible
  if (oldBalance.gt(BigInt.fromI32(0))) {
    vault.totalEligible = vault.totalEligible.minus(oldBalance);
  }
  if (newBalance.gt(BigInt.fromI32(0))) {
    vault.totalEligible = vault.totalEligible.plus(newBalance);
  }
  vault.save();
  
  // Update totalEligibleSum directly based on balance changes
  // Only count positive balances as eligible
  if (oldBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleSum = totals.totalEligibleSum.minus(oldBalance);
  }
  if (newBalance.gt(BigInt.fromI32(0))) {
    totals.totalEligibleSum = totals.totalEligibleSum.plus(newBalance);
  }
  totals.save();

  // Calculate and update account's total positive balance
  // We need to sum all positive vault balances for this account
  // Since we can't easily iterate over derived fields in AssemblyScript,
  // we'll calculate it by checking all known vault addresses
  // In a truly generic system, you'd need to query all VaultBalance entities
  // For now, we'll update it based on the current vault change
  let totalPositive = account.totalCyBalance;
  
  // Adjust for the balance change in this vault
  if (oldBalance.gt(BigInt.fromI32(0))) {
    totalPositive = totalPositive.minus(oldBalance);
  }
  if (newBalance.gt(BigInt.fromI32(0))) {
    totalPositive = totalPositive.plus(newBalance);
  }
  
  account.totalCyBalance = totalPositive;

  // Update account's share
  account.eligibleShare = calculateEligibleShare(account, totals);
  account.save();
}

export function handleTransfer(event: TransferEvent): void {
  const fromAccount = getOrCreateAccount(event.params.from);
  const toAccount = getOrCreateAccount(event.params.to);

  const vaultAddress = event.address;
  
  // Get old balances for totals calculation
  const oldFromBalance = getVaultBalanceForAccount(vaultAddress, fromAccount);
  const oldToBalance = getVaultBalanceForAccount(vaultAddress, toAccount);

  // Check if transfer is from approved source
  const fromIsApprovedSource = isApprovedSource(event.params.from);

  // Get or create vault balances
  const fromVaultBalance = getOrCreateVaultBalance(vaultAddress, fromAccount.id);
  const toVaultBalance = getOrCreateVaultBalance(vaultAddress, toAccount.id);

  // Update balances
  // Always subtract from sender
  fromVaultBalance.balance = fromVaultBalance.balance.minus(event.params.value);
  fromVaultBalance.save();

  // Only add to receiver if from approved source
  if (fromIsApprovedSource) {
    toVaultBalance.balance = toVaultBalance.balance.plus(event.params.value);
    toVaultBalance.save();
  }

  // Get new balances
  const newFromBalance = fromVaultBalance.balance;
  const newToBalance = toVaultBalance.balance;

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
    vaultAddress,
    oldFromBalance,
    newFromBalance
  );
  updateTotalsForAccount(
    toAccount,
    vaultAddress,
    oldToBalance,
    newToBalance
  );
}
