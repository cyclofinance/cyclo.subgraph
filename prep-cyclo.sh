#!/bin/bash
set -e

# Initialize and update the cyclo submodule
echo "Initializing cyclo submodule..."
git submodule update --init --recursive

# Build the contracts
echo "Building contracts..."
nix develop -c bash -c '(cd lib/cyclo.sol && rainix-sol-prelude)'
nix develop -c bash -c '(cd lib/rain.factory && rainix-sol-prelude)'



