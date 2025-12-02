import { updateTotalsForAccount } from "./cys-flr";
import { LiquidityV2 } from "../generated/templates";
import { factory } from "../generated/cysFLR/factory";
import { bigintToBytes, isV2Pool, isV3Pool } from "./common";
import { Transfer as ERC20TransferEvent } from "../generated/cysFLR/cysFLR";
import { Address, BigInt, Bytes, ethereum, store, dataSource } from "@graphprotocol/graph-ts";
import { Transfer as ERC721TransferEvent, LiquidityV3 } from "../generated/LiquidityV3/LiquidityV3";
import { Account, LiquidityV2Change, LiquidityV2OwnerBalance, LiquidityV3Change, LiquidityV3OwnerBalance } from "../generated/schema";
import { NetworkImplementation } from "./networkImplementation";
import {
    ONE18,
    SparkdexV2LiquidityManager,
    SparkdexV3LiquidityManager,
    BlazeswapV2LiquidityManager,
    ERC20TransferEventABI,
    IncreaseLiquidityV3ABI,
    DecreaseLiquidityV3ABI,
} from "./constants";

export const DEPOSIT = "DEPOSIT";
export const WITHDRAW = "WITHDRAW";
export const TRANSFER = "TRANSFER";

export function getLiquidityV2OwnerBalanceId(
    address: Address,
    owner: Address,
    cyToken: Address,
): Bytes {
    return address.concat(owner).concat(cyToken);
}

export function getLiquidityV3OwnerBalanceId(
    address: Address,
    owner: Address,
    cyToken: Address,
    tokenId: BigInt,
): Bytes {
    return address.concat(owner).concat(cyToken).concat(bigintToBytes(tokenId));
}

