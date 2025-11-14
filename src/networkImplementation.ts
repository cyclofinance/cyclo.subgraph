import { Address } from "@graphprotocol/graph-ts";

export class NetworkImplementation {
    // Cy token addresses by network
    public cysFLRAddress: string = "";
    public cyWETHAddress: string = "";
    public cyFXRPAddress: string = "";
    public cyWBTCAddress: string = "";
    public cycbBTCAddress: string = "";
    public cyLINKAddress: string = "";
    public cyDOTAddress: string = "";
    public cyUNIAddress: string = "";
    public cyPEPEAddress: string = "";
    public cyENAAddress: string = "";
    public cyARBAddress: string = "";
    public cywstETHAddress: string = "";
    
    // Receipt addresses by network
    public cysFLRReceiptAddress: Address = Address.zero();
    public cyWETHReceiptAddress: Address = Address.zero();
    public cyFXRPReceiptAddress: Address = Address.zero();
    public cyWBTCReceiptAddress: Address = Address.zero();
    public cycbBTCReceiptAddress: Address = Address.zero();
    public cyLINKReceiptAddress: Address = Address.zero();
    public cyDOTReceiptAddress: Address = Address.zero();
    public cyUNIReceiptAddress: Address = Address.zero();
    public cyPEPEReceiptAddress: Address = Address.zero();
    public cyENAReceiptAddress: Address = Address.zero();
    public cyARBReceiptAddress: Address = Address.zero();
    public cywstETHReceiptAddress: Address = Address.zero();
    
    constructor(network: string) {
      if (network == 'flare') {
        this.setAddressesForFlare();
      } else if (network == 'arbitrum-one') {
        this.setAddressesForArbitrum();
      } else {
        this.setAddressesForFlare();
      }
    }
    
    private setAddressesForFlare(): void {
      this.cysFLRAddress = "0x19831cfB53A0dbeAD9866C43557C1D48DfF76567".toLowerCase();
      this.cyWETHAddress = "0xd8BF1d2720E9fFD01a2F9A2eFc3E101a05B852b4".toLowerCase();
      this.cyFXRPAddress = "0xF23595Ede14b54817397B1dAb899bA061BdCe7b5".toLowerCase();
      this.cyWBTCAddress = "0x229917ac2842Eaab42060a1A9213CA78e01b572a".toLowerCase();
      this.cycbBTCAddress = "0x9fC9dA918552df0DAd6C00051351e335656da100".toLowerCase();
      this.cyLINKAddress = "0x715aa5f9A5b3C2b51c432C9028C8692029BCE609".toLowerCase();
      this.cyDOTAddress = "0xEE6a7019679f96CED1Ea861Aae0c88D4481c7226".toLowerCase();
      this.cyUNIAddress = "0x7Cad3F864639738f9cC25952433cd844c07D16a4".toLowerCase();
      this.cyPEPEAddress = "0x4DD4230F3B4d6118D905eD0B6f5f20A3b2472166".toLowerCase();
      this.cyENAAddress = "0x5D938CAf878BD56ACcF2B27Fad9F697aA206dF40".toLowerCase();
      this.cyARBAddress = "0xc83563177290bdd391DB56553Ed828413b7689bc".toLowerCase();
      this.cywstETHAddress = "0xC43ee790dc819dB728e2c5bB6285359BBdE7E016".toLowerCase();
      
      this.cysFLRReceiptAddress = Address.fromString("0xd387FC43E19a63036d8FCeD559E81f5dDeF7ef09");
      this.cyWETHReceiptAddress = Address.fromString("0xBE2615A0fcB54A49A1eB472be30d992599FE0968");
      this.cyFXRPReceiptAddress = Address.fromString("0xC46600cEbD84Ed2FE60Ec525dF13E341D24642f2");
      this.cyWBTCReceiptAddress = Address.fromString("0x922A293D4d0af30D67A51e5510a487916a2bb494");
      this.cycbBTCReceiptAddress = Address.fromString("0x3a5eDe5AE4EC55F61c4aFf2CDfC920b5029Abf05");
      this.cyLINKReceiptAddress = Address.fromString("0xDF66e921C8C29e1b1CA729848790A4D0bd6cbde9");
      this.cyDOTReceiptAddress = Address.fromString("0x3B22b5cE7F9901fe6a676E57E079873775aAA331");
      this.cyUNIReceiptAddress = Address.fromString("0xBF979c720c730738e25D766748F7063f223F1d27");
      this.cyPEPEReceiptAddress = Address.fromString("0xdb2C91313aAAaE40aedf6E91a1E78443241a64c0");
      this.cyENAReceiptAddress = Address.fromString("0x7426ddC75b522e40552ea24D647898fAcE0E2360");
      this.cyARBReceiptAddress = Address.fromString("0x3fEe841c184dCF93f15CD28144b6E5514fFfC18e");
      this.cywstETHReceiptAddress = Address.fromString("0x8C1843A9f3278C94f6d79cebA9828596F524E898");
    }
    
