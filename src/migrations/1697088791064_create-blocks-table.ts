/* eslint-disable @typescript-eslint/naming-convention */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('blocks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    slot: {
      type: 'integer',
      notNull: true,
    },
    proposer_index: {
      type: 'integer',
      notNull: true,
    },
    timestamp: {
      type: 'integer',
      notNull: true,
    }
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('validators');
}
