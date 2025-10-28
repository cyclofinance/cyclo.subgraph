import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/cysFLR/cysFLR";
import { TransferBatch, TransferSingle } from "../generated/cysFLRReceipt/receipt";

export function createTransferEvent(
  from: Address,
  to: Address,
  value: BigInt,
  tokenAddress: Address
): Transfer {
  let transferEvent = changetype<Transfer>(newMockEvent());

  transferEvent.address = tokenAddress;
  transferEvent.parameters = new Array();

  transferEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  );

  return transferEvent;
}

export function createReceiptTransferSingleEvent(
  receiptAddress: Address,
  from: Address,
  to: Address,
  operator: Address,
  value: BigInt,
  tokenId: BigInt,
): TransferSingle {
  let transferEvent = changetype<TransferSingle>(newMockEvent());

  transferEvent.address = receiptAddress;
  transferEvent.parameters = new Array();

  transferEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("id", ethereum.Value.fromUnsignedBigInt(tokenId))
  );

  return transferEvent;
}

export function createReceiptTransferBatchEvent(
  receiptAddress: Address,
  from: Address,
  to: Address,
  operator: Address,
  values: Array<BigInt>,
  tokenIds: Array<BigInt>,
): TransferBatch {
  let transferEvent = changetype<TransferBatch>(newMockEvent());

  transferEvent.address = receiptAddress;
  transferEvent.parameters = new Array();

  transferEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("values", ethereum.Value.fromUnsignedBigIntArray(values))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("ids", ethereum.Value.fromUnsignedBigIntArray(tokenIds))
  );

  return transferEvent;
}
