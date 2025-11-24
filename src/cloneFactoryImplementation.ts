export const ARBITRUM_ONE_TOKEN_IMPLEMENTATION_ADDRESS = "0x934CAD642Ec68A0f33C15DB129a13028Afa616fC";
export const ARBITRUM_ONE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS = "0xfF5d5E89F4Cd37c413716531506CfaE062ab77cB";

export const FLARE_TOKEN_IMPLEMENTATION_ADDRESS = "0x35ea13bBEfF8115fb63E4164237922E491dd21BC";
export const FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS = "0xd387FC43E19a63036d8FCeD559E81f5dDeF7ef09";

export const FLARE_TOKEN_IMPLEMENTATION_ADDRESS_2 = "0x76A064c006B62eb26565B91dB59c62666d291F4d";
export const FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRES_2 = "0x3aCEB4F257c169f9143524FF11092f268294fC7c";

export const FLARE_TOKEN_IMPLEMENTATION_ADDRESS_3 = "0xb04c8ca7127997f8832152112a00cd37dc3f49e9";
export const FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_3 = "0xac2c4d2d2fb38e26064fe7e8e4dc734bdf0add14";

export class CloneFactoryImplementation {
    // Authorizer implementation addresses by network
    public cycloTokenImplementation: string[] = [];
    public cycloTokenReceiptImplementation: string[] = [];

    constructor(network: string) {
        this.cycloTokenImplementation = [];
        this.cycloTokenReceiptImplementation = [];

        if (network == 'flare') {
            this.cycloTokenImplementation = [FLARE_TOKEN_IMPLEMENTATION_ADDRESS, FLARE_TOKEN_IMPLEMENTATION_ADDRESS_2, FLARE_TOKEN_IMPLEMENTATION_ADDRESS_3];
            this.cycloTokenReceiptImplementation = [FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS, FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRES_2, FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_3];
        } else if (network == 'arbitrum-one') {
            this.cycloTokenImplementation = [ARBITRUM_ONE_TOKEN_IMPLEMENTATION_ADDRESS];
            this.cycloTokenReceiptImplementation = [ARBITRUM_ONE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS];
        } {
            this.cycloTokenImplementation = [];
            this.cycloTokenReceiptImplementation = [];
        }
    }

    public isCycloTokenImplementation(address: string): boolean {
        let normalizedAddress = address.toLowerCase();
        for(let i = 0; i < this.cycloTokenImplementation.length; i++) {
            if(this.cycloTokenImplementation[i].toLowerCase() == normalizedAddress) {
                return true;
            }
        }
        return false;
    }

    public isCycloTokenReceiptImplementation(address: string): boolean {
        let normalizedAddress = address.toLowerCase();
        for(let i = 0; i < this.cycloTokenReceiptImplementation.length; i++) {
            if(this.cycloTokenReceiptImplementation[i].toLowerCase() == normalizedAddress) {
                return true;
            }
        }
        return false;
    }
}