export function handleLiquidityAdd(
    event: ERC20TransferEvent,
    cyToken: Address,
): boolean {
    if (!event.transaction.to) return false;

    const maybeHasFactory = factory.bind(event.params.to);
    const factoryAddress = maybeHasFactory.try_factory();
    if (factoryAddress.reverted) return false;
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
    if (factoryAddress.reverted) return BigInt.zero();
    const transferFromFactoryAddress = factoryAddress.value;

    if (event.transaction.to!.equals(SparkdexV3LiquidityManager)) {
        return handleLiquidityV3Withdraw(event, transferFromFactoryAddress, cyToken);
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
        const log_ = event.receipt!.logs[i];

        if (log_.address.notEqual(event.params.to)) continue;
        if (log_.topics[0].notEqual(ERC20TransferEventABI.topic0)) continue;
        if (!log_.topics[1]) continue; // skip if topic 1 and 2 are undefined
        if (!log_.topics[2]) continue;
        if (log_.topics[1].length != 32) continue; // expect 32 bytes length topic 1 and 2
        if (log_.topics[2].length != 32) continue;

        // the transfer should be a mint to the owner
        if (Address.fromBytes(changetype<Bytes>(log_.topics[1].subarray(12))).notEqual(Address.zero())) continue;
        if (Address.fromBytes(changetype<Bytes>(log_.topics[2].subarray(12))).notEqual(owner)) continue;

        // try decoding the event's data
        const decoded = ethereum.decode(ERC20TransferEventABI.dataAbi, log_.data)
        if (!decoded) continue;
        const value = decoded.toTuple()[0].toBigInt();

        // create lpv2 dynamic data source to track v2 pool lp token transfers
        LiquidityV2.create(log_.address);

        const id = getLiquidityV2OwnerBalanceId(log_.address, owner, cyToken);
        let liquidityV2OwnerBalance = LiquidityV2OwnerBalance.load(id);
        if (!liquidityV2OwnerBalance) {
            liquidityV2OwnerBalance = new LiquidityV2OwnerBalance(id);
            liquidityV2OwnerBalance.lpAddress = log_.address;
            liquidityV2OwnerBalance.owner = owner;
            liquidityV2OwnerBalance.liquidity = value;
            liquidityV2OwnerBalance.depositBalance = event.params.value;
            liquidityV2OwnerBalance.tokenAddress = cyToken;
        } else {
            liquidityV2OwnerBalance.liquidity = liquidityV2OwnerBalance.liquidity.plus(value);
            liquidityV2OwnerBalance.depositBalance = liquidityV2OwnerBalance.depositBalance.plus(event.params.value);
        }
        liquidityV2OwnerBalance.save();

        // create liquidity change entity for this deposit
        createLiquidityV2Change(
            log_.address,
            owner,
            cyToken,
            value,
            event.params.value,
            event.block.number,
            event.block.timestamp,
            event.transaction.hash,
            log_.logIndex,
            DEPOSIT,
        )
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
        const log_ = event.receipt!.logs[i];

        if (log_.address.notEqual(SparkdexV3LiquidityManager)) continue;
        if (log_.topics[0].notEqual(IncreaseLiquidityV3ABI.topic0)) continue;

        const decoded = ethereum.decode(IncreaseLiquidityV3ABI.dataAbi, log_.data)
        if (!decoded) continue;
        const tuple = decoded.toTuple();
        const liquidity = tuple[0].toBigInt();
        const amount0 = tuple[1].toBigInt();
        const amount1 = tuple[2].toBigInt();
        if (amount0.notEqual(event.params.value) && amount1.notEqual(event.params.value)) continue;

        const tokenId = BigInt.fromByteArray(Bytes.fromUint8Array(log_.topics[1].reverse()));
        const id = getLiquidityV3OwnerBalanceId(log_.address, owner, cyToken, tokenId);
        let liquidityV3OwnerBalance = LiquidityV3OwnerBalance.load(id);
        if (!liquidityV3OwnerBalance) {
            liquidityV3OwnerBalance = new LiquidityV3OwnerBalance(id);
            liquidityV3OwnerBalance.lpAddress = log_.address;
            liquidityV3OwnerBalance.owner = owner;
            liquidityV3OwnerBalance.liquidity = liquidity;
            liquidityV3OwnerBalance.tokenId = tokenId;
            liquidityV3OwnerBalance.depositBalance = event.params.value;
            liquidityV3OwnerBalance.tokenAddress = cyToken;
        } else {
            liquidityV3OwnerBalance.liquidity = liquidityV3OwnerBalance.liquidity.plus(liquidity);
            liquidityV3OwnerBalance.depositBalance = liquidityV3OwnerBalance.depositBalance.plus(event.params.value);
        }
        liquidityV3OwnerBalance.save();

        // create liquidity change entity for this deposit
        createLiquidityV3Change(
            log_.address,
            owner,
            cyToken,
            liquidity,
            event.params.value,
            event.block.number,
            event.block.timestamp,
            event.transaction.hash,
            log_.logIndex,
            DEPOSIT,
            tokenId,
        )
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
        const log_ = event.receipt!.logs[i];

        if (log_.address.notEqual(SparkdexV3LiquidityManager)) continue;
        if (log_.topics[0].notEqual(DecreaseLiquidityV3ABI.topic0)) continue;

        const decoded = ethereum.decode(DecreaseLiquidityV3ABI.dataAbi, log_.data)
        if (!decoded) continue;
        const tuple = decoded.toTuple();
        const liquidity = tuple[0].toBigInt();
        const amount0 = tuple[1].toBigInt();
        const amount1 = tuple[2].toBigInt();

        const tokenId = BigInt.fromByteArray(Bytes.fromUint8Array(log_.topics[1].reverse()));
        const id = getLiquidityV3OwnerBalanceId(log_.address, owner, cyToken, tokenId);
        let liquidityV3OwnerBalance = LiquidityV3OwnerBalance.load(id);
        if (liquidityV3OwnerBalance) {
            const ratio = liquidity.times(ONE18).div(liquidityV3OwnerBalance.liquidity);
            const depositDeduction = liquidityV3OwnerBalance.depositBalance.times(ratio).div(ONE18);

            // create liquidity change entity for this withdraw
            createLiquidityV3Change(
                event.address,
                owner,
                cyToken,
                liquidity,
                depositDeduction,
                event.block.number,
                event.block.timestamp,
                event.transaction.hash,
                log_.logIndex,
                WITHDRAW,
                tokenId,
            );

            liquidityV3OwnerBalance.depositBalance = liquidityV3OwnerBalance.depositBalance.minus(depositDeduction);
            liquidityV3OwnerBalance.liquidity = liquidityV3OwnerBalance.liquidity.minus(liquidity);
            liquidityV3OwnerBalance.save();

            // remove the record if liquidity is withdrawn completely
            if (liquidityV3OwnerBalance.liquidity.isZero()) {
                store.remove("LiquidityV3OwnerBalance", id.toHexString().toLowerCase());
            }

            return depositDeduction;
        }
    }

    return BigInt.zero();
}

