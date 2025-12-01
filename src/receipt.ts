import { getOrCreateAccount } from "./common";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { TransferSingle, TransferBatch } from "../generated/templates/CycloReceiptTemplate/CycloReceipt";
import { ReceiptOwnerBalance, CycloReceipt } from "../generated/schema";

// create a unique ID for the receipt owner balance entity
export function createReceiptOwnerBalanceId(receiptAddress: Address, tokenId: BigInt, owner: Bytes): Bytes {
  // Convert BigInt to Bytes via hex string
  // BigInt.toHexString() returns hex with '0x' prefix, pad to 32 bytes (64 hex chars)
  let tokenIdHex = tokenId.toHexString();
  // Remove '0x' prefix
  let hexWithoutPrefix = tokenIdHex.slice(2);
  // Pad to 64 hex characters (32 bytes)
  while (hexWithoutPrefix.length < 64) {
    hexWithoutPrefix = "0" + hexWithoutPrefix;
  }
  const tokenIdBytes = Bytes.fromHexString("0x" + hexWithoutPrefix);
  return receiptAddress.concat(tokenIdBytes).concat(owner);
}

// Get or create CycloReceipt entity
function getOrCreateCycloReceipt(receiptAddress: Address): CycloReceipt {
  let receipt = CycloReceipt.load(receiptAddress);
  if (!receipt) {
    // If receipt doesn't exist, it should have been created by cloneFactory
    // But in case it wasn't, create it with minimal info
    receipt = new CycloReceipt(receiptAddress);
    receipt.address = receiptAddress;
    receipt.deployBlock = BigInt.fromI32(0);
    receipt.deployTimestamp = BigInt.fromI32(0);
    receipt.deployer = Address.zero();
    receipt.save();
  }
  return receipt;
}

// Get or create a generic ReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalance(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): ReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = ReceiptOwnerBalance.load(id);
  if (!item) {
    const receipt = getOrCreateCycloReceipt(receiptAddress);
    item = new ReceiptOwnerBalance(id);
    item.receipt = receipt.id;
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Handle balance changes for receipt tokens
export function handleBalanceChange(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes,
  amountChange: BigInt
): void {
  const item = getOrCreateReceiptOwnerBalance(
    receiptAddress,
    tokenId,
    owner
  );
  item.balance = item.balance.plus(amountChange);
  item.save();
}

// Single transfer handler
export function handleReceiptTransferSingle(event: TransferSingle): void {
  const fromAccount = getOrCreateAccount(event.params.from);
  const toAccount = getOrCreateAccount(event.params.to);

  handleBalanceChange(
    event.address,
    event.params.id,
    fromAccount.id,
    event.params.value.neg()
  );
  handleBalanceChange(
    event.address,
    event.params.id,
    toAccount.id,
    event.params.value
  );
}

// Batch transfer handler
export function handleReceiptTransferBatch(event: TransferBatch): void {
  const fromAccount = getOrCreateAccount(event.params.from);
  const toAccount = getOrCreateAccount(event.params.to);

  for (let i = 0; i < event.params.ids.length; i++) {
    const tokenId = event.params.ids[i];
    const value = event.params.values[i];

    handleBalanceChange(
      event.address,
      tokenId,
      fromAccount.id,
      value.neg()
    );
    handleBalanceChange(
      event.address,
      tokenId,
      toAccount.id,
      value
    );
  }
}
