import {
  DataType,
  float32,
  Schema,
  tableFromArrays,
  tableToIPC,
  timestamp,
  TimeUnit,
  utf8,
} from "@uwdata/flechette";
import {
  getDatasetSchema,
  getNomicCredentials,
  NomicCredentials,
} from "./utils";
import { AtlasViewer } from "@nomic-ai/atlas";
import { ulid } from "ulid";

export class AtlasObserver {
  datasetId: string;
  credentials: NomicCredentials;
  datasetSchema: Promise<Schema | null>;

  constructor({ datasetId }: { datasetId: string }) {
    this.datasetId = datasetId;
    const creds = getNomicCredentials();
    if (!creds) {
      throw new Error("Nomic credentials not found");
    }
    this.credentials = creds;
    this.datasetSchema = getDatasetSchema(datasetId, creds);
  }

  /**
   * Send one or more datapoints to Atlas
   */
  async observe(data: Record<string, unknown> | Record<string, unknown>[]) {
    const schema = await this.datasetSchema;
    // If no schema, then this is the first datapoint, and we should allow it
    // but once its finished uploading we should re-request the schema
    // for future datapoints

    await this.uploadDatapoint(data, schema);

    // If no schema existed, refresh it after upload
    if (!(await this.datasetSchema)) {
      console.log("refreshing schema");
      this.datasetSchema = getDatasetSchema(this.datasetId, this.credentials);
    }
  }

  async uploadDatapoint(
    data: Record<string, unknown> | Record<string, unknown>[],
    schema: Schema | null
  ): Promise<void> {
    const points = Array.isArray(data) ? data : [data];
    const columnData = Object.fromEntries(
      Object.keys(points[0]).map((k) => [
        k,
        points.map((p) => p[k as keyof typeof p]),
      ])
    );

    columnData["_internal_id"] = points.map(() => ulid());
    const types: Record<string, DataType> = {};

    const extraneousColumns: string[] = [];

    if (!schema) {
      // If no schema, this is the first datapoint. We need to determine the right type
      // for each column given our constraints
      for (const key in columnData) {
        const value = columnData[key][0];
        if (typeof value === "string") {
          types[key] = utf8();
        } else if (typeof value === "number") {
          types[key] = float32();
        } else if (typeof value === "boolean") {
          types[key] = utf8();
        } else if (value === null) {
          types[key] = utf8();
        } else if (value instanceof Date) {
          types[key] = timestamp(TimeUnit.MILLISECOND);
        } else if (typeof value === "object") {
          types[key] = utf8();
        } else if (Array.isArray(value)) {
          types[key] = utf8();
        } else {
          types[key] = utf8();
        }
      }
    } else {
      // If schema exists, we need to check if the types are compatible,
      // and coerce what we can
      for (const key in columnData) {
        const schemaType = schema.fields.find((f) => f.name === key)?.type;
        if (schemaType === undefined) {
          extraneousColumns.push(key);
        } else {
          types[key] = schemaType;
        }
      }
    }

    for (const key of extraneousColumns) {
      delete columnData[key];
      // TODO: Log that we are dropping this column
    }

    const table = tableFromArrays(columnData, {
      types,
    });

    if (!table.schema.metadata) {
      table.schema.metadata = new Map();
    }

    table.schema.metadata.set("project_id", this.datasetId);
    table.schema.metadata.set("on_id_conflict_ignore", "true");

    const ipc = tableToIPC(table, { format: "file" });

    const viewer = new AtlasViewer({
      apiKey: this.credentials.token,
      apiLocation: this.credentials.apiUrl,
    });

    try {
      await viewer.apiCall(`/v1/project/data/add/arrow`, "POST", ipc);
    } catch (e) {
      console.error(e);
    }
  }
}
