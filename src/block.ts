import { Client } from 'pg';
import { getFromAPI } from "./cl-api";

interface IBlock {
  slot: number;
  proposerIndex: number | null;
  timestamp: number;
}

interface IDBBlock {
  slot: number;
  proposer_index: number | null;
  timestamp: number;
}

const GENESIS_TIMESTAMP = 1606824023;

const slotToTimestamp = (input: number): number => {
  return GENESIS_TIMESTAMP + (12 * input);
};

const createBlock = async (client: Client, slot: number): Promise<IBlock> => {
  let dbBlock = await loadFromDatabase(client, slot);

  if (dbBlock) {
    return hydrateBlock(dbBlock);
  } else {
    let block = await getBlockAtSlot(slot);

    if (!block) {
      throw new Error(`Failure trying to get block ${slot}`)
    }

    await saveToDatabase(client, block);
    return block;
  }
}

const hydrateBlock = (dbBlock: IDBBlock): IBlock => {
  return {
    slot: dbBlock.slot,
    proposerIndex: dbBlock.proposer_index,
    timestamp: dbBlock.timestamp,
  }
}

const loadFromDatabase = async (client: Client, index: number): Promise<IDBBlock | null> => {
  try {
    const result = await client.query('SELECT * FROM blocks WHERE slot = $1', [index]);
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error fetching data from database:', err);
    return null;
  }
}

const saveToDatabase = async (client: Client, block: IBlock): Promise<void> => {
  try {
    await client.query('INSERT INTO blocks(slot, proposer_index, timestamp) VALUES($1, $2, $3)', [block.slot, block.proposerIndex, block.timestamp]);
  } catch (err) {
    console.error('Error saving to the database:', err);
  }
}

const jsonDataMapper = (atSlot: number) => (jsonData: any): IBlock | null => {
  if (jsonData === null) {
    return null;
  }

  const validator: IBlock = {
    slot: jsonData.data.message.slot,
    proposerIndex: jsonData.data.message.proposer_index,
    timestamp: slotToTimestamp(atSlot)
  }

  return validator;
}

const getBlockAtSlot = async (atSlot: number): Promise<IBlock | null> => {
  const path = `/eth/v2/beacon/blocks/${atSlot}`
  const [validator] = await getFromAPI<IBlock>(path, jsonDataMapper(atSlot));
  return validator;
}

const getMaxSlotNumber = async (client: Client): Promise<number | null> => {
  try {
    const result = await client.query<{ max: number }>('SELECT MAX(slot) FROM blocks;')
    return result.rows[0].max;
  } catch (err) {
    console.error('Error getting max block slot number');
    return null;
  }
}

const getMaxTimestamp = async (client: Client): Promise<number | null> => {
  try {
    const result = await client.query<{ max: number }>('SELECT MAX(timestamp) FROM blocks;')
    return result.rows[0].max;
  } catch (err) {
    console.error('Error getting max block timestamp');
    return null;
  }
}

export default {
  createBlock,
  getMaxSlotNumber,
  getMaxTimestamp,
};
