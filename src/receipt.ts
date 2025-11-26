import { getOrCreateAccount } from "./common";
import { Address, BigInt, Bytes, dataSource } from "@graphprotocol/graph-ts";
import { TransferSingle, TransferBatch } from "../generated/cysFLRReceipt/receipt";
import { CysFlrReceiptOwnerBalance, CyWethReceiptOwnerBalance, CyFxrpReceiptOwnerBalance, CyWbtcReceiptOwnerBalance, CycbBTCReceiptOwnerBalance, CyLinkReceiptOwnerBalance, CyDotReceiptOwnerBalance, CyUniReceiptOwnerBalance, CyPepeReceiptOwnerBalance, CyEnaReceiptOwnerBalance, CyArbReceiptOwnerBalance, CyWstethReceiptOwnerBalance, CyXAUt0ReceiptOwnerBalance, CyPYTHReceiptOwnerBalance } from "../generated/schema";
import { NetworkImplementation } from "./networkImplementation";

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

// Get or create a CyFxrpReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCyFxrp(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CyFxrpReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CyFxrpReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CyFxrpReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Get or create a CyWbtcReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCyWbtc(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CyWbtcReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CyWbtcReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CyWbtcReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Get or create a CycbBTCReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCycbBTC(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CycbBTCReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CycbBTCReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CycbBTCReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Get or create a CyLinkReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCyLINK(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CyLinkReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CyLinkReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CyLinkReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Get or create a CyDotReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCyDOT(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CyDotReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CyDotReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CyDotReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Get or create a CyUniReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCyUNI(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CyUniReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CyUniReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CyUniReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Get or create a CyPepeReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCyPEPE(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CyPepeReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CyPepeReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CyPepeReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Get or create a CyEnaReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCyENA(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CyEnaReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CyEnaReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CyEnaReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Get or create a CyArbReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCyARB(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CyArbReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CyArbReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CyArbReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Get or create a CyWstethReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCywstETH(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CyWstethReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CyWstethReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CyWstethReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Get or create a CyXAUt0ReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCyXAUt0(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CyXAUt0ReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CyXAUt0ReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CyXAUt0ReceiptOwnerBalance(id);
    item.receiptAddress = receiptAddress;
    item.tokenId = tokenId;
    item.owner = owner;
    item.balance = BigInt.zero();
    item.save();
  }
  return item;
}

// Get or create a CyPYTHReceiptOwnerBalance entity
export function getOrCreateReceiptOwnerBalanceForCyPYTH(
  receiptAddress: Address,
  tokenId: BigInt,
  owner: Bytes
): CyPYTHReceiptOwnerBalance {
  const id = createReceiptOwnerBalanceId(receiptAddress, tokenId, owner);
  let item = CyPYTHReceiptOwnerBalance.load(id);
  if (!item) {
    item = new CyPYTHReceiptOwnerBalance(id);
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
  // Get network implementation to access addresses
  const networkImplementation = new NetworkImplementation(dataSource.network());
  
  if (receiptAddress.equals(networkImplementation.getCysFLRReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCysFlr(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCyWETHReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCyWeth(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCyFXRPReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCyFxrp(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCyWBTCReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCyWbtc(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCycbBTCReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCycbBTC(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCyLINKReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCyLINK(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCyDOTReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCyDOT(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCyUNIReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCyUNI(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCyPEPEReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCyPEPE(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCyENAReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCyENA(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCyARBReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCyARB(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCywstETHReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCywstETH(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCyXAUt0ReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCyXAUt0(
      receiptAddress,
      tokenId,
      owner
    );
    item.balance = item.balance.plus(amountChange);
    item.save();
  } else if (receiptAddress.equals(networkImplementation.getCyPYTHReceiptAddress())) {
    const item = getOrCreateReceiptOwnerBalanceForCyPYTH(
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
