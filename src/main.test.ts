import { test, expect } from "vitest";
import { wrapOpenAI } from "./openai";
import OpenAI from "openai";
import { createDataset, getNomicCredentials } from "./utils";
import { AtlasDataset, AtlasViewer } from "@nomic-ai/atlas";

test("upload datapoints", async () => {
  const name = `atlas-observer-test-${new Date().toISOString()}`;
  const creds = getNomicCredentials();
  if (!creds) {
    throw new Error("Nomic creds not found");
  }
  const {
    created_dataset: {
      project_id: datasetId,
    },
  } = await createDataset(name, creds);
  const client = wrapOpenAI({
    client: new OpenAI(),
    datasetId,
  });
  await Promise.all(Array.from({ length: 25 }, async () => {
    await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello!" }],
      max_tokens: 200,
    });
  }));
  // Wait for any background uploads to complete.
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const viewer = new AtlasViewer({ apiKey: creds.token, apiLocation: creds.apiUrl });
  const dataset = await new AtlasDataset(datasetId, viewer).withLoadedAttributes();
  expect(dataset.attr.total_datums_in_project).toEqual(25);
  await dataset.delete();
}, { timeout: 60000 });
