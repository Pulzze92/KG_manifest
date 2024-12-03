import { useEffect, useState } from 'react';
import store from '../store/store.ts';
import {
  useTonConnectModal,
  useTonAddress,
  useTonConnectUI,
} from '@tonconnect/ui-react';
import { beginCell, toNano, Address } from 'ton-core';

const API_URL = 'https://tonapi.io/';

export const useTonConnect = () => {
  const { state, open, close } = useTonConnectModal();
  const userFriendlyAddress = useTonAddress();
  const rawAddress = useTonAddress(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [tonConnectUI] = useTonConnectUI();

  const setConnected = store.useTonConnectStore((store) => store.setConnected);
  const setAddress = store.useTonConnectStore((store) => store.setAddress);
  const setUser = store.useTonConnectStore((store) => store.setUser);
  const disconnectFromStore = store.useTonConnectStore(
    (store) => store.disconnect
  );

  const fetchAccount = store.useAccountStore((store) => store.fetchAccount);
  const createAccount = store.useAccountStore((store) => store.createAccount);

  useEffect(() => {
    if (userFriendlyAddress) {
      if (userAddress !== userFriendlyAddress) {
        setUserAddress(rawAddress);
        setAddress(userFriendlyAddress);
        setConnected(true);
      }
    }
  }, [
    rawAddress,
    userFriendlyAddress,
    userAddress,
    setAddress,
    setConnected,
    setUser,
    fetchAccount,
    createAccount,
  ]);

  const disconnect = async () => {
    await tonConnectUI.disconnect();
    disconnectFromStore();
  };

  const fetchTokenBalance = async (address: string, jettonId: string) => {
    try {
      const response = await fetch(
        `${API_URL}/v2/accounts/${address}/jettons/${jettonId}`
      );
      const data = await response.json();
      return data.balance;
    } catch (error) {
      console.error('Failed to fetch token balance:', error);
      return '0';
    }
  };

  const sendTransaction = async (
    toAddress: string,
    amount: string,
    tokenAddress: string
  ) => {
    if (!userAddress) {
      throw new Error('Wallet is not connected');
    }

    if (!tokenAddress) {
      throw new Error(`Unknown token address: ${tokenAddress}`);
    }

    try {
      const jettonWalletAddress = await getJettonWalletAddress(
          tokenAddress,
        userAddress
      );

      const destinationAddress = Address.parse(toAddress);

      const forwardPayload = beginCell()
        .storeUint(0, 32)
        .storeStringTail('$WP')
        .endCell();

      const messageBody = beginCell()
        .storeUint(0x0f8a7ea5, 32)
        .storeUint(0, 64)
        .storeCoins(toNano(amount))
        .storeAddress(destinationAddress)
        .storeAddress(destinationAddress)
        .storeBit(0)
        .storeCoins(toNano('0.01'))
        .storeBit(1)
        .storeRef(forwardPayload)
        .endCell();

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: jettonWalletAddress.toString(),
            amount: toNano('0.06').toString(),
            payload: messageBody.toBoc().toString('base64'),
          },
        ],
      };

      const result = await tonConnectUI.sendTransaction(transaction);
      console.log('Transaction result:', result);
      return result;
    } catch (error) {
      console.error('Failed to send jetton transaction:', error);
      throw error;
    }
  };

  const getJettonWalletAddress = async (
    userWallet: string,
    tokenMaster: string
  ) => {
    try {
      const url = `${API_URL}/v2/blockchain/accounts/${tokenMaster}/methods/get_wallet_address?args=${userWallet}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch Jetton Wallet address');
      }

      const data = await response.json();
      return Address.parse(data.decoded.jetton_wallet_address);
    } catch (error) {
      console.error('Failed to get Jetton Wallet Address:', error);
      throw error;
    }
  };

  return {
    state,
    open,
    close,
    address: userAddress,
    disconnect,
    sendTransaction,
    fetchTokenBalance,
  };
};
