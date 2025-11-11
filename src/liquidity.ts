import { isV2Pool, isV3Pool } from "./common";
import { LiquidityV2 } from "../generated/templates";
import { factory } from "../generated/cysFLR/factory";
import { Transfer as ERC20TransferEvent } from "../generated/cysFLR/cysFLR";
import { Address, BigInt, Bytes, ethereum, store } from "@graphprotocol/graph-ts";
import { Transfer as ERC721TransferEvent } from "../generated/LiquidityV3/LiquidityV3";
import { Account, LiquidityV2OwnerBalance, LiquidityV3OwnerBalance } from "../generated/schema";
import {
    ONE18,
    ZERO_ADDRESS,
    CYSFLR_ADDRESS,
    CYWETH_ADDRESS,
    ERC20TransferEventABI,
    IncreaseLiquidityV3ABI,
    DecreaseLiquidityV3ABI,
    SparkdexV2LiquidityManager,
    SparkdexV3LiquidityManager,
    BlazeswapV2LiquidityManager,
} from "./constants";

export function handleLiquidityAdd(
    event: ERC20TransferEvent,
    cyToken: Address,
): boolean {
    if (!event.transaction.to) return false;

    const maybeHasFactory = factory.bind(event.params.to);
    const factoryAddress = maybeHasFactory.try_factory();
    if (!factoryAddress.reverted) return false;
    const transferToFactoryAddress = factoryAddress.value;

    if (event.transaction.to!.equals(SparkdexV3LiquidityManager)) {
        return handleLiquidityV3Add(event, transferToFactoryAddress, cyToken);
    } else if (event.transaction.to!.equals(BlazeswapV2LiquidityManager)) {
        return handleLiquidityV2Add(event, transferToFactoryAddress, cyToken);
    } else if (event.transaction.to!.equals(SparkdexV2LiquidityManager)) {
        return handleLiquidityV2Add(event, transferToFactoryAddress, cyToken);
    }

    return false;
}

export function handleLiquidityWithdraw(
    event: ERC20TransferEvent,
    cyToken: Address,
): BigInt {
    if (!event.transaction.to) return BigInt.zero();

    const maybeHasFactory = factory.bind(event.params.from);
    const factoryAddress = maybeHasFactory.try_factory();
    if (!factoryAddress.reverted) return BigInt.zero();
    const transferToFactoryAddress = factoryAddress.value;

    if (event.transaction.to!.notEqual(SparkdexV3LiquidityManager)) {
        return handleLiquidityV3Withdraw(event, transferToFactoryAddress, cyToken);
    }

    return BigInt.zero();
}

// handles v2 liquidity addage by looking for LP token mint event in the
// same transaction with correct params and returns true if the given
// transfer event was a liquidity addage or false otherwise
export function handleLiquidityV2Add(
    event: ERC20TransferEvent,
    transferToFactoryAddress: Address,
    cyToken: Address,
): boolean {
    const owner = event.transaction.from;

    if (!event.receipt) return false;
    if (!event.transaction.to) return false;
    if (owner.notEqual(event.params.from)) return false; // transfer from address should be the owner
    if (!isV2Pool(transferToFactoryAddress)) return false; // expecting a v2 pool
    // expecting either of blazeswap or sparkdex liquidity manager v2 contract addresses to be the transactio "to" address
    if (event.transaction.to!.notEqual(BlazeswapV2LiquidityManager) && event.transaction.to!.notEqual(SparkdexV2LiquidityManager)) return false;

    for (let i = 0; i < event.receipt!.logs.length; i++) {
        const log = event.receipt!.logs[i];

        if (log.address.notEqual(event.params.to)) continue;
        if (log.topics[0].notEqual(ERC20TransferEventABI.topic0)) continue;
        if (log.topics[1].notEqual(ZERO_ADDRESS)) continue;
        if (log.topics[2].notEqual(owner)) continue;

        // try decoding the event's data
        const decoded = ethereum.decode(ERC20TransferEventABI.dataAbi, log.data)
        if (!decoded) continue;
        const value = decoded.toTuple()[0].toBigInt();

        // create lpv2 dynamic data source to track v2 pool lp token transfers
        LiquidityV2.create(log.address);

        const id = log.address.concat(owner).concat(cyToken);
        let liquidityV2OwnerBalance = LiquidityV2OwnerBalance.load(id);
        if (!liquidityV2OwnerBalance) {
            liquidityV2OwnerBalance = new LiquidityV2OwnerBalance(id);
            liquidityV2OwnerBalance.lpAddress = log.address;
            liquidityV2OwnerBalance.owner = owner;
            liquidityV2OwnerBalance.liquidity = value;
            liquidityV2OwnerBalance.depositBalance = event.params.value;
            liquidityV2OwnerBalance.cyToken = cyToken;
        } else {
            liquidityV2OwnerBalance.liquidity = liquidityV2OwnerBalance.liquidity.plus(value);
            liquidityV2OwnerBalance.depositBalance = liquidityV2OwnerBalance.depositBalance.plus(event.params.value);
        }
        liquidityV2OwnerBalance.save();
        return true;
    }

    return false;
}