// handles LP erc20 token transfers (v2) and updates account cy token balances accordingly
export function handleLiquidityV2Transfer(event: ERC20TransferEvent): void {
    const owner = event.params.from;
    if (owner.equals(Address.zero())) return; // skip if this is a mint, as mint are already handled in liquidity add
    if (owner.equals(event.params.to)) return; // skip no change event, ie same to/from

    // get pool tokens
    const token0Result = factory.bind(event.address).try_token0();
    const token1Result = factory.bind(event.address).try_token1();
    if (token0Result.reverted || token1Result.reverted) return;

    const token0 = token0Result.value;
    const token1 = token1Result.value;

    const network = new NetworkImplementation(dataSource.network());
    const cysFLR = Address.fromString(network.getCysFLRAddress());
    const cyWETH = Address.fromString(network.getCyWETHAddress());
    const cyFXRP = Address.fromString(network.getCyFXRPAddress());
    const cyWBTC = Address.fromString(network.getCyWBTCAddress());
    const cycbBTC = Address.fromString(network.getCycbBTCAddress());
    const cyLINK = Address.fromString(network.getCyLINKAddress());
    const cyDOT = Address.fromString(network.getCyDOTAddress());
    const cyUNI = Address.fromString(network.getCyUNIAddress());
    const cyPEPE = Address.fromString(network.getCyPEPEAddress());
    const cyENA = Address.fromString(network.getCyENAAddress());
    const cyARB = Address.fromString(network.getCyARBAddress());
    const cywstETH = Address.fromString(network.getCywstETHAddress());
    const cyXAUt0 = Address.fromString(network.getCyXAUt0Address());
    const cyPYTH = Address.fromString(network.getCyPYTHAddress());

    if (token0.equals(cysFLR) || token0.equals(cyWETH) || token0.equals(cyFXRP) || token0.equals(cyWBTC) || token0.equals(cycbBTC) ||
        token0.equals(cyLINK) || token0.equals(cyDOT) || token0.equals(cyUNI) || token0.equals(cyPEPE) || token0.equals(cyENA) ||
        token0.equals(cyARB) || token0.equals(cywstETH) || token0.equals(cyXAUt0) || token0.equals(cyPYTH)) {
        handleLiquidityV2TransferInner(event, owner, token0Result.value);
    }
    if (token1.equals(cysFLR) || token1.equals(cyWETH) || token1.equals(cyFXRP) || token1.equals(cyWBTC) || token1.equals(cycbBTC) ||
        token1.equals(cyLINK) || token1.equals(cyDOT) || token1.equals(cyUNI) || token1.equals(cyPEPE) || token1.equals(cyENA) ||
        token1.equals(cyARB) || token1.equals(cywstETH) || token1.equals(cyXAUt0) || token1.equals(cyPYTH)) {
        handleLiquidityV2TransferInner(event, owner, token1Result.value);
    }
}

