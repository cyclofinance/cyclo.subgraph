import { getOrCreateAccount } from "./common";
import { ReceiptTransfer } from "../generated/schema";
import { TransferSingle, TransferBatch } from "../generated/cyFLRReceipt/receipt";

export function handleReceiptTransferSingle(event: TransferSingle): void {
  const fromAccount = getOrCreateAccount(event.params.from);
  const toAccount = getOrCreateAccount(event.params.to);

  const transfer = new ReceiptTransfer(
    event.transaction.hash
      .concatI32(event.logIndex.toI32())
      .concatI32(0) // Single transfer, so just use 0
  );
  transfer.receiptAddress = event.address;
  transfer.from = fromAccount.id;
  transfer.to = toAccount.id;
  transfer.value = event.params.value;
  transfer.operator = event.params.operator;
  transfer.tokenId = event.params.id;
  transfer.blockNumber = event.block.number;
  transfer.blockTimestamp = event.block.timestamp;
  transfer.transactionHash = event.transaction.hash;

  transfer.save();
}

export function handleReceiptTransferBatch(event: TransferBatch): void {
  const fromAccount = getOrCreateAccount(event.params.from);
  const toAccount = getOrCreateAccount(event.params.to);

  for (let i = 0; i < event.params.ids.length; i++) {
    const transfer = new ReceiptTransfer(
      event.transaction.hash
        .concatI32(event.logIndex.toI32())
        .concatI32(i) // Use index to ensure uniqueness for batch transfers
    );
    transfer.receiptAddress = event.address;
    transfer.from = fromAccount.id;
    transfer.to = toAccount.id;
    transfer.value = event.params.values[i];
    transfer.operator = event.params.operator;
    transfer.tokenId = event.params.ids[i];
    transfer.blockNumber = event.block.number;
    transfer.blockTimestamp = event.block.timestamp;
    transfer.transactionHash = event.transaction.hash;

    transfer.save();
  }
}
