import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  Approval,
  Deposit,
  ERC20PriceOracleReceiptVaultInitialized,
  Initialized,
  ReceiptVaultInformation,
  Snapshot,
  Transfer,
  Withdraw
} from "../generated/cysFLR/cysFLR"

export function createApprovalEvent(
  owner: Address,
  spender: Address,
  value: BigInt
): Approval {
  let approvalEvent = changetype<Approval>(newMockEvent())

  approvalEvent.parameters = new Array()

  approvalEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  approvalEvent.parameters.push(
    new ethereum.EventParam("spender", ethereum.Value.fromAddress(spender))
  )
  approvalEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )

  return approvalEvent
}

export function createDepositEvent(
  sender: Address,
  owner: Address,
  assets: BigInt,
  shares: BigInt,
  id: BigInt,
  receiptInformation: Bytes
): Deposit {
  let depositEvent = changetype<Deposit>(newMockEvent())

  depositEvent.parameters = new Array()

  depositEvent.parameters.push(
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(assets))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam("id", ethereum.Value.fromUnsignedBigInt(id))
  )
  depositEvent.parameters.push(
    new ethereum.EventParam(
      "receiptInformation",
      ethereum.Value.fromBytes(receiptInformation)
    )
  )

  return depositEvent
}

export function createERC20PriceOracleReceiptVaultInitializedEvent(
  sender: Address,
  config: ethereum.Tuple
): ERC20PriceOracleReceiptVaultInitialized {
  let erc20PriceOracleReceiptVaultInitializedEvent =
    changetype<ERC20PriceOracleReceiptVaultInitialized>(newMockEvent())

  erc20PriceOracleReceiptVaultInitializedEvent.parameters = new Array()

  erc20PriceOracleReceiptVaultInitializedEvent.parameters.push(
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender))
  )
  erc20PriceOracleReceiptVaultInitializedEvent.parameters.push(
    new ethereum.EventParam("config", ethereum.Value.fromTuple(config))
  )

  return erc20PriceOracleReceiptVaultInitializedEvent
}

export function createInitializedEvent(version: i32): Initialized {
  let initializedEvent = changetype<Initialized>(newMockEvent())

  initializedEvent.parameters = new Array()

  initializedEvent.parameters.push(
    new ethereum.EventParam(
      "version",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(version))
    )
  )

  return initializedEvent
}

export function createReceiptVaultInformationEvent(
  sender: Address,
  vaultInformation: Bytes
): ReceiptVaultInformation {
  let receiptVaultInformationEvent = changetype<ReceiptVaultInformation>(
    newMockEvent()
  )

  receiptVaultInformationEvent.parameters = new Array()

  receiptVaultInformationEvent.parameters.push(
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender))
  )
  receiptVaultInformationEvent.parameters.push(
    new ethereum.EventParam(
      "vaultInformation",
      ethereum.Value.fromBytes(vaultInformation)
    )
  )

  return receiptVaultInformationEvent
}

export function createSnapshotEvent(id: BigInt): Snapshot {
  let snapshotEvent = changetype<Snapshot>(newMockEvent())

  snapshotEvent.parameters = new Array()

  snapshotEvent.parameters.push(
    new ethereum.EventParam("id", ethereum.Value.fromUnsignedBigInt(id))
  )

  return snapshotEvent
}

export function createTransferEvent(
  from: Address,
  to: Address,
  value: BigInt
): Transfer {
  let transferEvent = changetype<Transfer>(newMockEvent())

  transferEvent.parameters = new Array()

  transferEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  )
  transferEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  transferEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )

  return transferEvent
}

export function createWithdrawEvent(
  sender: Address,
  receiver: Address,
  owner: Address,
  assets: BigInt,
  shares: BigInt,
  id: BigInt,
  receiptInformation: Bytes
): Withdraw {
  let withdrawEvent = changetype<Withdraw>(newMockEvent())

  withdrawEvent.parameters = new Array()

  withdrawEvent.parameters.push(
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(assets))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam("id", ethereum.Value.fromUnsignedBigInt(id))
  )
  withdrawEvent.parameters.push(
    new ethereum.EventParam(
      "receiptInformation",
      ethereum.Value.fromBytes(receiptInformation)
    )
  )

  return withdrawEvent
}