// handles v3 liquidity addage by looking for LP token IncreaseLiquidity event
// in the same transaction with correct params and returns true if the given
// transfer event was a liquidity addage or false otherwise
export function handleLiquidityV3Add(
    event: ERC20TransferEvent,
    transferToFactoryAddress: Address,
    cyToken: Address,
): boolean {
    const owner = event.transaction.from;

    if (!event.receipt) return false;
    if (!event.transaction.to) return false;
    if (owner.notEqual(event.params.from)) return false; // transfer from address should be the owner
    if (!isV3Pool(transferToFactoryAddress)) return false; // expecting a v3 pool
    // expecting sparkdex liquidity manager v3 contract address to be the transactio "to" address
    if (event.transaction.to!.notEqual(SparkdexV3LiquidityManager)) return false;

    for (let i = 0; i < event.receipt!.logs.length; i++) {
        const log = event.receipt!.logs[i];

        if (log.address.notEqual(SparkdexV3LiquidityManager)) continue;
        if (log.topics[0].notEqual(IncreaseLiquidityV3ABI.topic0)) continue;

        const decoded = ethereum.decode(IncreaseLiquidityV3ABI.dataAbi, log.data)
        if (!decoded) continue;
        const tuple = decoded.toTuple();
        const liquidity = tuple[0].toBigInt();
        const amount0 = tuple[1].toBigInt();
        const amount1 = tuple[2].toBigInt();
        if (amount0.notEqual(event.params.value) && amount1.notEqual(event.params.value)) continue;

        const tokenId = BigInt.fromUnsignedBytes(log.topics[1]);
        const id = log.address.concat(owner).concat(cyToken).concat(Bytes.fromByteArray(Bytes.fromBigInt(tokenId)));
        let liquidityV3OwnerBalance = LiquidityV3OwnerBalance.load(id);
        if (!liquidityV3OwnerBalance) {
            liquidityV3OwnerBalance = new LiquidityV3OwnerBalance(id);
            liquidityV3OwnerBalance.lpAddress = log.address;
            liquidityV3OwnerBalance.owner = owner;
            liquidityV3OwnerBalance.liquidity = liquidity;
            liquidityV3OwnerBalance.tokenId = tokenId;
            liquidityV3OwnerBalance.depositBalance = event.params.value;
            liquidityV3OwnerBalance.cyToken = cyToken;
        } else {
            liquidityV3OwnerBalance.liquidity = liquidityV3OwnerBalance.liquidity.plus(liquidity);
            liquidityV3OwnerBalance.depositBalance = liquidityV3OwnerBalance.depositBalance.plus(event.params.value);
        }
        liquidityV3OwnerBalance.save();
        return true;
    }

    return false;
}

// handles v3 liquidity withdrawal by looking for LP token DecreaseLiquidity event
// in the same transaction with correct params and returns the cytoken deduction amount
export function handleLiquidityV3Withdraw(
    event: ERC20TransferEvent,
    transferFromFactoryAddress: Address,
    cyToken: Address,
): BigInt {
    const owner = event.transaction.from;

    if (!event.receipt) return BigInt.zero();
    if (!event.transaction.to) return BigInt.zero();
    if (owner.notEqual(event.params.to)) return BigInt.zero(); // transfer to address should be the owner
    if (!isV3Pool(transferFromFactoryAddress)) return BigInt.zero(); // expecting a v3 pool
    // expecting sparkdex liquidity manager v3 contract address to be the transactio "to" address
    if (event.transaction.to!.notEqual(SparkdexV3LiquidityManager)) return BigInt.zero();

    for (let i = 0; i < event.receipt!.logs.length; i++) {
        const log = event.receipt!.logs[i];

        if (log.address.notEqual(SparkdexV3LiquidityManager)) continue;
        if (log.topics[0].notEqual(DecreaseLiquidityV3ABI.topic0)) continue;

        const decoded = ethereum.decode(DecreaseLiquidityV3ABI.dataAbi, log.data)
        if (!decoded) continue;
        const tuple = decoded.toTuple();
        const liquidity = tuple[0].toBigInt();
        const amount0 = tuple[1].toBigInt();
        const amount1 = tuple[2].toBigInt();
        if (amount0.notEqual(event.params.value) && amount1.notEqual(event.params.value)) continue;

        const tokenId = BigInt.fromUnsignedBytes(log.topics[1]);
        const id = log.address.concat(owner).concat(cyToken).concat(Bytes.fromByteArray(Bytes.fromBigInt(tokenId)));
        let liquidityV3OwnerBalance = LiquidityV3OwnerBalance.load(id);
        if (liquidityV3OwnerBalance) {
            const ratio = liquidity.times(ONE18).div(liquidityV3OwnerBalance.liquidity);
            const depositDeduction = liquidityV3OwnerBalance.depositBalance.times(ratio).div(ONE18);
            liquidityV3OwnerBalance.depositBalance = liquidityV3OwnerBalance.depositBalance.minus(depositDeduction);
            liquidityV3OwnerBalance.liquidity = liquidityV3OwnerBalance.liquidity.minus(liquidity);
            liquidityV3OwnerBalance.save();

            // remove the record if liquidity is withdrawn completely
            if (liquidityV3OwnerBalance.liquidity.isZero()) {
                store.remove("LiquidityV3OwnerBalance", id.toHexString());
            }

            return depositDeduction;
        }
    }

    return BigInt.zero();
}

