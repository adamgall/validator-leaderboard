import { Client } from 'pg';
import http from 'http';
import https from 'https';

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
    let block = await fetchFromAPI(slot);

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

const fetchFromAPI = async (slotNumber: number): Promise<IBlock | null> => {
  const options = {
    protocol: process.env.CL_PROTOCOL,
    hostname: process.env.CL_HOSTNAME,
    port: process.env.CL_PORT,
    path: `/eth/v2/beacon/blocks/${slotNumber}`,
    method: 'GET',
    headers: {
      'accept': 'application/json',
    },
  };

  const httphttps = {
    request: (
      options: http.RequestOptions,
      callback?: ((res: http.IncomingMessage) => void) | undefined): http.ClientRequest => {
      if (options.protocol === "https:") {
        return https.request(options, callback);
      } else {
        return http.request(options, callback)
      }
    }
  }

  return new Promise<IBlock | null>((resolve, reject) => {
    const request = httphttps.request(options, response => {
      response.setEncoding('utf8');

      if (response.statusCode) {
        if (response.statusCode === 404) {
          console.log(`Block ${slotNumber} missed`);
          resolve({
            slot: slotNumber,
            proposerIndex: 0,
            timestamp: slotToTimestamp(slotNumber),
          });
        } else if (response.statusCode < 200 || response.statusCode > 299) {
          console.log(`Failed to fetch block ${slotNumber} from CL, status code: ${response.statusCode}`)
          reject();
        }
        return;
      }

      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        const jsonData = JSON.parse(data);
        resolve({
          slot: jsonData.data.message.slot,
          proposerIndex: jsonData.data.message.proposer_index,
          timestamp: slotToTimestamp(slotNumber)
        });
      });
    });

    request.on('error', (error) => {
      console.error(error);
      reject();
    });

    request.end();
  });
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
