import { RoomConfig } from './RoomConfig';

export interface RoomConfigRequest {
    room_id: number;
    room_config: RoomConfig;
    owner: string;  // Aleo address as string
} 