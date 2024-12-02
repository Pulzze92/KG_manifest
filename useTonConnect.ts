import { useEffect, useState } from 'react';
import store from '../store/store.ts';
import {
  useTonConnectModal,
  useTonAddress,
  useTonConnectUI,
} from '@tonconnect/ui-react';
import { beginCell, toNano, Address } from 'ton-core';

const API_URL = 'https://tonapi.io';

export const useTonConnect = () => {
  const { state, open, close } = useTonConnectModal();
  const userFriendlyAddress = useTonAddress();
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
        setUserAddress(userFriendlyAddress);
        setAddress(userFriendlyAddress);
        setConnected(true);
      }
    }
  }, [
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
      console.log('Fetched Jetton wallet address:', data);
      return data.decoded.jetton_wallet_address;
    } catch (error) {
      console.error('Failed to get Jetton Wallet Address:', error);
      throw error;
    }
  };

  const createJettonTransferMessage = async (
    userWallet: string,
    amount: string,
    collectorAddress: string
  ) => {
    try {
      // const parsedUserWallet = Address.parse(userWallet);
      const parsedCollectorAddress = Address.parse(collectorAddress);

      const walletAddress = await getJettonWalletAddress(
        userWallet,
        collectorAddress
      );
      console.log('Fetched wallet address:', walletAddress);

      if (!walletAddress) {
        throw new Error('Failed to retrieve Jetton Wallet address.');
      }

      const forwardPayload = beginCell()
        .storeUint(0, 32) // 0 opcode means we have a comment
        .storeStringTail('Hello, TON!')
        .endCell();

      const cell = beginCell()
        .storeUint(0xf8a7ea5, 32)
        .storeUint(0, 64)
        .storeCoins(toNano(5))
        .storeAddress(parsedCollectorAddress)
        .storeAddress(parsedCollectorAddress)
        .storeBit(0)
        .storeCoins(toNano('0.02'))
        .storeBit(1)
        .storeRef(forwardPayload)
        .endCell();

      const boc = cell.toBoc().toString('base64');

      return {
        address: walletAddress,
        payload: boc,
        amount: '1',
      };
    } catch (error) {
      console.error('Failed to create Jetton transfer message:', error);
      throw error;
    }
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
    collectorAddress: string
  ) => {
    if (!userAddress) {
      throw new Error('Wallet is not connected');
    }

    try {
      const message = await createJettonTransferMessage(
        toAddress,
        amount,
        collectorAddress
      );

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: message.address,
            amount: '0',
            payload: message.payload,
          },
        ],
      };

      console.log(transaction);

      const result = await tonConnectUI.sendTransaction(transaction);
      console.log('Jetton transaction result:', result);
      return result;
    } catch (error) {
      console.error('Failed to send Jetton transaction:', error);
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
