/* eslint-disable @typescript-eslint/naming-convention */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('validators', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    public_key: {
      type: 'char(98)',
      notNull: true,
    },
    index: {
      type: 'integer',
      notNull: true,
    },
    activation_epoch: {
      type: 'integer',
      notNull: true,
    },
    exit_epoch: {
      type: 'integer',
      notNull: false,
    },
    at_slot: {
      type: 'integer',
      notNull: true
    }
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('validators');
}