function handleLiquidityV2TransferInner(
    event: ERC20TransferEvent,
    owner: Address,
    cyToken: Address,
): void {
    const id = getLiquidityV2OwnerBalanceId(event.address, owner, cyToken);
    const liquidityV2OwnerBalance = LiquidityV2OwnerBalance.load(id);
    if (!liquidityV2OwnerBalance) return;

    const ratio = event.params.value.times(ONE18).div(liquidityV2OwnerBalance.liquidity);
    const depositDeduction = liquidityV2OwnerBalance.depositBalance.times(ratio).div(ONE18);

    // create liquidity change entity for this transfer
    createLiquidityV2Change(
        event.address,
        owner,
        cyToken,
        event.params.value,
        depositDeduction,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash,
        event.logIndex,
        // in v2, withdraw is transfer to zero address or the pool address
        event.params.to.equals(Address.zero()) || event.params.to.equals(event.address)
            ? WITHDRAW 
            : TRANSFER,
    );

    liquidityV2OwnerBalance.depositBalance = liquidityV2OwnerBalance.depositBalance.minus(depositDeduction);
    liquidityV2OwnerBalance.liquidity = liquidityV2OwnerBalance.liquidity.minus(event.params.value);
    liquidityV2OwnerBalance.save();

    // remove the record if liquidity is withdrawn completely
    if (liquidityV2OwnerBalance.liquidity.isZero()) {
        store.remove("LiquidityV2OwnerBalance", id.toHexString().toLowerCase());
    }

    const account = Account.load(owner);
    if (!account) return;
    const oldCysFLR = account.cysFLRBalance;
    const oldCyWETH = account.cyWETHBalance;
    const oldCyFXRP = account.cyFXRPBalance;
    const oldCyWBTC = account.cyWBTCBalance;
    const oldCycbBTC = account.cycbBTCBalance;
    const oldCyLINK = account.cyLINKBalance;
    const oldCyDOT = account.cyDOTBalance;
    const oldCyUNI = account.cyUNIBalance;
    const oldCyPEPE = account.cyPEPEBalance;
    const oldCyENA = account.cyENABalance;
    const oldCyARB = account.cyARBBalance;
    const oldCywstETH = account.cywstETHBalance;
    const oldCyXAUt0 = account.cyXAUt0Balance;
    const oldCyPYTH = account.cyPYTHBalance;

    const network = new NetworkImplementation(dataSource.network());
    const cysFLR = Address.fromString(network.getCysFLRAddress());
    const cyWETH = Address.fromString(network.getCyWETHAddress());
    const cyFXRP = Address.fromString(network.getCyFXRPAddress());
    const cyWBTC = Address.fromString(network.getCyWBTCAddress());
    const cycbBTC = Address.fromString(network.getCycbBTCAddress());
    const cyLINK = Address.fromString(network.getCyLINKAddress());
    const cyDOT = Address.fromString(network.getCyDOTAddress());
    const cyUNI = Address.fromString(network.getCyUNIAddress());
    const cyPEPE = Address.fromString(network.getCyPEPEAddress());
    const cyENA = Address.fromString(network.getCyENAAddress());
    const cyARB = Address.fromString(network.getCyARBAddress());
    const cywstETH = Address.fromString(network.getCywstETHAddress());
    const cyXAUt0 = Address.fromString(network.getCyXAUt0Address());
    const cyPYTH = Address.fromString(network.getCyPYTHAddress());

    if (cyToken.equals(cysFLR)) {
        account.cysFLRBalance = account.cysFLRBalance.minus(depositDeduction);
    }
    if (cyToken.equals(cyWETH)) {
        account.cyWETHBalance = account.cyWETHBalance.minus(depositDeduction);
    }
    if (cyToken.equals(cyFXRP)) {
        account.cyFXRPBalance = account.cyFXRPBalance.minus(depositDeduction);
    }
    if (cyToken.equals(cyWBTC)) {
        account.cyWBTCBalance = account.cyWBTCBalance.minus(depositDeduction);
    }
    if (cyToken.equals(cycbBTC)) {
        account.cycbBTCBalance = account.cycbBTCBalance.minus(depositDeduction);
    }
    if (cyToken.equals(cyLINK)) {
        account.cyLINKBalance = account.cyLINKBalance.minus(depositDeduction);
    }
    if (cyToken.equals(cyDOT)) {
        account.cyDOTBalance = account.cyDOTBalance.minus(depositDeduction);
    }
    if (cyToken.equals(cyUNI)) {
        account.cyUNIBalance = account.cyUNIBalance.minus(depositDeduction);
    }
    if (cyToken.equals(cyPEPE)) {
        account.cyPEPEBalance = account.cyPEPEBalance.minus(depositDeduction);
    }
    if (cyToken.equals(cyENA)) {
        account.cyENABalance = account.cyENABalance.minus(depositDeduction);
    }
    if (cyToken.equals(cyARB)) {
        account.cyARBBalance = account.cyARBBalance.minus(depositDeduction);
    }
    if (cyToken.equals(cywstETH)) {
        account.cywstETHBalance = account.cywstETHBalance.minus(depositDeduction);
    }
    if (cyToken.equals(cyXAUt0)) {
        account.cyXAUt0Balance = account.cyXAUt0Balance.minus(depositDeduction);
    }
    if (cyToken.equals(cyPYTH)) {
        account.cyPYTHBalance = account.cyPYTHBalance.minus(depositDeduction);
    }
    account.save();
    updateTotalsForAccount(
        account,
        oldCysFLR,
        oldCyWETH,
        oldCyFXRP,
        oldCyWBTC,
        oldCycbBTC,
        oldCyLINK,
        oldCyDOT,
        oldCyUNI,
        oldCyPEPE,
        oldCyENA,
        oldCyARB,
        oldCywstETH,
        oldCyXAUt0,
        oldCyPYTH
    );
}

