#!/usr/bin/env node
import prompts from "prompts";
import {
  createDataset,
  getNomicToken,
  getOrganizationSlug,
  saveNomicToken,
} from "./utils.js";

async function main() {
  let token = getNomicToken();

  let apiQuestion: prompts.PromptObject[] = [
    {
      type: "password",
      name: "apiKey",
      message: "What is your API key?",
      validate: (value) => (value.length > 0 ? true : "API key is required"),
    },
  ];

  try {
    if (!token) {
      const apiResponse = await prompts(apiQuestion);
      if (apiResponse.apiKey) {
        saveNomicToken(apiResponse.apiKey);
        token = apiResponse.apiKey;
      }
    } else {
      console.log("Using existing API key from credentials");
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  if (!token) {
    console.error("No API key provided");
    process.exit(1);
  }

  const orgSlug = await getOrganizationSlug();

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
    console.log("Creating dataset...");
    const dataset = await createDataset(response.datasetName);
    console.log(`Dataset created: ${orgSlug}/${dataset.created_dataset.slug}`);
    console.log(
      `Insert the following code into your project to use this dataset:`
    );
    console.log(`\n`);
    console.log(`import { wrapOpenAI } from "@nomic/atlas-observer";`);
    console.log(`\n`);
    console.log(`const client = wrapOpenAI({`);
    console.log(
      `  dataset: "${orgSlug}/${dataset.created_dataset.slug}", // your dataset`
    );
    console.log(`  client: new OpenAI(), // your existing OpenAI client`);
    console.log(`});`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
