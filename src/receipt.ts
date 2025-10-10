import { getOrCreateAccount } from "./common";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { TransferSingle, TransferBatch } from "../generated/cyFLRReceipt/receipt";
import { CysFlrReceiptOwnerBalance, CyWethReceiptOwnerBalance } from "../generated/schema";

const CYSFLR_RECEIPT_ADDRESS = Address.fromString("0xd387FC43E19a63036d8FCeD559E81f5dDeF7ef09");
const CYWETH_RECEIPT_ADDRESS = Address.fromString("0xBE2615A0fcB54A49A1eB472be30d992599FE0968");

// create a unique ID for the receipt owner balance entity
export function createReceiptOwnerBalanceId(receiptAddress: Address, tokenId: BigInt, owner: Bytes): Bytes {
  return receiptAddress.concat(Bytes.fromByteArray(Bytes.fromBigInt(tokenId))).concat(owner);
}

// Get or create a CysFlrReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCysFlr(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CysFlrReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CysFlrReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CysFlrReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Get or create a CyWethReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCyWeth(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CyWethReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CyWethReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CyWethReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Handle balance changes for receipt tokens based on receipt address
export function handleBalanceChange(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes,
  amountChange: BigInt
): void {
  if (receiptAddress == CYSFLR_RECEIPT_ADDRESS) {
    const item = getOrCreateReceiptOwnerBalanceForCysFlr(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress == CYWETH_RECEIPT_ADDRESS) {
    const item = getOrCreateReceiptOwnerBalanceForCyWeth(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  }
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