// handles LP erc721 token transfers (v3) and updates account cy token balances accordingly
export function handleLiquidityV3Transfer(event: ERC721TransferEvent): void {
    const owner = event.params.from;
    const tokenId = event.params.tokenId;
    if (owner.equals(Address.zero())) return; // skip if this is a mint, as mint are already handled in liquidity add
    if (owner.equals(event.params.to)) return; // skip no change event, ie same to/from

    // get pool tokens
    const result = LiquidityV3.bind(event.address).try_positions(tokenId);
    if (result.reverted) return;

    const token0Address = result.value.getToken0();
    const token1Address = result.value.getToken1();

    const network = new NetworkImplementation(dataSource.network());
    const cysFLR = Address.fromString(network.getCysFLRAddress());
    const cyWETH = Address.fromString(network.getCyWETHAddress());
    const cyFXRP = Address.fromString(network.getCyFXRPAddress());
    const cyWBTC = Address.fromString(network.getCyWBTCAddress());
    const cycbBTC = Address.fromString(network.getCycbBTCAddress());
    const cyLINK = Address.fromString(network.getCyLINKAddress());
    const cyDOT = Address.fromString(network.getCyDOTAddress());
    const cyUNI = Address.fromString(network.getCyUNIAddress());
    const cyPEPE = Address.fromString(network.getCyPEPEAddress());
    const cyENA = Address.fromString(network.getCyENAAddress());
    const cyARB = Address.fromString(network.getCyARBAddress());
    const cywstETH = Address.fromString(network.getCywstETHAddress());
    const cyXAUt0 = Address.fromString(network.getCyXAUt0Address());
    const cyPYTH = Address.fromString(network.getCyPYTHAddress());

    if (token0Address.equals(cysFLR) || token0Address.equals(cyWETH) || token0Address.equals(cyFXRP) || token0Address.equals(cyWBTC) || token0Address.equals(cycbBTC) ||
        token0Address.equals(cyLINK) || token0Address.equals(cyDOT) || token0Address.equals(cyUNI) || token0Address.equals(cyPEPE) || token0Address.equals(cyENA) ||
        token0Address.equals(cyARB) || token0Address.equals(cywstETH) || token0Address.equals(cyXAUt0) || token0Address.equals(cyPYTH)) {
        handleLiquidityV3TransferInner(event, owner, token0Address, tokenId);
    }
    if (token1Address.equals(cysFLR) || token1Address.equals(cyWETH) || token1Address.equals(cyFXRP) || token1Address.equals(cyWBTC) || token1Address.equals(cycbBTC) ||
        token1Address.equals(cyLINK) || token1Address.equals(cyDOT) || token1Address.equals(cyUNI) || token1Address.equals(cyPEPE) || token1Address.equals(cyENA) ||
        token1Address.equals(cyARB) || token1Address.equals(cywstETH) || token1Address.equals(cyXAUt0) || token1Address.equals(cyPYTH)) {
        handleLiquidityV3TransferInner(event, owner, token1Address, tokenId);
    }
}

