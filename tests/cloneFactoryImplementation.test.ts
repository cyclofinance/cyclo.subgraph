import { describe, test, assert } from "matchstick-as/assembly/index";
import { Address } from "@graphprotocol/graph-ts";
import { 
  CloneFactoryImplementation, 
  FLARE_TOKEN_IMPLEMENTATION_ADDRESS,
  FLARE_TOKEN_IMPLEMENTATION_ADDRESS_2,
  FLARE_TOKEN_IMPLEMENTATION_ADDRESS_3,
  FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS,
  FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_2,
  FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_3,
  ARBITRUM_ONE_TOKEN_IMPLEMENTATION_ADDRESS,
  ARBITRUM_ONE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS
} from "../src/cloneFactoryImplementation";

describe("CloneFactoryImplementation", () => {
  
  describe("Flare Network", () => {
    test("Should identify all valid token implementations", () => {
      let implementation = new CloneFactoryImplementation("flare");
      
      // Test all known Flare token addresses
      assert.assertTrue(implementation.isCycloTokenImplementation(FLARE_TOKEN_IMPLEMENTATION_ADDRESS));
      assert.assertTrue(implementation.isCycloTokenImplementation(FLARE_TOKEN_IMPLEMENTATION_ADDRESS_2));
      assert.assertTrue(implementation.isCycloTokenImplementation(FLARE_TOKEN_IMPLEMENTATION_ADDRESS_3));

      // Test value equality (critical for ensuring proper address matching)
      let newAddressInstance = Address.fromString(FLARE_TOKEN_IMPLEMENTATION_ADDRESS.toHexString());
      assert.assertTrue(implementation.isCycloTokenImplementation(newAddressInstance));
    });

    test("Should identify all valid receipt implementations", () => {
      let implementation = new CloneFactoryImplementation("flare");

      // Test all known Flare receipt addresses
      assert.assertTrue(implementation.isCycloTokenReceiptImplementation(FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS));
      assert.assertTrue(implementation.isCycloTokenReceiptImplementation(FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_2));
      assert.assertTrue(implementation.isCycloTokenReceiptImplementation(FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS_3));
      
      // Test value equality
      let newAddressInstance = Address.fromString(FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS.toHexString());
      assert.assertTrue(implementation.isCycloTokenReceiptImplementation(newAddressInstance));
    });

    test("Should reject addresses from other networks", () => {
      let implementation = new CloneFactoryImplementation("flare");
      assert.assertTrue(!implementation.isCycloTokenImplementation(ARBITRUM_ONE_TOKEN_IMPLEMENTATION_ADDRESS));
    });
  });

  describe("Arbitrum One Network", () => {
    test("Should identify valid token implementations (hyphenated)", () => {
      let implementation = new CloneFactoryImplementation("arbitrum-one");
      assert.assertTrue(implementation.isCycloTokenImplementation(ARBITRUM_ONE_TOKEN_IMPLEMENTATION_ADDRESS));
    });

    test("Should identify valid token implementations (underscore)", () => {
      let implementation = new CloneFactoryImplementation("arbitrum_one");
      assert.assertTrue(implementation.isCycloTokenImplementation(ARBITRUM_ONE_TOKEN_IMPLEMENTATION_ADDRESS));
    });

    test("Should identify valid receipt implementations", () => {
      let implementation = new CloneFactoryImplementation("arbitrum-one");
      assert.assertTrue(implementation.isCycloTokenReceiptImplementation(ARBITRUM_ONE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS));
    });

    test("Should reject addresses from other networks", () => {
      let implementation = new CloneFactoryImplementation("arbitrum-one");
      assert.assertTrue(!implementation.isCycloTokenImplementation(FLARE_TOKEN_IMPLEMENTATION_ADDRESS));
    });
  });

  describe("Unknown Network", () => {
    test("Should have no valid implementations", () => {
      let implementation = new CloneFactoryImplementation("unknown-network");
      
      assert.assertTrue(!implementation.isCycloTokenImplementation(FLARE_TOKEN_IMPLEMENTATION_ADDRESS));
      assert.assertTrue(!implementation.isCycloTokenImplementation(ARBITRUM_ONE_TOKEN_IMPLEMENTATION_ADDRESS));
      
      assert.assertTrue(!implementation.isCycloTokenReceiptImplementation(FLARE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS));
      assert.assertTrue(!implementation.isCycloTokenReceiptImplementation(ARBITRUM_ONE_TOKEN_RECEIPT_IMPLEMENTATION_ADDRESS));
    });
  });

  describe("Edge Cases", () => {
    test("Should handle random addresses correctly", () => {
      let implementation = new CloneFactoryImplementation("flare");
      let randomAddress = Address.fromString("0x0000000000000000000000000000000000000000");
      
      assert.assertTrue(!implementation.isCycloTokenImplementation(randomAddress));
      assert.assertTrue(!implementation.isCycloTokenReceiptImplementation(randomAddress));
    });
  });
});
