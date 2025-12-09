import { getOrCreateAccount } from "./common";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { TransferSingle, TransferBatch } from "../generated/templates/CycloReceiptTemplate/CycloReceipt";
import { CycloReceipt, ReceiptOwnerBalance } from "../generated/schema";

// create a unique ID for the receipt owner balance entity
export function createReceiptOwnerBalanceId(receiptAddress: Address, tokenId: BigInt, owner: Bytes): Bytes {
  return receiptAddress.concat(Bytes.fromByteArray(Bytes.fromBigInt(tokenId))).concat(owner);
}

// Get or create a ReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalance(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): ReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = ReceiptOwnerBalance.load(id);
  
  if (!item) {
    item = new ReceiptOwnerBalance(id);
    item.receipt = receiptAddress;
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
