import {
  NewClone,
} from "../generated/CloneFactory/CloneFactory";
import {
  CycloVault,
  CycloReceipt
} from "../generated/schema";
import { CycloVaultTemplate, CycloReceiptTemplate } from "../generated/templates";
import { CloneFactoryImplementation } from "./cloneFactoryImplementation";
import { dataSource } from "@graphprotocol/graph-ts";

export function handleNewClone(event: NewClone): void {  
  let implementationAddress = event.params.implementation.toHex();

  let cloneFactoryImplementation = new CloneFactoryImplementation(dataSource.network());
  
  if (cloneFactoryImplementation.isFlareTokenReceiptImplementation(implementationAddress)) {
    // Handle as a receipt
    let receipt = new CycloReceipt(event.params.clone);
    receipt.address = event.params.clone;
    receipt.deployBlock = event.block.number;
    receipt.deployTimestamp = event.block.timestamp;
    receipt.deployer = event.params.sender;
    receipt.save();
  
    CycloReceiptTemplate.create(event.params.clone);
  } else if (cloneFactoryImplementation.isFlareTokenImplementation(implementationAddress)) {
    // Handle as a vault
    let vault = new CycloVault(event.params.clone);
    vault.address = event.params.clone;
    vault.deployBlock = event.block.number;
    vault.deployTimestamp = event.block.timestamp;
    vault.deployer = event.params.sender;
    vault.save();
  
    CycloVaultTemplate.create(event.params.clone);
  }
}

