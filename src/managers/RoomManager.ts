import { Account, ProgramManager, AleoKeyProvider, NetworkRecordProvider, AleoNetworkClient, Transaction } from '@provablehq/sdk';
import { RoomConfig } from '../types/RoomConfig';
import { RoomConfigRequest } from '../types/RoomConfigRequest';
import { HouseDealerCreateDeckRequest } from '../types/HouseDealerCreateDeckRequest';
import { PROGRAM_IDS, FUNCTION_NAMES, TX_CONFIG } from '../constants';
import { RecordWithCiphertext } from '../types/RecordWithCiphertext';
import { retry, RetryOptions } from '../utils/retry';

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffFactor: 2,
    shouldRetry: (error: any) => {
        // Add specific error types that should trigger a retry
        // For now, retry on any error
        return true;
    }
};

export interface ExecutionOutput {
    transaction: Transaction;
    outputs: {
        roomConfig?: RoomConfig;
        records?: RecordWithCiphertext<any>[];
    };
}

export class RoomManager {
    private programManager: ProgramManager;
    private networkClient: AleoNetworkClient;
    private programId: string = PROGRAM_IDS.ROOM_MANAGER;

    constructor(nodeUrl: string) {
        this.networkClient = new AleoNetworkClient(nodeUrl);
        const keyProvider = new AleoKeyProvider();
        keyProvider.useCache(true);

        this.programManager = new ProgramManager(nodeUrl, keyProvider);
    }

    setAccount(account: Account) {
        const recordProvider = new NetworkRecordProvider(account, this.networkClient);
        this.programManager = new ProgramManager(
            this.networkClient.host,
            this.programManager.keyProvider,
            recordProvider
        );
        this.programManager.setAccount(account);
    }

    private async waitForTransaction(txId: string): Promise<Transaction> {
        return retry(
            async () => {
                const tx = await this.networkClient.getTransaction(txId);
                if (!tx.execution?.transitions[0]?.outputs) {
                    throw new Error('Transaction not yet confirmed');
                }
                return tx;
            },
            DEFAULT_RETRY_OPTIONS
        );
    }

    async createRoom(
        account: Account,
        bigBlind: bigint,
        smallBlind: bigint,
        minStack: bigint,
        seats: number,
        hostPlayerBet: bigint,
        fee: number = TX_CONFIG.DEFAULT_FEE
    ): Promise<RoomConfig> {
        try {
            this.setAccount(account);
            const inputs = [
                `${bigBlind.toString()}u64`,
                `${smallBlind.toString()}u64`, 
                `${minStack.toString()}u64`,
                `${seats.toString()}u8`,
                `${hostPlayerBet.toString()}u64`
            ];

            // Build the transaction first
            const transaction = await this.programManager.buildExecutionTransaction({
                programName: this.programId,
                functionName: FUNCTION_NAMES.CREATE_ROOM,
                inputs,
                fee,
                privateFee: TX_CONFIG.DEFAULT_PRIVATE_FEE,
                privateKey: account.privateKey().to_string()
            });

            // Execute the transaction
            const txId = await this.networkClient.submitTransaction(transaction);
            console.log('Room creation transaction ID:', txId);
            
            // Wait for the transaction with retry mechanism
            const tx = await this.waitForTransaction(txId);
            
            // Extract the room config from the execution outputs (struct)
            const roomConfigOutput = tx.execution.transitions[0].outputs[0];
            if (!roomConfigOutput || !roomConfigOutput.value) {
                throw new Error('Failed to get room config output from transaction');
            }
            
            return this.parseRoomConfigFromOutput(roomConfigOutput);
        } catch (error) {
            console.error('Failed to create room:', error);
            throw error;
        }
    }

