import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import {
  // Approval as ApprovalEvent,
  // Deposit as DepositEvent,
  // ERC20PriceOracleReceiptVaultInitialized as ERC20PriceOracleReceiptVaultInitializedEvent,
  // Initialized as InitializedEvent,
  // ReceiptVaultInformation as ReceiptVaultInformationEvent,
  // Snapshot as SnapshotEvent,
  Transfer as TransferEvent,
  // Withdraw as WithdrawEvent,
} from "../generated/cysFLR/cysFLR";
import {
  Account,
  // Approval,
  // Deposit,
  // ERC20PriceOracleReceiptVaultInitialized,
  // Initialized,
  // ReceiptVaultInformation,
  // Snapshot,
  Transfer,
  // Withdraw,
  TrackingPeriod,
  TrackingPeriodForAccount,
} from "../generated/schema";
import { factory } from "../generated/cysFLR/factory";

const REWARDS_SOURCES = [
  Address.fromString("0xcee8cd002f151a536394e564b84076c41bbbcd4d"), // orderbook
];

const FACTORIES = [
  Address.fromString("0x16b619B04c961E8f4F06C10B42FDAbb328980A89"), // Sparkdex V2
  Address.fromString("0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652"), // Sparkdex V3
  Address.fromString("0x440602f459D7Dd500a74528003e6A20A46d6e2A6"), // Blazeswap
];

const JAN_2_END = BigInt.fromI32(1735776000);
const FEB_1_END = BigInt.fromI32(1738368000);
const MAR_3_END = BigInt.fromI32(1740960000);
const APR_2_END = BigInt.fromI32(1743552000);
const MAY_2_END = BigInt.fromI32(1746144000);

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

function getOrInitAccount(address: Address): Bytes {
  let account = Account.load(address);
  if (!account) {
    account = new Account(address);
    account.address = address;
    account.save();
  }
  return address;
}

function idFromTimestampAndAddress(period: string, address: Address): Bytes {
  return Bytes.fromUTF8(period).concat(address);
}

function getPeriodFromTimestamp(timestamp: BigInt): string {
  if (timestamp.lt(JAN_2_END)) {
    return "JAN_2";
  } else if (timestamp.lt(FEB_1_END)) {
    return "FEB_1";
  } else if (timestamp.lt(MAR_3_END)) {
    return "MAR_3";
  } else if (timestamp.lt(APR_2_END)) {
    return "APR_2";
  } else {
    return "MAY_2";
  }
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

// export function handleApproval(event: ApprovalEvent): void {
//   let entity = new Approval(
//     event.transaction.hash.concatI32(event.logIndex.toI32())
//   );
//   entity.owner = event.params.owner;
//   entity.spender = event.params.spender;
//   entity.value = event.params.value;

//   entity.blockNumber = event.block.number;
//   entity.blockTimestamp = event.block.timestamp;
//   entity.transactionHash = event.transaction.hash;

//   entity.save();
// }

// export function handleDeposit(event: DepositEvent): void {
//   let entity = new Deposit(
//     event.transaction.hash.concatI32(event.logIndex.toI32())
//   );
//   entity.sender = event.params.sender;
//   entity.owner = event.params.owner;
//   entity.assets = event.params.assets;
//   entity.shares = event.params.shares;
//   entity.cysFLR_id = event.params.id;
//   entity.receiptInformation = event.params.receiptInformation;

//   entity.blockNumber = event.block.number;
//   entity.blockTimestamp = event.block.timestamp;
//   entity.transactionHash = event.transaction.hash;

//   entity.save();
// }

// export function handleERC20PriceOracleReceiptVaultInitialized(
//   event: ERC20PriceOracleReceiptVaultInitializedEvent
// ): void {
//   let entity = new ERC20PriceOracleReceiptVaultInitialized(
//     event.transaction.hash.concatI32(event.logIndex.toI32())
//   );
//   entity.sender = event.params.sender;
//   entity.config_priceOracle = event.params.config.priceOracle;
//   entity.config_receiptVaultConfig_receipt =
//     event.params.config.receiptVaultConfig.receipt;
//   entity.config_receiptVaultConfig_vaultConfig_asset =
//     event.params.config.receiptVaultConfig.vaultConfig.asset;
//   entity.config_receiptVaultConfig_vaultConfig_name =
//     event.params.config.receiptVaultConfig.vaultConfig.name;
//   entity.config_receiptVaultConfig_vaultConfig_symbol =
//     event.params.config.receiptVaultConfig.vaultConfig.symbol;

//   entity.blockNumber = event.block.number;
//   entity.blockTimestamp = event.block.timestamp;
//   entity.transactionHash = event.transaction.hash;

//   entity.save();
// }

// export function handleInitialized(event: InitializedEvent): void {
//   let entity = new Initialized(
//     event.transaction.hash.concatI32(event.logIndex.toI32())
//   );
//   entity.version = event.params.version;

//   entity.blockNumber = event.block.number;
//   entity.blockTimestamp = event.block.timestamp;
//   entity.transactionHash = event.transaction.hash;

//   entity.save();
// }

// export function handleReceiptVaultInformation(
//   event: ReceiptVaultInformationEvent
// ): void {
//   let entity = new ReceiptVaultInformation(
//     event.transaction.hash.concatI32(event.logIndex.toI32())
//   );
//   entity.sender = event.params.sender;
//   entity.vaultInformation = event.params.vaultInformation;

//   entity.blockNumber = event.block.number;
//   entity.blockTimestamp = event.block.timestamp;
//   entity.transactionHash = event.transaction.hash;

//   entity.save();
// }

// export function handleSnapshot(event: SnapshotEvent): void {
//   let entity = new Snapshot(
//     event.transaction.hash.concatI32(event.logIndex.toI32())
//   );
//   entity.cysFLR_id = event.params.id;

//   entity.blockNumber = event.block.number;
//   entity.blockTimestamp = event.block.timestamp;
//   entity.transactionHash = event.transaction.hash;

//   entity.save();
// }

// export function handleWithdraw(event: WithdrawEvent): void {
//   let entity = new Withdraw(
//     event.transaction.hash.concatI32(event.logIndex.toI32())
//   );
//   entity.sender = event.params.sender;
//   entity.receiver = event.params.receiver;
//   entity.owner = event.params.owner;
//   entity.assets = event.params.assets;
//   entity.shares = event.params.shares;
//   entity.cysFLR_id = event.params.id;
//   entity.receiptInformation = event.params.receiptInformation;

//   entity.blockNumber = event.block.number;
//   entity.blockTimestamp = event.block.timestamp;
//   entity.transactionHash = event.transaction.hash;

//   entity.save();
// }