// handles LP erc20 token transfers (v2) and updates account cy token balances accordingly
export function handleLiquidityV2Transfer(event: ERC20TransferEvent): void {
    const owner = event.params.from;
    if (owner.equals(ZERO_ADDRESS)) return; // skip if this is a mint, as mint are already handled in liquidity add
    if (owner.equals(event.params.to)) return; // skip no change event, ie same to/from

    // get pool tokens
    const token0Result = factory.bind(event.address).try_token0();
    const token1Result = factory.bind(event.address).try_token1();
    if (token0Result.reverted || token1Result.reverted) return;

    const token0 = token0Result.value.toHexString().toLowerCase();
    const token1 = token1Result.value.toHexString().toLowerCase();
    if (token0 === CYSFLR_ADDRESS || token0 === CYWETH_ADDRESS) {
        handleBalanceChangeV2(event, owner, token0Result.value);
    }
    if (token1 === CYSFLR_ADDRESS || token1 === CYWETH_ADDRESS) {
        handleBalanceChangeV2(event, owner, token1Result.value);
    }
}

function handleBalanceChangeV2(
    event: ERC20TransferEvent,
    owner: Address,
    cyToken: Address,
): void {
    const id = event.address.concat(owner).concat(cyToken);
    const liquidityV2OwnerBalance = LiquidityV2OwnerBalance.load(id);
    if (!liquidityV2OwnerBalance) return;

    const ratio = event.params.value.times(ONE18).div(liquidityV2OwnerBalance.liquidity);
    const depositDeduction = liquidityV2OwnerBalance.depositBalance.times(ratio).div(ONE18);
    liquidityV2OwnerBalance.depositBalance = liquidityV2OwnerBalance.depositBalance.minus(depositDeduction);
    liquidityV2OwnerBalance.liquidity = liquidityV2OwnerBalance.liquidity.minus(event.params.value);
    liquidityV2OwnerBalance.save();

    // remove the record if liquidity is withdrawn completely
    if (liquidityV2OwnerBalance.liquidity.isZero()) {
        store.remove("LiquidityV2OwnerBalance", id.toHexString());
    }

    const account = Account.load(owner);
    if (!account) return;
    if (cyToken.toHexString().toLowerCase() === CYSFLR_ADDRESS) {
        account.cysFLRBalance = account.cysFLRBalance.minus(depositDeduction);
    }
    if (cyToken.toHexString().toLowerCase() === CYWETH_ADDRESS) {
        account.cyWETHBalance = account.cyWETHBalance.minus(depositDeduction);
    }
    account.save();
}

// handles LP erc721 token transfers (v3) and updates account cy token balances accordingly
export function handleLiquidityV3Transfer(event: ERC721TransferEvent): void {
    const owner = event.params.from;
    const tokenId = event.params.tokenId;
    if (owner.equals(ZERO_ADDRESS)) return; // skip if this is a mint, as mint are already handled in liquidity add
    if (owner.equals(event.params.to)) return; // skip no change event, ie same to/from

    // get pool tokens
    const token0Result = factory.bind(event.address).try_token0();
    const token1Result = factory.bind(event.address).try_token1();
    if (token0Result.reverted || token1Result.reverted) return;

    const token0 = token0Result.value.toHexString().toLowerCase();
    const token1 = token1Result.value.toHexString().toLowerCase();
    if (token0 === CYSFLR_ADDRESS || token0 === CYWETH_ADDRESS) {
        handleBalanceChangeV3(event, owner, token0Result.value, tokenId);
    }
    if (token1 === CYSFLR_ADDRESS || token1 === CYWETH_ADDRESS) {
        handleBalanceChangeV3(event, owner, token1Result.value, tokenId);
    }
}

function handleBalanceChangeV3(
    event: ERC721TransferEvent,
    owner: Address,
    cyToken: Address,
    tokenId: BigInt,
): void {
    const id = event.address.concat(owner).concat(cyToken).concat(Bytes.fromByteArray(Bytes.fromBigInt(tokenId)));
    const liquidityV3OwnerBalance = LiquidityV3OwnerBalance.load(id);
    if (!liquidityV3OwnerBalance) return;

    const depositBalance = liquidityV3OwnerBalance.depositBalance;

    // remove the record as the owner has changed and there is no portional liquidity transfer like there is in v2
    store.remove("LiquidityV3OwnerBalance", id.toHexString());

    const account = Account.load(owner);
    if (!account) return;
    if (cyToken.toHexString().toLowerCase() === CYSFLR_ADDRESS) {
        account.cysFLRBalance = account.cysFLRBalance.minus(depositBalance);
    }
    if (cyToken.toHexString().toLowerCase() === CYWETH_ADDRESS) {
        account.cyWETHBalance = account.cyWETHBalance.minus(depositBalance);
    }
    account.save();
}