    async joinRoom(
        account: Account,
        roomId: number,
        playerBet: bigint,
        fee: number = TX_CONFIG.DEFAULT_FEE
    ): Promise<void> {
        try {
            this.setAccount(account);
            const inputs = [
                roomId.toString() + 'u32',
                playerBet.toString() + 'u64'
            ];

            // Build the transaction first
            const transaction = await this.programManager.buildExecutionTransaction({
                programName: this.programId,
                functionName: FUNCTION_NAMES.JOIN_ROOM,
                inputs,
                fee,
                privateFee: TX_CONFIG.DEFAULT_PRIVATE_FEE,
                privateKey: account.privateKey().to_string()
            });

            // Execute the transaction
            const txId = await this.networkClient.submitTransaction(transaction);
            console.log('Room join transaction ID:', txId);

            // Wait for the transaction with retry mechanism
            await this.waitForTransaction(txId);
        } catch (error) {
            console.error('Failed to join room:', error);
            throw error;
        }
    }

    async requestGameCreation(
        account: Account,
        roomId: number,
        roomConfig: RoomConfig,
        dealerAddress: string,
        fee: number = TX_CONFIG.DEFAULT_FEE
    ): Promise<{
        roomConfigRequest: RecordWithCiphertext<RoomConfigRequest>,
        deckRequest: RecordWithCiphertext<HouseDealerCreateDeckRequest>,
        transaction: Transaction
    }> {
        try {
            this.setAccount(account);
            const roomConfigInput = this.serializeRoomConfig(roomConfig);
            
            const inputs = [
                `${roomId}u32`,
                roomConfigInput,
                dealerAddress
            ];

            // Build the transaction first
            const transaction = await this.programManager.buildExecutionTransaction({
                programName: this.programId,
                functionName: FUNCTION_NAMES.REQUEST_GAME_CREATION,
                inputs,
                fee,
                privateFee: TX_CONFIG.DEFAULT_PRIVATE_FEE,
                privateKey: account.privateKey().to_string()
            });

            // Execute the transaction
            const txId = await this.networkClient.submitTransaction(transaction);
            console.log('Game creation request transaction ID:', txId);

            // Wait for the transaction with retry mechanism
            const tx = await this.waitForTransaction(txId);
            
            // Extract the outputs
            const outputs = tx.execution.transitions[0].outputs;
            if (!outputs || outputs.length < 2) {
                throw new Error('Failed to get outputs from transaction');
            }

            const roomConfigRequestOutput = outputs[0];
            const deckRequestOutput = outputs[1];

            if (!roomConfigRequestOutput.value || !deckRequestOutput.value) {
                throw new Error('Missing output values in transaction');
            }

            return {
                roomConfigRequest: {
                    data: {
                        room_id: roomId,
                        room_config: roomConfig,
                        owner: dealerAddress
                    },
                    ciphertext: roomConfigRequestOutput.value
                },
                deckRequest: {
                    data: {
                        owner: dealerAddress,
                        room_id: roomId,
                        player_addresses: roomConfig.joined_users.map(u => u.player_address)
                    },
                    ciphertext: deckRequestOutput.value
                },
                transaction: tx
            };
        } catch (error) {
            console.error('Failed to request game creation:', error);
            throw error;
        }
    }

    async getRoom(roomId: number): Promise<RoomConfig | null> {
        try {
            const value = await retry(
                async () => this.networkClient.getProgramMappingValue(
                    this.programId,
                    'rooms',
                    roomId.toString() + 'u32'
                ),
                DEFAULT_RETRY_OPTIONS
            );
            
            if (!value) {
                return null;
            }

            return this.deserializeRoomConfig(value);
        } catch (error) {
            console.error('Failed to get room:', error);
            throw error;
        }
    }

    private parseRoomConfigFromOutput(output: any): RoomConfig {
        if (!output || !output.value) {
            throw new Error('Invalid output format');
        }
        return this.deserializeRoomConfig(output.value);
    }

    private serializeRoomConfig(config: RoomConfig): string {
        return JSON.stringify(config);
    }

    private deserializeRoomConfig(value: string): RoomConfig {
        return JSON.parse(value);
    }
} 