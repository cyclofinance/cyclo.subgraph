import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/cysFLR/cysFLR";

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
