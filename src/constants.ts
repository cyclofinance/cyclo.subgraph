import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";

export const ONE18 = BigInt.fromString(`1${"0".repeat(18)}`);
export const ZERO_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000000");

export const TOTALS_ID = "SINGLETON";

export const CYSFLR_ADDRESS =
  "0x19831cfB53A0dbeAD9866C43557C1D48DfF76567".toLowerCase();

export const CYWETH_ADDRESS =
  "0xd8BF1d2720E9fFD01a2F9A2eFc3E101a05B852b4".toLowerCase();

export const REWARDS_SOURCES = [
  Address.fromString("0xcee8cd002f151a536394e564b84076c41bbbcd4d"), // orderbook
  Address.fromString("0x0f3D8a38D4c74afBebc2c42695642f0e3acb15D3"), // Sparkdex Universal Router
  Address.fromString("0x6352a56caadC4F1E25CD6c75970Fa768A3304e64"), // OpenOcean Exchange Proxy
  Address.fromString("0xeD85325119cCFc6aCB16FA931bAC6378B76e4615"), // OpenOcean Exchange Impl
  Address.fromString("0x8c7ba8f245aef3216698087461e05b85483f791f"), // OpenOcean Exchange Router
  Address.fromString("0x9D70B0b90915Bb8b9bdAC7e6a7e6435bBF1feC4D"), // Sparkdex TWAP
];

export const V2_POOL_FACTORIES = [
  Address.fromString("0x16b619B04c961E8f4F06C10B42FDAbb328980A89"), // Sparkdex V2
  Address.fromString("0x440602f459D7Dd500a74528003e6A20A46d6e2A6"), // Blazeswap
];

export const V3_POOL_FACTORIES = [
  Address.fromString("0xb3fB4f96175f6f9D716c17744e5A6d4BA9da8176"), // Sparkdex V3 (deprecated and out of reach in sparkdex GUI)
  Address.fromString("0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652"), // Sparkdex V3.1
];

export const FACTORIES = [
  V2_POOL_FACTORIES,
  V3_POOL_FACTORIES,
].flat();

export const BlazeswapV2LiquidityManager = Address.fromString("0xe3A1b355ca63abCBC9589334B5e609583C7BAa06"); // UniswapV2Router
export const SparkdexV2LiquidityManager = Address.fromString("0x4a1E5A90e9943467FAd1acea1E7F0e5e88472a1e"); // UniswapV2Router
export const SparkdexV3LiquidityManager = Address.fromString("0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da"); // NonfungiblePositioonManager

export class EventABI {
  constructor(
    public sig: string,
    public topic0: Bytes,
    public dataAbi: string
  ) {}
}

export const ERC20TransferEventABI = new EventABI(
    "Transfer(indexed address from,indexed address to,uint256 value)",
    Bytes.fromHexString("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"),
    "(uint256)",
)

export const ERC721TransferEventABI = new EventABI(
    "Transfer(indexed address from,indexed address to,indexed uint256 tokenId)",
    Bytes.fromHexString("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"),
    "",
)

export const DecreaseLiquidityV3ABI = new EventABI(
    "DecreaseLiquidity(indexed uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
    Bytes.fromHexString("0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4"),
    "(uint128,uint256,uint256)",
)

export const IncreaseLiquidityV3ABI = new EventABI(
    "IncreaseLiquidity(indexed uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
    Bytes.fromHexString("0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f"),
    "(uint128,uint256,uint256)",
)
