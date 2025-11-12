#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get network from command line argument
const network = process.argv[2];

if (!network) {
  console.error('Error: Network name is required');
  console.error('Usage: node scripts/update-addresses.js <network>');
  process.exit(1);
}

// Read networks.json
const networksPath = path.join(__dirname, '..', 'networks.json');
const networks = JSON.parse(fs.readFileSync(networksPath, 'utf8'));

if (!networks[network]) {
  console.error(`Error: Network "${network}" not found in networks.json`);
  console.error(`Available networks: ${Object.keys(networks).join(', ')}`);
  process.exit(1);
}

const networkConfig = networks[network];

// Validate required addresses
const requiredAddresses = [
  'cysFLR',
  'cyWETH',
  'cyFXRP',
  'cysFLRReceipt',
  'cyWETHReceipt',
  'cyFXRPReceipt'
];

for (const key of requiredAddresses) {
  if (!networkConfig[key] || !networkConfig[key].address) {
    console.error(`Error: Missing address for ${key} in network "${network}"`);
    process.exit(1);
  }
}

// Update src/cys-flr.ts
const cysFlrPath = path.join(__dirname, '..', 'src', 'cys-flr.ts');
let cysFlrContent = fs.readFileSync(cysFlrPath, 'utf8');

// Replace token addresses (they use .toLowerCase())
cysFlrContent = cysFlrContent.replace(
  /const CYSFLR_ADDRESS\s*=\s*"[^"]*"\.toLowerCase\(\);/,
  `const CYSFLR_ADDRESS = "${networkConfig.cysFLR.address}".toLowerCase();`
);

cysFlrContent = cysFlrContent.replace(
  /const CYWETH_ADDRESS\s*=\s*"[^"]*"\.toLowerCase\(\);/,
  `const CYWETH_ADDRESS = "${networkConfig.cyWETH.address}".toLowerCase();`
);

cysFlrContent = cysFlrContent.replace(
  /const CYFXRP_ADDRESS\s*=\s*"[^"]*"\.toLowerCase\(\);/,
  `const CYFXRP_ADDRESS = "${networkConfig.cyFXRP.address}".toLowerCase();`
);

fs.writeFileSync(cysFlrPath, cysFlrContent, 'utf8');
console.log(`✓ Updated addresses in src/cys-flr.ts for network: ${network}`);

// Update src/receipt.ts
const receiptPath = path.join(__dirname, '..', 'src', 'receipt.ts');
let receiptContent = fs.readFileSync(receiptPath, 'utf8');

// Replace receipt addresses (they use Address.fromString)
receiptContent = receiptContent.replace(
  /const CYSFLR_RECEIPT_ADDRESS\s*=\s*Address\.fromString\("[^"]*"\);/,
  `const CYSFLR_RECEIPT_ADDRESS = Address.fromString("${networkConfig.cysFLRReceipt.address}");`
);

receiptContent = receiptContent.replace(
  /const CYWETH_RECEIPT_ADDRESS\s*=\s*Address\.fromString\("[^"]*"\);/,
  `const CYWETH_RECEIPT_ADDRESS = Address.fromString("${networkConfig.cyWETHReceipt.address}");`
);

receiptContent = receiptContent.replace(
  /const CYFXRP_RECEIPT_ADDRESS\s*=\s*Address\.fromString\("[^"]*"\);/,
  `const CYFXRP_RECEIPT_ADDRESS = Address.fromString("${networkConfig.cyFXRPReceipt.address}");`
);

fs.writeFileSync(receiptPath, receiptContent, 'utf8');
console.log(`✓ Updated addresses in src/receipt.ts for network: ${network}`);

console.log(`\n✓ Successfully updated all addresses for network: ${network}`);