function handleLiquidityV3TransferInner(
    event: ERC721TransferEvent,
    owner: Address,
    cyToken: Address,
    tokenId: BigInt,
): void {
    const id = getLiquidityV3OwnerBalanceId(event.address, owner, cyToken, tokenId);
    const liquidityV3OwnerBalance = LiquidityV3OwnerBalance.load(id);
    if (!liquidityV3OwnerBalance) return;

    // create liquidity change entity for this transfer
    createLiquidityV3Change(
        event.address,
        owner,
        cyToken,
        liquidityV3OwnerBalance.liquidity,
        liquidityV3OwnerBalance.depositBalance,
        event.block.number,
        event.block.timestamp,
        event.transaction.hash,
        event.logIndex,
        TRANSFER,
        tokenId,
    )

    const depositBalance = liquidityV3OwnerBalance.depositBalance;

    // remove the record as the owner has changed and there is no portional liquidity transfer like there is in v2
    store.remove("LiquidityV3OwnerBalance", id.toHexString().toLowerCase());

    const account = Account.load(owner);
    if (!account) return;
    const oldCysFLR = account.cysFLRBalance;
    const oldCyWETH = account.cyWETHBalance;
    const oldCyFXRP = account.cyFXRPBalance;
    const oldCyWBTC = account.cyWBTCBalance;
    const oldCycbBTC = account.cycbBTCBalance;
    const oldCyLINK = account.cyLINKBalance;
    const oldCyDOT = account.cyDOTBalance;
    const oldCyUNI = account.cyUNIBalance;
    const oldCyPEPE = account.cyPEPEBalance;
    const oldCyENA = account.cyENABalance;
    const oldCyARB = account.cyARBBalance;
    const oldCywstETH = account.cywstETHBalance;
    const oldCyXAUt0 = account.cyXAUt0Balance;
    const oldCyPYTH = account.cyPYTHBalance;

    const network = new NetworkImplementation(dataSource.network());
    const cysFLR = Address.fromString(network.getCysFLRAddress());
    const cyWETH = Address.fromString(network.getCyWETHAddress());
    const cyFXRP = Address.fromString(network.getCyFXRPAddress());
    const cyWBTC = Address.fromString(network.getCyWBTCAddress());
    const cycbBTC = Address.fromString(network.getCycbBTCAddress());
    const cyLINK = Address.fromString(network.getCyLINKAddress());
    const cyDOT = Address.fromString(network.getCyDOTAddress());
    const cyUNI = Address.fromString(network.getCyUNIAddress());
    const cyPEPE = Address.fromString(network.getCyPEPEAddress());
    const cyENA = Address.fromString(network.getCyENAAddress());
    const cyARB = Address.fromString(network.getCyARBAddress());
    const cywstETH = Address.fromString(network.getCywstETHAddress());
    const cyXAUt0 = Address.fromString(network.getCyXAUt0Address());
    const cyPYTH = Address.fromString(network.getCyPYTHAddress());

    if (cyToken.equals(cysFLR)) {
        account.cysFLRBalance = account.cysFLRBalance.minus(depositBalance);
    }
    if (cyToken.equals(cyWETH)) {
        account.cyWETHBalance = account.cyWETHBalance.minus(depositBalance);
    }
    if (cyToken.equals(cyFXRP)) {
        account.cyFXRPBalance = account.cyFXRPBalance.minus(depositBalance);
    }
    if (cyToken.equals(cyWBTC)) {
        account.cyWBTCBalance = account.cyWBTCBalance.minus(depositBalance);
    }
    if (cyToken.equals(cycbBTC)) {
        account.cycbBTCBalance = account.cycbBTCBalance.minus(depositBalance);
    }
    if (cyToken.equals(cyLINK)) {
        account.cyLINKBalance = account.cyLINKBalance.minus(depositBalance);
    }
    if (cyToken.equals(cyDOT)) {
        account.cyDOTBalance = account.cyDOTBalance.minus(depositBalance);
    }
    if (cyToken.equals(cyUNI)) {
        account.cyUNIBalance = account.cyUNIBalance.minus(depositBalance);
    }
    if (cyToken.equals(cyPEPE)) {
        account.cyPEPEBalance = account.cyPEPEBalance.minus(depositBalance);
    }
    if (cyToken.equals(cyENA)) {
        account.cyENABalance = account.cyENABalance.minus(depositBalance);
    }
    if (cyToken.equals(cyARB)) {
        account.cyARBBalance = account.cyARBBalance.minus(depositBalance);
    }
    if (cyToken.equals(cywstETH)) {
        account.cywstETHBalance = account.cywstETHBalance.minus(depositBalance);
    }
    if (cyToken.equals(cyXAUt0)) {
        account.cyXAUt0Balance = account.cyXAUt0Balance.minus(depositBalance);
    }
    if (cyToken.equals(cyPYTH)) {
        account.cyPYTHBalance = account.cyPYTHBalance.minus(depositBalance);
    }
    account.save();
    updateTotalsForAccount(
        account,
        oldCysFLR,
        oldCyWETH,
        oldCyFXRP,
        oldCyWBTC,
        oldCycbBTC,
        oldCyLINK,
        oldCyDOT,
        oldCyUNI,
        oldCyPEPE,
        oldCyENA,
        oldCyARB,
        oldCywstETH,
        oldCyXAUt0,
        oldCyPYTH
    );
}

