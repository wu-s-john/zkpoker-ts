import { Account, ProgramManager, AleoKeyProvider, NetworkRecordProvider, AleoNetworkClient } from '@provablehq/sdk';
import { TRANSFER_TYPES, TX_CONFIG } from '../constants';

export interface GameWallets {
    alice: Account;
    bob: Account;
    carol: Account;
    david: Account;
    roomManager: Account;
    dealer: Account;
    gameStateManager: Account;
}

export class WalletSetup {
    private programManager: ProgramManager;
    private masterAccount: Account;

    constructor(nodeUrl: string, masterPrivateKey: string) {
        console.log("Node URL:", nodeUrl);
        const networkClient = new AleoNetworkClient(nodeUrl);

        const keyProvider = new AleoKeyProvider();
        keyProvider.useCache(true);

        this.masterAccount = new Account({ privateKey: masterPrivateKey });
        const recordProvider = new NetworkRecordProvider(this.masterAccount, networkClient);

        this.programManager = new ProgramManager(
            nodeUrl, 
            keyProvider, 
            recordProvider,
            
        );
        this.programManager.setAccount(this.masterAccount);
    }

    async getPublicBalance(address: string): Promise<number> {
        try {
            const balanceString = await this.programManager.networkClient.getProgramMappingValue(
                "credits.aleo", 
                "account", 
                address
            );
            
            // Remove the 'u64' suffix and convert to number
            const cleanedBalance = balanceString.replace('u64', '');
            return parseInt(cleanedBalance);
        } catch (error) {
            console.error("Error fetching public balance:", error);
            return 0;
        }
    }

    async setupWallets(fundingAmount: number): Promise<GameWallets> {
        const wallets: GameWallets = {
            alice: new Account(),
            bob: new Account(),
            carol: new Account(),
            david: new Account(),
            roomManager: new Account(),
            dealer: new Account(),
            gameStateManager: new Account()
        };

        const balance = await this.getPublicBalance(this.masterAccount.address().to_string())
        console.log("Balance:", balance);
    
        // Fund each wallet with delay between transfers
        for (const [name, wallet] of Object.entries(wallets)) {
            try {

                console.log("Tryin to run a transfer")
                const txId = await this.programManager.transfer(
                    fundingAmount,
                    wallet.address().to_string(),
                    TRANSFER_TYPES.PRIVATE,
                    TX_CONFIG.DEFAULT_FEE,
                    TX_CONFIG.DEFAULT_PRIVATE_FEE
                );
                console.log(`Funded ${name} wallet with ${fundingAmount} credits. Transaction ID: ${txId}`);
                
                // Add delay between transfers to allow garbage collection
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`Failed to fund ${name} wallet:`, error);
                throw error;
            }
        }
    
        return wallets;
    }
} 