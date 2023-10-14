import { Client } from "pg";
import { getFromAPI } from "./cl-api";

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
    validator = await getValidatorAtSlot(index, atSlot);

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

const jsonDataMapper = (atSlot: number) => (jsonData: any): IValidator | null => {
  if (jsonData === null) {
    return null;
  }

  const validator: IValidator = {
    index: jsonData.data.index,
    publicKey: jsonData.data.validator.pubkey,
    activationEpoch: jsonData.data.validator.activation_epoch === "18446744073709551615" ? 0 : jsonData.data.validator.activation_epoch,
    exitEpoch: jsonData.data.validator.exit_epoch === "18446744073709551615" ? null : jsonData.data.validator.exit_epoch,
    atSlot: atSlot,
  }

  return validator;
}

const getValidatorAtSlot = async (index: number, atSlot: number): Promise<IValidator | null> => {
  const path = `/eth/v1/beacon/states/${atSlot}/validators/${index}`;
  const [validator] = await getFromAPI<IValidator>(path, jsonDataMapper(atSlot));
  return validator;
}

const saveToDatabase = async (client: Client, validator: IValidator): Promise<void> => {
  try {
    await client.query('INSERT INTO validators(public_key, index, activation_epoch, exit_epoch, at_slot) VALUES($1, $2, $3, $4, $5)', [validator.publicKey, validator.index, validator.activationEpoch, validator.exitEpoch, validator.atSlot]);
  } catch (err) {
    console.error('Error saving to the database:', err);
  }
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


const isValidatorKnownAtBlock = async (validatorIndex: number, slotNumber: number): Promise<boolean> => {
  return !!(await getValidatorAtSlot(validatorIndex, slotNumber));
}

const findFirsBlockForValidator = async (validatorIndex: number, startingSlotNumber: number): Promise<number | null> => {
  // Start with the modified exponential search
  let lowerBound = startingSlotNumber;
  let upperBound = startingSlotNumber + 1;

  while (!isValidatorKnownAtBlock(validatorIndex, upperBound)) {
    lowerBound = upperBound;
    upperBound = upperBound * 2;
  }

  // Now, do a binary search between lowerBound and upperBound
  while (lowerBound <= upperBound) {
    const mid = Math.floor((lowerBound + upperBound) / 2);

    if (await isValidatorKnownAtBlock(validatorIndex, mid)) {
      upperBound = mid - 1;
    } else {
      lowerBound = mid + 1;
    }
  }

  return lowerBound;
}



export default {
  createValidator,
  getMaxValidatorIndex,
  findFirsBlockForValidator,
};