    private setAddressesForArbitrum(): void {
      this.cysFLRAddress = "0x19831cfB53A0dbeAD9866C43557C1D48DfF76567".toLowerCase();
      this.cyWETHAddress = "0x28C7747D7eA25ED3dDCd075c6CCC3634313a0F59".toLowerCase();
      this.cyFXRPAddress = "0xF23595Ede14b54817397B1dAb899bA061BdCe7b5".toLowerCase();
      this.cyWBTCAddress = "0x229917ac2842Eaab42060a1A9213CA78e01b572a".toLowerCase();
      this.cycbBTCAddress = "0x9fC9dA918552df0DAd6C00051351e335656da100".toLowerCase();
      this.cyLINKAddress = "0x715aa5f9A5b3C2b51c432C9028C8692029BCE609".toLowerCase();
      this.cyDOTAddress = "0xEE6a7019679f96CED1Ea861Aae0c88D4481c7226".toLowerCase();
      this.cyUNIAddress = "0x7Cad3F864639738f9cC25952433cd844c07D16a4".toLowerCase();
      this.cyPEPEAddress = "0x4DD4230F3B4d6118D905eD0B6f5f20A3b2472166".toLowerCase();
      this.cyENAAddress = "0x5D938CAf878BD56ACcF2B27Fad9F697aA206dF40".toLowerCase();
      this.cyARBAddress = "0xc83563177290bdd391DB56553Ed828413b7689bc".toLowerCase();
      this.cywstETHAddress = "0xC43ee790dc819dB728e2c5bB6285359BBdE7E016".toLowerCase();
      
      this.cysFLRReceiptAddress = Address.fromString("0xd387FC43E19a63036d8FCeD559E81f5dDeF7ef09");
      this.cyWETHReceiptAddress = Address.fromString("0x0E67a81B967c189Cf50353B0fE6fef572dC55319");
      this.cyFXRPReceiptAddress = Address.fromString("0xC46600cEbD84Ed2FE60Ec525dF13E341D24642f2");
      this.cyWBTCReceiptAddress = Address.fromString("0x922A293D4d0af30D67A51e5510a487916a2bb494");
      this.cycbBTCReceiptAddress = Address.fromString("0x3a5eDe5AE4EC55F61c4aFf2CDfC920b5029Abf05");
      this.cyLINKReceiptAddress = Address.fromString("0xDF66e921C8C29e1b1CA729848790A4D0bd6cbde9");
      this.cyDOTReceiptAddress = Address.fromString("0x3B22b5cE7F9901fe6a676E57E079873775aAA331");
      this.cyUNIReceiptAddress = Address.fromString("0xBF979c720c730738e25D766748F7063f223F1d27");
      this.cyPEPEReceiptAddress = Address.fromString("0xdb2C91313aAAaE40aedf6E91a1E78443241a64c0");
      this.cyENAReceiptAddress = Address.fromString("0x7426ddC75b522e40552ea24D647898fAcE0E2360");
      this.cyARBReceiptAddress = Address.fromString("0x3fEe841c184dCF93f15CD28144b6E5514fFfC18e");
      this.cywstETHReceiptAddress = Address.fromString("0x8C1843A9f3278C94f6d79cebA9828596F524E898");
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
    
    public getCyLINKAddress(): string {
      return this.cyLINKAddress;
    }
    
    public getCyDOTAddress(): string {
      return this.cyDOTAddress;
    }
    
    public getCyUNIAddress(): string {
      return this.cyUNIAddress;
    }
    
    public getCyPEPEAddress(): string {
      return this.cyPEPEAddress;
    }
    
    public getCyENAAddress(): string {
      return this.cyENAAddress;
    }
    
    public getCyARBAddress(): string {
      return this.cyARBAddress;
    }
    
    public getCywstETHAddress(): string {
      return this.cywstETHAddress;
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
    
    public getCyLINKReceiptAddress(): Address {
      return this.cyLINKReceiptAddress;
    }
    
    public getCyDOTReceiptAddress(): Address {
      return this.cyDOTReceiptAddress;
    }
    
    public getCyUNIReceiptAddress(): Address {
      return this.cyUNIReceiptAddress;
    }
    
    public getCyPEPEReceiptAddress(): Address {
      return this.cyPEPEReceiptAddress;
    }
    
    public getCyENAReceiptAddress(): Address {
      return this.cyENAReceiptAddress;
    }
    
    public getCyARBReceiptAddress(): Address {
      return this.cyARBReceiptAddress;
    }
    
    public getCywstETHReceiptAddress(): Address {
      return this.cywstETHReceiptAddress;
    }
  }