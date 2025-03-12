import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

// Environment variables and network configuration
export const ALEO_NETWORK_URL = process.env.ALEO_NETWORK_URL || 'http://localhost:3030';
export const MASTER_PRIVATE_KEY = process.env.MASTER_PRIVATE_KEY;
console.log("Master private key:", MASTER_PRIVATE_KEY);

// Game configuration
export const GAME_CONFIG = {
    DEFAULT_BIG_BLIND: BigInt(100),
    DEFAULT_SMALL_BLIND: BigInt(50),
    DEFAULT_MIN_STACK: BigInt(1000),
    DEFAULT_SEATS: 4,
    DEFAULT_PLAYER_BET: BigInt(200),
    DEFAULT_FUNDING_AMOUNT: parseInt(process.env.DEFAULT_FUNDING_AMOUNT || '1000'),
} as const;

// Transaction configuration
export const TX_CONFIG = {
    DEFAULT_FEE: 0.02,
    DEFAULT_PRIVATE_FEE: false,
} as const;

// Program IDs
export const PROGRAM_IDS = {
    ROOM_MANAGER: 'room_manager.aleo',
    CREDITS: 'credits.aleo',
} as const;

// Function names
export const FUNCTION_NAMES = {
    CREATE_ROOM: 'rm_create_room',
    JOIN_ROOM: 'rm_join_room',
    REQUEST_GAME_CREATION: 'rm_request_game_creation',
} as const;

// Transfer types
export const TRANSFER_TYPES = {
    PRIVATE: 'transfer_private',
    PUBLIC: 'transfer_public',
    PRIVATE_TO_PUBLIC: 'transfer_private_to_public',
    PUBLIC_TO_PRIVATE: 'transfer_public_to_private',
} as const; 