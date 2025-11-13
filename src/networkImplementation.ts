import { Address } from "@graphprotocol/graph-ts";

export class NetworkImplementation {
    // Cy token addresses by network
    public cysFLRAddress: string;
    public cyWETHAddress: string;
    public cyFXRPAddress: string;
    public cyWBTCAddress: string;
    public cycbBTCAddress: string;
    
    // Receipt addresses by network
    public cysFLRReceiptAddress: Address;
    public cyWETHReceiptAddress: Address;
    public cyFXRPReceiptAddress: Address;
    public cyWBTCReceiptAddress: Address;
    public cycbBTCReceiptAddress: Address;
    
    constructor(network: string) {
      // Initialize cy token addresses based on network
      if (network == 'flare') {
        this.cysFLRAddress = "0x19831cfB53A0dbeAD9866C43557C1D48DfF76567".toLowerCase();
        this.cyWETHAddress = "0xd8BF1d2720E9fFD01a2F9A2eFc3E101a05B852b4".toLowerCase();
        this.cyFXRPAddress = "0xF23595Ede14b54817397B1dAb899bA061BdCe7b5".toLowerCase();
        this.cyWBTCAddress = "0x229917ac2842Eaab42060a1A9213CA78e01b572a".toLowerCase();
        this.cycbBTCAddress = "0x9fC9dA918552df0DAd6C00051351e335656da100".toLowerCase();
        
        this.cysFLRReceiptAddress = Address.fromString("0xd387FC43E19a63036d8FCeD559E81f5dDeF7ef09");
        this.cyWETHReceiptAddress = Address.fromString("0xBE2615A0fcB54A49A1eB472be30d992599FE0968");
        this.cyFXRPReceiptAddress = Address.fromString("0xC46600cEbD84Ed2FE60Ec525dF13E341D24642f2");
        this.cyWBTCReceiptAddress = Address.fromString("0x922A293D4d0af30D67A51e5510a487916a2bb494");
        this.cycbBTCReceiptAddress = Address.fromString("0x3a5eDe5AE4EC55F61c4aFf2CDfC920b5029Abf05");
      } else if (network == 'arbitrum-one') {
        this.cysFLRAddress = "0x19831cfB53A0dbeAD9866C43557C1D48DfF76567".toLowerCase();
        this.cyWETHAddress = "0x28C7747D7eA25ED3dDCd075c6CCC3634313a0F59".toLowerCase();
        this.cyFXRPAddress = "0xF23595Ede14b54817397B1dAb899bA061BdCe7b5".toLowerCase();
        this.cyWBTCAddress = "0x229917ac2842Eaab42060a1A9213CA78e01b572a".toLowerCase();
        this.cycbBTCAddress = "0x9fC9dA918552df0DAd6C00051351e335656da100".toLowerCase();
        
        this.cysFLRReceiptAddress = Address.fromString("0xd387FC43E19a63036d8FCeD559E81f5dDeF7ef09");
        this.cyWETHReceiptAddress = Address.fromString("0x0E67a81B967c189Cf50353B0fE6fef572dC55319");
        this.cyFXRPReceiptAddress = Address.fromString("0xC46600cEbD84Ed2FE60Ec525dF13E341D24642f2");
        this.cyWBTCReceiptAddress = Address.fromString("0x922A293D4d0af30D67A51e5510a487916a2bb494");
        this.cycbBTCReceiptAddress = Address.fromString("0x3a5eDe5AE4EC55F61c4aFf2CDfC920b5029Abf05");
      } else {
        // Default to flare addresses if network not recognized
        this.cysFLRAddress = "0x19831cfB53A0dbeAD9866C43557C1D48DfF76567".toLowerCase();
        this.cyWETHAddress = "0xd8BF1d2720E9fFD01a2F9A2eFc3E101a05B852b4".toLowerCase();
        this.cyFXRPAddress = "0xF23595Ede14b54817397B1dAb899bA061BdCe7b5".toLowerCase();
        this.cyWBTCAddress = "0x229917ac2842Eaab42060a1A9213CA78e01b572a".toLowerCase();
        this.cycbBTCAddress = "0x9fC9dA918552df0DAd6C00051351e335656da100".toLowerCase();
        
        this.cysFLRReceiptAddress = Address.fromString("0xd387FC43E19a63036d8FCeD559E81f5dDeF7ef09");
        this.cyWETHReceiptAddress = Address.fromString("0xBE2615A0fcB54A49A1eB472be30d992599FE0968");
        this.cyFXRPReceiptAddress = Address.fromString("0xC46600cEbD84Ed2FE60Ec525dF13E341D24642f2");
        this.cyWBTCReceiptAddress = Address.fromString("0x922A293D4d0af30D67A51e5510a487916a2bb494");
        this.cycbBTCReceiptAddress = Address.fromString("0x3a5eDe5AE4EC55F61c4aFf2CDfC920b5029Abf05");
      }
    }
    
    // Getter methods for cy token addresses
    public getCysFLRAddress(): string {
      return this.cysFLRAddress;
    }
    
    public getCyWETHAddress(): string {
      return this.cyWETHAddress;
    }
    
    public getCyFXRPAddress(): string {
      return this.cyFXRPAddress;
    }
    
    public getCyWBTCAddress(): string {
      return this.cyWBTCAddress;
    }
    
    public getCycbBTCAddress(): string {
      return this.cycbBTCAddress;
    }
    
    // Getter methods for receipt addresses
    public getCysFLRReceiptAddress(): Address {
      return this.cysFLRReceiptAddress;
    }
    
    public getCyWETHReceiptAddress(): Address {
      return this.cyWETHReceiptAddress;
    }
    
    public getCyFXRPReceiptAddress(): Address {
      return this.cyFXRPReceiptAddress;
    }
    
    public getCyWBTCReceiptAddress(): Address {
      return this.cyWBTCReceiptAddress;
    }
    
    public getCycbBTCReceiptAddress(): Address {
      return this.cycbBTCReceiptAddress;
    }
  }