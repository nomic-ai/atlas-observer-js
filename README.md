# @nomic/atlas-observer

## Usage

```typescript
import { OpenAI } from "openai";
import { wrapOpenAI } from "@nomic/atlas-observer";

// Wrap your OpenAI client.
const client = wrapOpenAI({
  dataset: "my-org/my-llm-chats",
  client: new OpenAI(),
});

// Use the OpenAI client as normal – responses are automatically uploaded to your Atlas dataset in the background.
const res = await client.chat.completions.create({
  messages: [
    {
      role: "user",
      content: "What's a popular Japanese dish?",
    },
  ],
  model: "gpt-4o-mini",
  max_tokens: 1000,
});
console.log(res.choices[0].message.content);
```
