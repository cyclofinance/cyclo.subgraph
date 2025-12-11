import { Address, dataSource } from "@graphprotocol/graph-ts";

export const ARBITRUM_ONE_TOKEN_IMPLEMENTATION_ADDRESS = Address.fromString("0x934CAD642Ec68A0f33C15DB129a13028Afa616fC");
export const ARBITRUM_ONE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS = Address.fromString("0xfF5d5E89F4Cd37c413716531506CfaE062ab77cB");

export const FLARE_TOKEN_IMPLEMENTATION_ADDRESS = Address.fromString("0x35ea13bBEfF8115fb63E4164237922E491dd21BC");
export const FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS = Address.fromString("0x901E7A73F7389eA6e32e298353f0239481D8d939");

export const FLARE_TOKEN_IMPLEMENTATION_ADDRESS_2 = Address.fromString("0x76A064c006B62eb26565B91dB59c62666d291F4d");
export const FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_2 = Address.fromString("0x3aCEB4F257c169f9143524FF11092f268294fC7c");

export const FLARE_TOKEN_IMPLEMENTATION_ADDRESS_3 = Address.fromString("0xb04c8ca7127997f8832152112a00cd37dc3f49e9");
export const FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_3 = Address.fromString("0xac2c4d2d2fb38e26064fe7e8e4dc734bdf0add14");

export class CloneFactoryImplementation {
    // Authorizer implementation addresses by network
    public cycloTokenImplementation: Address[] = [];
    public cycloTokenReceiptImplementation: Address[] = [];

    constructor(network: string) {
        this.cycloTokenImplementation = [];
        this.cycloTokenReceiptImplementation = [];

        if (network == 'flare') {
            this.cycloTokenImplementation = [FLARE_TOKEN_IMPLEMENTATION_ADDRESS, FLARE_TOKEN_IMPLEMENTATION_ADDRESS_2, FLARE_TOKEN_IMPLEMENTATION_ADDRESS_3];
            this.cycloTokenReceiptImplementation = [FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS, FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_2, FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_3];
        } else if (network == 'arbitrum-one' || network == 'arbitrum_one') {
            // Support both hyphen and underscore formats
            this.cycloTokenImplementation = [ARBITRUM_ONE_TOKEN_IMPLEMENTATION_ADDRESS];
            this.cycloTokenReceiptImplementation = [ARBITRUM_ONE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS];
        } else {
            this.cycloTokenImplementation = [];
            this.cycloTokenReceiptImplementation = [];
        }
    }

    public isCycloTokenImplementation(normalizedAddress: Address): boolean {
        for (let i = 0; i < this.cycloTokenImplementation.length; i++) {
            if (this.cycloTokenImplementation[i].equals(normalizedAddress)) {
                return true;
            }
        }
        return false;
    }

    public isCycloTokenReceiptImplementation(normalizedAddress: Address): boolean {
        for (let i = 0; i < this.cycloTokenReceiptImplementation.length; i++) {
            if (this.cycloTokenReceiptImplementation[i].equals(normalizedAddress)) {
                return true;
            }
        }
        return false;
    }
}

export const cloneFactoryImplementation = new CloneFactoryImplementation(dataSource.network());
