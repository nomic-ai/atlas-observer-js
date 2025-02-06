# @nomic-ai/atlas-observer

`atlas-observer` is a library for automatically uploading LLM chat data to Atlas. From there, you can view data maps of the conversations taking place, and more.

This library contains typescript wrapper for OpenAI.

## Quickstart

### Creating an Atlas account

Go to [Nomic Atlas](https://atlas.nomic.ai) and create an account or log in. This is where your dataset will be stored.

### Installation and Authentication

1. Install the library locally:

   `npm install @nomic-ai/atlas-observer`

2. Run the following command to authenticate and create your empty dataset:

   `npx atlas-observer`

   Here you will be prompted to enter your Atlas API key - click the link in the terminal prompt or [here](https://atlas.nomic.ai/cli-login) to create one. This key will be saved to your `~/.nomic/credentials` file.

3. Once your dataset is created, you will see an identifier like this: `my-org/my-llm-chats`. You will need this to set up the library.

### Setting the environment

To allow your application to upload data to Atlas, you will need to set the `NOMIC_API_KEY` environment variable - this is the same key you created in the previous step. Run the following bash command, add it to your `.bashrc` or `.zshrc` file, or set it in your cloud environment.

```
export NOMIC_API_KEY=your-api-key
```

### Adding to your project

Now that the library is installed and your environment is set up, you can add the client wrapper to your project. Wherever you are creating your OpenAI client, wrap it with the `wrapOpenAI` function and pass in your dataset identifier.

```typescript
import { OpenAI } from "openai";
import { wrapOpenAI } from "@nomic-ai/atlas-observer";

// Wrap your OpenAI client.
const client = wrapOpenAI({
  datasetId: "2C0DA018-94BF-4A7E-9A90-616FC3773A4E",
  // Initialize the OpenAI client just as you normally would.
  client: new OpenAI(),
});
```

When the chat completion endpoint is called, the data will be automatically uploaded to your Atlas dataset.

## Contributing

We welcome contributions to the `atlas-observer` library! If you have an idea for a new feature or improvement, please open an issue or submit a pull request. For more info or any questions, please join our [Community Slack](https://join.slack.com/t/nomic-community/shared_invite/zt-2v68u5vvo-R41jXlb7la7dRDyWiv2TpA).
