import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt, Bytes, Wrapped } from "@graphprotocol/graph-ts";
import { Transfer as ERC20TransferEvent } from "../generated/templates/CycloVaultTemplate/CycloVault";
import { TransferBatch, TransferSingle } from "../generated/templates/CycloReceiptTemplate/CycloReceipt";
import { Transfer as ERC721TransferEvent } from "../generated/LiquidityV3/LiquidityV3";

export const defaultAddress = Address.fromString("0xA16081F360e3847006dB660bae1c6d1b2e17eC2A");
export const defaultAddressBytes = defaultAddress as Bytes;
export const defaultBigInt = BigInt.fromI32(1);
export const defaultIntBytes = Bytes.fromI32(1);
export const defaultEventDataLogType = "default_log_type";

export function createTransferEvent(
  from: Address,
  to: Address,
  value: BigInt,
  tokenAddress: Address,
  log?: ethereum.Log,
): ERC20TransferEvent {
  let transferEvent = changetype<ERC20TransferEvent>(newMockEvent());

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

  if (log) {
    transferEvent.receipt!.logs = [log]
  }

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

export function createERC721TransferEvent(
  from: Address,
  to: Address,
  tokenId: BigInt,
  tokenAddress: Address,
  log: ethereum.Log,
): ERC721TransferEvent {
  let transferEvent = changetype<ERC721TransferEvent>(newMockEvent());

  transferEvent.address = tokenAddress;
  transferEvent.parameters = new Array();

  transferEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  );
  transferEvent.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromUnsignedBigInt(tokenId))
  );
  transferEvent.receipt!.logs = [log]

  return transferEvent;
}

// mock log to put in receipt
export function mockLog(
  address: Address,
  topic0: string,
  topics: string[],
  value: BigInt
): ethereum.Log {
    return new ethereum.Log(address, [Bytes.fromHexString(topic0), ...topics.map((v) => Bytes.fromHexString(v))],
    ethereum.encode(ethereum.Value.fromUnsignedBigInt(value))!,
    defaultAddressBytes, defaultIntBytes, defaultAddressBytes, defaultBigInt,
    defaultBigInt, defaultBigInt, defaultEventDataLogType, new Wrapped(false));
}
