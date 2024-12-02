import { useEffect, useState } from 'react';
import store from '../store/store.ts';
import {
  useTonConnectModal,
  useTonAddress,
  useTonConnectUI,
} from '@tonconnect/ui-react';

const API_URL = 'https://tonapi.io/';

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

  const sendTokenTransaction = async (
    toAddress: string,
    tokenAddress: string,
    amount: string
  ) => {
    try {
      const response = await fetch(`${API_URL}/address/${toAddress}/send`, {
        method: 'POST',
        body: JSON.stringify({
          token: tokenAddress,
          amount: amount,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send token');
      }
      return await response.json();
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  };

  const sendTransaction = async (
    toAddress: string,
    amount: string,
    coinSymbol: any
  ) => {
    if (!userAddress) {
      throw new Error('Wallet is not connected');
    }

    const tokenAddress = getTokenAddress(coinSymbol);

    if (tokenAddress) {
      try {
        const result = await sendTokenTransaction(
          toAddress,
          tokenAddress,
          amount
        );
        console.log('Transaction result:', result);
        return result;
      } catch (error) {
        console.error('Failed to send token transaction:', error);
        throw error;
      }
    }

    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 600,
      messages: [
        {
          address: toAddress,
          amount: amount,
        },
      ],
    };

    try {
      const result = await tonConnectUI.sendTransaction(transaction);
      console.log('Transaction result:', result);
      return result;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  };

  const getTokenAddress = (
    coinSymbol: 'GM' | 'ARBUZ' | 'KINGYTON' | 'DFC' | 'M5'
  ): string | null => {
    const tokenAddresses: {
      [key in 'GM' | 'ARBUZ' | 'KINGYTON' | 'DFC' | 'M5']: string;
    } = {
      GM: '0:7d7b64496899d7fed00b0c14b221be688f460724b6bc16772c17ee4c8d7a256d',
      ARBUZ:
        '0:0cd8a583a7d94dd18bf1bdf49b234af28c15f033bd2b6a4a4d2076ee1136ad45',
      KINGYTON:
        '0:beb5d4638e860ccf7317296e298fde5b35982f4725b0676dc98b1de987b82ebc',
      DFC: '0:f6eb371de82aa9cfb5b22ca547f31fdc0fa0fbb41ae89ba84a73272ff0bf2157',
      M5: '0:5ae8ea1f738bd06755d92d361191b5f8a965160427f4b05060a3491dc5d970ea',
    };

    return tokenAddresses[coinSymbol] || null;
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