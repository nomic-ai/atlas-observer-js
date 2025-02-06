#!/usr/bin/env node
import prompts from "prompts";
import {
  createDataset,
  defaultApiUrl,
  getNomicCredentials,
  getOrganizationSlug,
  saveNomicCredentials,
} from "./utils.js";

async function main() {
  let credentials = getNomicCredentials();

  let apiQuestion: prompts.PromptObject[] = [
    {
      type: "password",
      name: "apiKey",
      message:
        "Enter your Atlas API key - can be generated at https://atlas.nomic.ai/cli-login",
      validate: (value) => (value.length > 0 ? true : "API key is required"),
    },
  ];

  try {
    if (!credentials) {
      const apiResponse = await prompts(apiQuestion);
      if (apiResponse.apiKey) {
        credentials = saveNomicCredentials(apiResponse.apiKey);
      }
    } else {
      // console.log("Using existing API key from credentials");
      if (credentials.apiUrl && credentials.apiUrl !== defaultApiUrl) {
        console.log(`Note: Using non-default API URL: ${credentials.apiUrl}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  if (!credentials) {
    console.error("No API key provided");
    process.exit(1);
  }

  const orgSlug = await getOrganizationSlug(credentials);

  console.log(`Dataset will be created in organization "${orgSlug}"`);

  let questions: prompts.PromptObject[] = [];
  questions.push({
    type: "text",
    name: "datasetName",
    message: "What should the dataset be named?",
    validate: (value) => (value.length > 0 ? true : "Dataset name is required"),
  });

  try {
    const response = await prompts(questions);
    if (!response.datasetName) {
      console.error("Dataset name is required");
      process.exit(1);
    }
    console.log("Creating dataset...");
    const dataset = await createDataset(response.datasetName, credentials);
    console.log(`Dataset created: ${orgSlug}/${dataset.created_dataset.slug}`);
    console.log(
      `Insert the following code into your project to use this dataset:`
    );
    console.log(`\n`);
    console.log(`import { wrapOpenAI } from "@nomic/atlas-observer";`);
    console.log(`\n`);
    console.log(`const client = wrapOpenAI({`);
    console.log(
      `  datasetId: "${dataset.created_dataset.project_id}", // your dataset ID`
    );
    console.log(`  client: new OpenAI(), // your existing OpenAI client`);
    console.log(`});`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
