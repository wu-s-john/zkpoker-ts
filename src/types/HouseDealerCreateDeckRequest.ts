export interface HouseDealerCreateDeckRequest {
    owner: string;  // Aleo address as string
    room_id: number;
    player_addresses: string[];  // Array of Aleo addresses
} 