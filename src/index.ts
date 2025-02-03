import fs from "fs";
import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";

enum AddressesType {
  Ethereum = "ethereum",
  Solana = "solana",
}

type Address = {
  type: AddressesType;
  value: string;
};

function isEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

async function getTokenUsdPrice(token: string): Promise<number> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=usd`
    );
    const data = await response.json();
    if (data[token]) {
      return data[token].usd;
    } else {
      console.log("coingecko api trouble, try use script later");
      return 0;
    }
  } catch (error) {
    console.error("getTokenUsdPrice error ->", error);
    return 0;
  }
}

function parseAddresses(filePath: string): Address[] {
  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const lines = fileContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines
      .map((address) => {
        if (isEthereumAddress(address))
          return { value: address, type: AddressesType.Ethereum };
        if (isSolanaAddress(address))
          return { value: address, type: AddressesType.Solana };
        else {
          console.warn(`address ${address} !== sol or eth`);
          return null;
        }
      })
      .filter((address) => address !== null);
  } catch (error) {
    console.error("parseAddresses error ->", error);
    return [];
  }
}

async function printBalances(addresses: Address[]) {
  const providerEth = new ethers.JsonRpcProvider("https://rpc.ankr.com/eth");
  const connectionSol = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  let totalCostUsd = 0;

  for (const [index, address] of addresses.entries()) {
    if (address.type == AddressesType.Ethereum) {
      const balanceEth = await providerEth.getBalance(address.value);
      const ethToUsd = await getTokenUsdPrice(address.type);
      const balanceEthString = ethers.formatEther(balanceEth);
      const balanceUsd = parseFloat(balanceEthString) * ethToUsd;
      totalCostUsd += balanceUsd;

      // prettier-ignore
      console.log(`${index + 1}. ${address.value} (${address.type}): ${balanceEthString} $ETH or $${balanceUsd.toFixed(5)}`);
      continue;
    }

    if (address.type == AddressesType.Solana) {
      const publicKey = new PublicKey(address.value);
      const balanceSol = (await connectionSol.getBalance(publicKey)) / 1e9;
      const solToUsd = await getTokenUsdPrice(address.type);
      const balanceUsd = balanceSol * solToUsd;
      totalCostUsd += balanceUsd;

      // prettier-ignore
      console.log(`${index + 1}. ${address.value} (${address.type}): ${balanceSol} $SOL or $${balanceUsd.toFixed(5)}`);
      continue;
    }
  }
  console.log(`---\ntotal: $${totalCostUsd.toFixed(5)}`);
}

async function main() {
  printBalances(parseAddresses("addresses.txt"));
}

main();
