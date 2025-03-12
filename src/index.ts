import './setupFetchPolyfill'; // The polyfill must be loaded *before* you use @provablehq/sdk
import { WalletSetup } from './utils/WalletSetup.js';
import type { GameWallets } from './utils/WalletSetup.js';
import { RoomManager } from './managers/RoomManager.js';
import type { RoomConfig } from './types/RoomConfig.js';
import { ALEO_NETWORK_URL, MASTER_PRIVATE_KEY, GAME_CONFIG } from './constants.js';


async function simulateRoomJoining(
    wallets: GameWallets,
    roomManager: RoomManager,
    config: {
        bigBlind: bigint,
        smallBlind: bigint,
        minStack: bigint,
        seats: number,
        playerBet: bigint
    }
): Promise<{roomId: number, finalRoomState: RoomConfig}> {
    // 1. Alice creates a room
    console.log('Alice creating room...');
    const roomConfig = await roomManager.createRoom(
        wallets.alice,
        config.bigBlind,
        config.smallBlind,
        config.minStack,
        config.seats,
        config.playerBet
    );
    const roomId = roomConfig.room_id;
    console.log(`Room created with ID: ${roomId}`);

    // Verify room was created and Alice is the only player
    let roomState = await roomManager.getRoom(roomId);
    if (!roomState) {
        throw new Error('Room was not created properly');
    }
    console.assert(roomState.num_joined_users === 1, 'Room should have exactly 1 player after creation');
    console.assert(roomState.joined_users[0].player_address === wallets.alice.address().to_string(), 
        'First player should be Alice');

    // 2. Bob joins the room
    console.log('Bob joining room...');
    await roomManager.joinRoom(
        wallets.bob,
        roomId,
        config.playerBet
    );

    // Verify Bob joined
    roomState = await roomManager.getRoom(roomId);
    if (!roomState) {
        throw new Error('Room state lost after Bob joined');
    }
    console.assert(roomState.num_joined_users === 2, 'Room should have exactly 2 players after Bob joins');
    console.assert(roomState.joined_users[1].player_address === wallets.bob.address().to_string(),
        'Second player should be Bob');

    // 3. Carol joins the room
    console.log('Carol joining room...');
    await roomManager.joinRoom(
        wallets.carol,
        roomId,
        config.playerBet
    );

    // Verify Carol joined
    roomState = await roomManager.getRoom(roomId);
    if (!roomState) {
        throw new Error('Room state lost after Carol joined');
    }
    console.assert(roomState.num_joined_users === 3, 'Room should have exactly 3 players after Carol joins');
    console.assert(roomState.joined_users[2].player_address === wallets.carol.address().to_string(),
        'Third player should be Carol');

    // 4. David joins the room
    console.log('David joining room...');
    await roomManager.joinRoom(
        wallets.david,
        roomId,
        config.playerBet
    );

    // Verify David joined and final room state
    roomState = await roomManager.getRoom(roomId);
    if (!roomState) {
        throw new Error('Room state lost after David joined');
    }
    console.assert(roomState.num_joined_users === 4, 'Room should have exactly 4 players after David joins');
    console.assert(roomState.joined_users[3].player_address === wallets.david.address().to_string(),
        'Fourth player should be David');

    // Verify all players have correct bets
    for (let i = 0; i < 4; i++) {
        console.assert(roomState.joined_users[i].bet === config.playerBet,
            `Player ${i} should have the correct bet amount`);
    }

    // 5. Request game creation
    console.log('Requesting game creation...');
    const gameCreation = await roomManager.requestGameCreation(
        wallets.alice,
        roomId,
        roomState,
        wallets.dealer.address().to_string()
    );

    console.log('Game creation completed!');
    console.log('Transaction ID:', gameCreation.transaction.id);
    console.log('Room Config Request:', gameCreation.roomConfigRequest);
    console.log('Deck Request:', gameCreation.deckRequest);

    // Verify game creation request
    console.assert(gameCreation.roomConfigRequest.data.room_id === roomId,
        'Game creation request should have correct room ID');
    console.assert(gameCreation.roomConfigRequest.data.owner === wallets.dealer.address().to_string(),
        'Game creation request should have correct dealer address');
    console.assert(gameCreation.deckRequest.data.player_addresses.length === 4,
        'Deck request should have exactly 4 player addresses');

    return {
        roomId,
        finalRoomState: roomState
    };
}

async function main() {
    if (!MASTER_PRIVATE_KEY) {
        throw new Error('MASTER_PRIVATE_KEY environment variable is required');
    }

    console.log('Setting up wallets...');
    const walletSetup = new WalletSetup(ALEO_NETWORK_URL, MASTER_PRIVATE_KEY);
    const wallets = await walletSetup.setupWallets(GAME_CONFIG.DEFAULT_FUNDING_AMOUNT);

    console.log('Wallets setup:', wallets);
    // Initialize room manager
    const roomManager = new RoomManager(ALEO_NETWORK_URL);

    // Simulate room joining with default configuration
    // try {
    //     const { roomId, finalRoomState } = await simulateRoomJoining(wallets, roomManager, {
    //         bigBlind: GAME_CONFIG.DEFAULT_BIG_BLIND,
    //         smallBlind: GAME_CONFIG.DEFAULT_SMALL_BLIND,
    //         minStack: GAME_CONFIG.DEFAULT_MIN_STACK,
    //         seats: GAME_CONFIG.DEFAULT_SEATS,
    //         playerBet: GAME_CONFIG.DEFAULT_PLAYER_BET
    //     });
    //     console.log('Room joining simulation completed successfully!');
    //     console.log('Final room state:', finalRoomState);
    // } catch (error) {
    //     console.error('Room joining simulation failed:', error);
    //     throw error;
    // }
}

main().catch(console.error); 