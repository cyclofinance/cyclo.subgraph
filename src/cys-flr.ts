import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/cysFLR/cysFLR";
import {
  Account,
  Transfer,
  TrackingPeriod,
  TrackingPeriodForAccount,
} from "../generated/schema";
import { factory } from "../generated/cysFLR/factory";

const REWARDS_SOURCES = [
  Address.fromString("0xcee8cd002f151a536394e564b84076c41bbbcd4d"), // orderbook
  Address.fromString("0x0f3D8a38D4c74afBebc2c42695642f0e3acb15D3"), // Sparkdex Universal Router
];

const FACTORIES = [
  Address.fromString("0x16b619B04c961E8f4F06C10B42FDAbb328980A89"), // Sparkdex V2
  Address.fromString("0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652"), // Sparkdex V3
  Address.fromString("0x440602f459D7Dd500a74528003e6A20A46d6e2A6"), // Blazeswap
];

export function getOrInitTrackingPeriod(period: string): TrackingPeriod {
  let trackingPeriod = TrackingPeriod.load(Bytes.fromUTF8(period));
  if (!trackingPeriod) {
    trackingPeriod = new TrackingPeriod(Bytes.fromUTF8(period));
    trackingPeriod.period = period;
    trackingPeriod.totalApprovedTransfersIn = BigInt.fromI32(0);
  }
  return trackingPeriod;
}

export function isApprovedSource(address: Address): boolean {
  // first check if the from is a pool from one of the approved factories
  const maybeHasFactory = factory.bind(address);
  const factoryAddress = maybeHasFactory.try_factory();
  if (!factoryAddress.reverted) {
    if (FACTORIES.includes(factoryAddress.value)) {
      return true;
    }
  }

  // or else if the from is directly an approved rewards source
  if (REWARDS_SOURCES.includes(address)) {
    return true;
  }

  return false;
}

export function getOrInitAccount(address: Address): Bytes {
  let account = Account.load(address);
  if (!account) {
    account = new Account(address);
    account.address = address;
    account.save();
  }
  return address;
}

export function idFromTimestampAndAddress(period: string, address: Address): Bytes {
  return Bytes.fromUTF8(period).concat(address);
}

export function getPeriodFromTimestamp(timestamp: BigInt): string {
  return "ALL_TIME";
}

function getOrInitTrackingPeriodForAccount(
  address: Address,
  timestamp: BigInt
): TrackingPeriodForAccount {
  let period = getPeriodFromTimestamp(timestamp);

  const id = idFromTimestampAndAddress(period, address);
  let trackingPeriod = TrackingPeriodForAccount.load(id);

  if (!trackingPeriod) {
    trackingPeriod = new TrackingPeriodForAccount(id);
    trackingPeriod.account = getOrInitAccount(address);
    trackingPeriod.period = period;
    trackingPeriod.culmulativeTransfersInFromApprovedSources =
      BigInt.fromI32(0);
    trackingPeriod.culmulativeTransfersOut = BigInt.fromI32(0);
    trackingPeriod.netApprovedTransfersIn = BigInt.fromI32(0);
  }
  log.info("trackingPeriod: {}", [trackingPeriod.account.toHexString()]);

  return trackingPeriod;
}

export function handleTransfer(event: TransferEvent): void {
  // get to TrackingPeriod
  let toTrackingPeriod = getOrInitTrackingPeriodForAccount(
    event.params.to,
    event.block.timestamp
  );
  // get from TrackingPeriod
  let fromTrackingPeriod = getOrInitTrackingPeriodForAccount(
    event.params.from,
    event.block.timestamp
  );

  const period = getOrInitTrackingPeriod(
    getPeriodFromTimestamp(event.block.timestamp)
  );

  // Track the previous net amounts before updating
  const previousToNet = toTrackingPeriod.netApprovedTransfersIn;
  const previousFromNet = fromTrackingPeriod.netApprovedTransfersIn;

  // is this transfer from an approved source?
  const fromIsApprovedSource = isApprovedSource(event.params.from);

  if (fromIsApprovedSource) {
    toTrackingPeriod.culmulativeTransfersInFromApprovedSources =
      toTrackingPeriod.culmulativeTransfersInFromApprovedSources.plus(
        event.params.value
      );
    toTrackingPeriod.netApprovedTransfersIn =
      toTrackingPeriod.netApprovedTransfersIn.plus(event.params.value);

    let receivingNetAmountChange = BigInt.fromI32(0);

    // Update period total for receiving account
    if (
      previousToNet.le(BigInt.fromI32(0)) &&
      toTrackingPeriod.netApprovedTransfersIn.gt(BigInt.fromI32(0))
    ) {
      // Went from negative/zero to positive - add the new positive amount
      receivingNetAmountChange = toTrackingPeriod.netApprovedTransfersIn;
    } else if (previousToNet.gt(BigInt.fromI32(0))) {
      // Was already positive - add the increase
      receivingNetAmountChange = event.params.value;
    }

    period.totalApprovedTransfersIn = period.totalApprovedTransfersIn.plus(
      receivingNetAmountChange
    );
  }

  // Update sending account
  fromTrackingPeriod.culmulativeTransfersOut =
    fromTrackingPeriod.culmulativeTransfersOut.plus(event.params.value);
  fromTrackingPeriod.netApprovedTransfersIn =
    fromTrackingPeriod.netApprovedTransfersIn.minus(event.params.value);

  let sendingNetAmountChange = BigInt.fromI32(0);

  // Update period total for sending account
  if (previousFromNet.gt(BigInt.fromI32(0))) {
    if (fromTrackingPeriod.netApprovedTransfersIn.le(BigInt.fromI32(0))) {
      // Went from positive to negative/zero - subtract the previous positive amount
      sendingNetAmountChange = previousFromNet;
    } else {
      // Decreased but still positive - subtract the difference
      sendingNetAmountChange = event.params.value;
    }
  }

  period.totalApprovedTransfersIn = period.totalApprovedTransfersIn.minus(
    sendingNetAmountChange
  );

  // Save all entities
  period.save();
  toTrackingPeriod.save();
  fromTrackingPeriod.save();

  // Create transfer entity
  let entity = new Transfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.fromIsApprovedSource = fromIsApprovedSource;
  entity.from = fromTrackingPeriod.account;
  entity.to = toTrackingPeriod.account;
  entity.value = event.params.value;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.period = getPeriodFromTimestamp(event.block.timestamp);

  entity.save();
}
