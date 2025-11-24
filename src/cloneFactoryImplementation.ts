export const FLARE_TOKEN_IMPLEMENTATION_ADDRESS = "0x35ea13bBEfF8115fb63E4164237922E491dd21BC";
export const FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS = "0xd387FC43E19a63036d8FCeD559E81f5dDeF7ef09";

export class CloneFactoryImplementation {
    // Authorizer implementation addresses by network
    public flareTokenImplementation: string[] = [];
    public flareTokenReceiptImplementation: string[] = [];

    constructor(network: string) {
        this.flareTokenImplementation = [];
        this.flareTokenReceiptImplementation = [];

        if (network == 'flare') {
            this.flareTokenImplementation = [FLARE_TOKEN_IMPLEMENTATION_ADDRESS];
            this.flareTokenReceiptImplementation = [FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS];
        } else {
            this.flareTokenImplementation = [];
            this.flareTokenReceiptImplementation = [];
        }
    }

    public isFlareTokenImplementation(address: string): boolean {
        let normalizedAddress = address.toLowerCase();
        for(let i = 0; i < this.flareTokenImplementation.length; i++) {
            if(this.flareTokenImplementation[i].toLowerCase() == normalizedAddress) {
                return true;
            }
        }
        return false;
    }

    public isFlareTokenReceiptImplementation(address: string): boolean {
        let normalizedAddress = address.toLowerCase();
        for(let i = 0; i < this.flareTokenReceiptImplementation.length; i++) {
            if(this.flareTokenReceiptImplementation[i].toLowerCase() == normalizedAddress) {
                return true;
            }
        }
        return false;
    }
}