import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/templates/CycloVaultTemplate/CycloVault";
import { TransferBatch, TransferSingle } from "../generated/templates/CycloReceiptTemplate/CycloReceipt";

export function createTransferEvent(
  from: Address,
  to: Address,
  value: BigInt,
  tokenAddress: Address
): Transfer {
  let mockEvent = newMockEvent();
  let transferEvent = changetype<Transfer>(mockEvent);

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
  let mockEvent = newMockEvent();
  let transferEvent = changetype<TransferSingle>(mockEvent);

  transferEvent.address = receiptAddress;
  transferEvent.parameters = new Array();

  transferEvent.parameters.push(
    new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("id", ethereum.Value.fromUnsignedBigInt(tokenId))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
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
  let mockEvent = newMockEvent();
  let transferEvent = changetype<TransferBatch>(mockEvent);

  transferEvent.address = receiptAddress;
  transferEvent.parameters = new Array();

  transferEvent.parameters.push(
    new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("ids", ethereum.Value.fromUnsignedBigIntArray(tokenIds))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("values", ethereum.Value.fromUnsignedBigIntArray(values))
  );

  return transferEvent;
}
