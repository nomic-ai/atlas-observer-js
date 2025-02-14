import { test, expect } from "vitest";
import { wrapOpenAI } from "./openai.js";
import OpenAI from "openai";
import { createDataset, getNomicCredentials } from "./utils.js";
import { AtlasDataset, AtlasViewer } from "@nomic-ai/atlas";
import { AtlasObserver } from "./observer.js";

test(
  "upload openai datapoints",
  async () => {
    const name = `atlas-observer-openai-test-${new Date().toISOString()}`;
    const creds = getNomicCredentials();
    if (!creds) {
      throw new Error("Nomic creds not found");
    }
    const {
      created_dataset: { project_id: datasetId },
    } = await createDataset(name, creds);
    const client = wrapOpenAI({
      client: new OpenAI(),
      datasetId,
    });
    await Promise.all(
      Array.from({ length: 25 }, async () => {
        await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Hello!" }],
          max_tokens: 200,
        });
      })
    );
    // Wait for any background uploads to complete.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const viewer = new AtlasViewer({
      apiKey: creds.token,
      apiLocation: creds.apiUrl,
    });
    const dataset = await new AtlasDataset(
      datasetId,
      viewer
    ).withLoadedAttributes();
    expect(dataset.attr.total_datums_in_project).toEqual(25);
    await dataset.delete();
  },
  { timeout: 60000 }
);

test(
  "upload general datapoints",
  async () => {
    const name = `atlas-observer-test-${new Date().toISOString()}`;
    const creds = getNomicCredentials();
    if (!creds) {
      throw new Error("Nomic creds not found");
    }
    const viewer = new AtlasViewer({
      apiKey: creds.token,
      apiLocation: creds.apiUrl,
    });
    const {
      created_dataset: { project_id: datasetId },
    } = await createDataset(name, creds);
    const sampleDatapoint = {
      message: "Hello! This is a test. This is content in a message.",
      priority: "high",
      count: 61,
      is_public: true,
      json_info: {
        name: "test",
        description: "This is a test",
        url: "https://example.com",
      },
      tags: ["test", "example"],
      timestamp: new Date(),
      user_id: "123",
    };
    try {
      const observer = new AtlasObserver({ datasetId });
      // Upload 25 datapoints, with single point uploads
      await Promise.all(
        Array.from({ length: 25 }, async () => {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 2000)
          );
          await observer.observe(sampleDatapoint);
        })
      );
      // Upload 25 datapoints, with batch uploads of 5
      await Promise.all(
        Array.from({ length: 5 }, async () => {
          await observer.observe(
            Array.from({ length: 5 }, () => sampleDatapoint)
          );
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const dataset = await new AtlasDataset(
        datasetId,
        viewer
      ).withLoadedAttributes();
      expect(dataset.attr.total_datums_in_project).toEqual(50);
      await dataset.delete();
    } catch (e) {
      const dataset = await new AtlasDataset(
        datasetId,
        viewer
      ).withLoadedAttributes();
      console.log("deleting", dataset.id);
      await dataset.delete();
      throw e;
    }
  },
  { timeout: 60000 }
);
