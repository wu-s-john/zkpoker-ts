import { PlayerRoomConfig } from './PlayerRoomConfig';

export interface RoomConfig {
    big_blind: bigint;
    big_blind_seat: number;
    small_blind: bigint;
    small_blind_seat: number;
    dealer_seat: number;
    min_stack: bigint;
    seats: number;
    room_id: number;
    joined_users: PlayerRoomConfig[];
    num_joined_users: number;
    game_state_manager_address: string;
} 