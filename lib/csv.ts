import { stringify } from "csv-stringify/sync";

export function toCsv<T extends Record<string, unknown>>(rows: T[], delimiter = ",") {
  return stringify(rows, {
    header: true,
    delimiter
  });
}
