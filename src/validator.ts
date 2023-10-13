import { Client } from "pg";
import http from 'http';
import https from 'https';

export interface IValidator {
  index: number;
  publicKey: string;
  activationEpoch: number | null;
  exitEpoch: number;
  atSlot: number;
}

interface IDBValidator {
  index: number;
  public_key: string;
  activation_epoch: number | null;
  exit_epoch: number;
  at_slot: number;
}

const createValidator = async (client: Client, index: number, atSlot: number): Promise<IValidator | null> => {
  let dbValidator = await loadFromDatabase(client, index);

  let validator: IValidator | null = null;

  if (dbValidator) {
    validator = hydrateValidator(dbValidator);
  } else {
    validator = await fetchFromAPI(index, atSlot);

    if (validator) {
      await saveToDatabase(client, validator);
    } else {
      return null;
    }
  }

  return validator;
}

const hydrateValidator = (dbValidator: IDBValidator): IValidator => {
  return {
    index: dbValidator.index,
    publicKey: dbValidator.public_key,
    activationEpoch: dbValidator.activation_epoch,
    exitEpoch: dbValidator.exit_epoch,
    atSlot: dbValidator.at_slot,
  }
}

const loadFromDatabase = async (client: Client, index: number): Promise<IDBValidator | null> => {
  try {
    const result = await client.query<IDBValidator>('SELECT * FROM validators WHERE index = $1', [index]);
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error fetching data from database:', err);
    return null;
  }
}

const saveToDatabase = async (client: Client, validator: IValidator): Promise<void> => {
  try {
    await client.query('INSERT INTO validators(public_key, index, activation_epoch, exit_epoch, at_slot) VALUES($1, $2, $3, $4, $5)', [validator.publicKey, validator.index, validator.activationEpoch, validator.exitEpoch, validator.atSlot]);
  } catch (err) {
    console.error('Error saving to the database:', err);
  }
}

const fetchFromAPI = async (index: number, atSlot: number): Promise<IValidator | null> => {
  const options = {
    protocol: process.env.CL_PROTOCOL,
    hostname: process.env.CL_HOSTNAME,
    port: process.env.CL_PORT,
    path: `/eth/v1/beacon/states/${atSlot}/validators/${index}`,
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

  return new Promise<IValidator | null>((resolve, reject) => {
    let data = '';
    const request = httphttps.request(options, response => {
      // const request = http.request(options, response => {
      // Set the encoding, so we don't get log to the console a bunch of gibberish binary data
      response.setEncoding('utf8');

      if (response.statusCode) {
        if (response.statusCode === 404) {
          console.log(`Validator ${index} at slot ${atSlot} not found`);
          resolve(null);
        } else if (response.statusCode < 200 || response.statusCode > 299) {
          console.log(`Failed to fetch validator ${index} from CL at slot ${atSlot}, status code: ${response.statusCode}`)
          reject();
        }
      }

      // As data starts streaming in, add each chunk to "data"
      response.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      response.on('end', () => {
        const jsonData = JSON.parse(data);
        resolve({
          index: jsonData.data.index,
          publicKey: jsonData.data.validator.pubkey,
          activationEpoch: jsonData.data.validator.activation_epoch === "18446744073709551615" ? 0 : jsonData.data.validator.activation_epoch,
          exitEpoch: jsonData.data.validator.exit_epoch === "18446744073709551615" ? null : jsonData.data.validator.exit_epoch,
          atSlot: atSlot,
        });
      });
    });

    // Log errors if any occur
    request.on('error', (error) => {
      console.error(error);
      reject();
    });

    // End the request
    request.end();
  });
}

const getMaxValidatorIndex = async (client: Client): Promise<number | null> => {
  try {
    const result = await client.query<{ max: number }>('SELECT MAX(index) FROM validators;')
    return result.rows[0].max;
  } catch (err) {
    console.error('Error getting max validator index number');
    return null;
  }
}

export default {
  createValidator,
  getMaxValidatorIndex,
};
