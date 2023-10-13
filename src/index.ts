import * as dotenv from "dotenv";
dotenv.config();

import { Client } from "pg";
import connect from "./database";

import validatorFunctions from "./validator";
const { createValidator, getMaxValidatorIndex } = validatorFunctions;
import blockFunctions from "./block";
const { createBlock, getMaxSlotNumber, getMaxTimestamp } = blockFunctions;


const BLOCK_TIME = 12;
const BLOCKS_PER_EPOCH = 32;
const FINALIZED_EPOCH_COUNT = 2;
const TRAILING_CONSTANT = FINALIZED_EPOCH_COUNT * BLOCKS_PER_EPOCH * BLOCK_TIME * 1000;
const LOOP_RATE = BLOCK_TIME * 1000;

async function start(client: Client) {
  let currentValidatorIndex = 0;
  let maxValidatorIndex = await getMaxValidatorIndex(client);
  if (maxValidatorIndex !== null) currentValidatorIndex = maxValidatorIndex + 1;

  let currentSlotNumber = 0;
  let maxSlotNumber = await getMaxSlotNumber(client);
  if (maxSlotNumber !== null) currentSlotNumber = maxSlotNumber + 1;

  while (true) {
    const currentTime = Date.now() / 1000;
    const threshold = currentTime - TRAILING_CONSTANT;
    const latestBlockTime = await getMaxTimestamp(client)

    if (latestBlockTime === null || latestBlockTime < threshold - BLOCK_TIME) {
      console.log(`validator ${currentValidatorIndex}, slotNumber ${currentSlotNumber}`);
      let validator = await createValidator(client, currentValidatorIndex, currentSlotNumber);
      if (validator === null) {
        await createBlock(client, currentSlotNumber);
        currentSlotNumber = currentSlotNumber + 1;
        continue;
      } else {
        currentValidatorIndex = currentValidatorIndex + 1;
      }
    } else {
      console.log('waiting for a block to pass');
      await new Promise(resolve => setTimeout(resolve, LOOP_RATE));
    }
  }
}

connect(async client => {
  return start(client)
});
