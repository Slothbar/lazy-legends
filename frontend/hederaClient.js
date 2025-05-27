// frontend/hederaClient.js
import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";

/**
 * @param {"testnet"|"mainnet"} network
 * @param {string} operatorId  Hedera account e.g. "0.0.12345"
 * @param {string} operatorKey private key string
 */
export function createHederaClient(network, operatorId, operatorKey) {
  const client = Client.forName(network);
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  return client;
}
