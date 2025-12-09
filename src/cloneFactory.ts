import { BigInt, log } from "@graphprotocol/graph-ts";
import {
  NewClone,
} from "../generated/CloneFactory/CloneFactory";
import {
  CycloVault,
  CycloReceipt
} from "../generated/schema";
import { CycloVaultTemplate, CycloReceiptTemplate } from "../generated/templates";
import { cloneFactoryImplementation } from "./cloneFactoryImplementation";
import { dataSource } from "@graphprotocol/graph-ts";

export function handleNewClone(event: NewClone): void {  
  // Normalize the implementation address to lowercase for comparison
  let implementationAddress = event.params.implementation.toHex().toLowerCase();
  let cloneAddress = event.params.clone.toHex().toLowerCase();
  let network = dataSource.network();
  let txHash = event.transaction.hash.toHex();
  let logIndex = event.logIndex.toString();

  log.info("handleNewClone called: network={}, txHash={}, logIndex={}, implementation={}, clone={}, sender={}", [
    network,
    txHash,
    logIndex,
    implementationAddress,
    cloneAddress,
    event.params.sender.toHex().toLowerCase()
  ]);

  // Check receipt implementation first
  if (cloneFactoryImplementation.isCycloTokenReceiptImplementation(event.params.implementation)) {
    log.info("Matched receipt implementation: implementation={}, clone={}", [
      implementationAddress,
      cloneAddress
    ]);
    
    // Handle as a receipt
    let receipt = new CycloReceipt(event.params.clone);
    receipt.address = event.params.clone;
    receipt.deployBlock = event.block.number;
    receipt.deployTimestamp = event.block.timestamp;
    receipt.deployer = event.params.sender;
    receipt.save();
  
    CycloReceiptTemplate.create(event.params.clone);
    log.info("Created CycloReceipt entity: clone={}", [cloneAddress]);
    return;
  }
  
  // Check vault implementation
  if (cloneFactoryImplementation.isCycloTokenImplementation(event.params.implementation)) {
    log.info("Matched vault implementation: implementation={}, clone={}", [
      implementationAddress,
      cloneAddress
    ]);
    
    // Handle as a vault
    let vault = new CycloVault(event.params.clone);
    vault.address = event.params.clone;
    vault.deployBlock = event.block.number;
    vault.deployTimestamp = event.block.timestamp;
    vault.deployer = event.params.sender;
    vault.totalEligible = BigInt.fromI32(0);
    vault.save();
  
    CycloVaultTemplate.create(event.params.clone);
    log.info("Created CycloVault entity: clone={}", [cloneAddress]);
    return;
  }
  
  // If we reach here, the implementation address didn't match any known addresses
  log.warning("Unknown implementation address: network={}, implementation={}, clone={}", [
    network,
    implementationAddress,
    cloneAddress
  ]);
  
  // This could mean:
  // 1. The implementation address is not in the list
  // 2. The network name doesn't match (check dataSource.network())
  // 3. There's a typo in the implementation addresses
  // 
  // For now, we silently ignore unknown implementations
  // If you want to track ALL clones regardless of implementation, uncomment below:
  //
  // // Fallback: create as vault for any unknown implementation
  // let vault = new CycloVault(event.params.clone);
  // vault.address = event.params.clone;
  // vault.deployBlock = event.block.number;
  // vault.deployTimestamp = event.block.timestamp;
  // vault.deployer = event.params.sender;
  // vault.totalEligible = BigInt.fromI32(0);
  // vault.save();
  // CycloVaultTemplate.create(event.params.clone);
}