export function createLiquidityV2Change(
    lpAddress: Address,
    owner: Address,
    cyToken: Address,
    lquidity: BigInt,
    value: BigInt,
    blockNumber: BigInt,
    blockTimestamp: BigInt,
    transactionHash: Bytes,
    logIndex: BigInt,
    typ: string,
): void {
    const id = transactionHash.concatI32(logIndex.toI32());
    const item = new LiquidityV2Change(id);
    item.LiquidityChangeType = typ;
    item.blockNumber = blockNumber;
    item.blockTimestamp = blockTimestamp;
    item.transactionHash = transactionHash;
    item.tokenAddress = cyToken;
    item.lpAddress = lpAddress;
    item.owner = owner;
    if (typ === DEPOSIT) {
        item.depositedBalanceChange = value;
        item.liquidityChange = lquidity;
    } else {
        item.depositedBalanceChange = value.neg();
        item.liquidityChange = lquidity.neg();
    }
    item.save();
}

export function createLiquidityV3Change(
    lpAddress: Address,
    owner: Address,
    cyToken: Address,
    lquidity: BigInt,
    value: BigInt,
    blockNumber: BigInt,
    blockTimestamp: BigInt,
    transactionHash: Bytes,
    logIndex: BigInt,
    typ: string,
    tokenId:  BigInt,
): void {
    const id = transactionHash.concatI32(logIndex.toI32());
    const item = new LiquidityV3Change(id);
    item.LiquidityChangeType = typ;
    item.blockNumber = blockNumber;
    item.blockTimestamp = blockTimestamp;
    item.transactionHash = transactionHash;
    item.tokenAddress = cyToken;
    item.lpAddress = lpAddress;
    item.owner = owner;
    item.tokenId = tokenId;
    if (typ === DEPOSIT) {
        item.depositedBalanceChange = value;
        item.liquidityChange = lquidity;
    } else {
        item.depositedBalanceChange = value.neg();
        item.liquidityChange = lquidity.neg();
    }
    item.save();
}
