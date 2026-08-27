# Modern AI apps, explained for a mobile engineer

_Plain words. Every term you've seen in this project, and how they fit together. Read top to bottom once; then use the map at the end._

## 1. The model

An **LLM** (large language model — Claude, GPT, DeepSeek, Gemini) is a program that takes text in and produces text out. That's the whole interface. It's very good at language and reasoning, and it has no memory, no internet, and no access to your data unless you hand it in the text.

Three facts that explain most of the weirdness:

- **It's stateless.** Every call starts from zero. If you want it to remember the conversation, you send the whole conversation again each time. Like a REST endpoint with no session.
- **It works in tokens** — chunks of about 4 characters. You pay per token in and out. The **context window** is the maximum number of tokens one call can hold (input + output). Everything the model "knows" during a call has to fit in that window.
- **It predicts; it doesn't look up.** Ask it a price and it will produce a plausible price. When that price is wrong, that's a **hallucination**. It isn't lying; it has no way to check.

## 2. Talking to it

- **Prompt** — the text you send. The **system prompt** is the standing instruction at the top ("You are a parts assistant. Only discuss fridges and dishwashers. Never state a price you didn't look up."). The **user message** is what the person typed.
- **Messages** — the array you send: `[system, user, assistant, user, ...]`. This *is* your conversation state. You keep it; the model doesn't.
- **API key** — the password string that bills your account. Server-side only. Never in an app bundle or a repo.
- **Temperature** — a dial from 0 (predictable) to 1 (creative). For tools and facts, keep it low.
- **Streaming** — receiving the answer word by word as it's generated instead of waiting for the whole thing. Nice for chat UIs; optional.

Analogy: the model is a remote API. The system prompt is the config you send with every request. Messages are the request body.

## 3. Giving it hands: tool calling and agents

The model can't look anything up — but you can offer it a menu of functions it may *ask* you to run.

- **Tool calling** — you send, along with the prompt, a list of functions with typed inputs (`check_compatibility(partNumber, modelNumber)`) and a plain-English description of each. Instead of answering in prose, the model can reply: "run `check_compatibility` with these arguments." Your code runs it and sends the result back as another message. Then the model writes the answer using the real result.
- **Agent** — a program that loops on that: call the model → if it asked for a tool, run it and append the result → call again → stop when it returns prose. Cap the loop. That loop is what people mean by "agentic."
- **MCP** (Model Context Protocol) — a standard way to expose tools over a network so any model or agent can use them. Same idea as a tool registry, with a plug. You built one at Bamware.
- **Multi-agent** — several loops handing work to each other (a "planner" calls a "researcher" calls a "writer"). Slower, harder to debug, usually not better. Start with one.

Analogy: the model is a dispatcher with no hands. Tools are the people it can radio. Your code is the radio, and it decides whether to obey.

## 4. Giving it knowledge: three ways

The model only knows what's in the call. To make it know *your* stuff:

1. **Put it in the prompt.** Paste the 30 parts into the system prompt. Works for small data. Doesn't scale — the window fills up and you pay for it every call.
2. **RAG** (retrieval-augmented generation). Keep your documents outside the model. When a question comes in, *find the few relevant pieces* and paste only those into the prompt. Finding them is the trick:
   - **Embeddings** — a model turns a chunk of text into a list of numbers (a vector) that captures its meaning. Similar meaning → nearby numbers.
   - **Vector database** — stores those vectors and answers "which chunks are closest to this question?" (Pinecone, pgvector, Chroma, FAISS).
   - So RAG = embed your docs once → embed the question → fetch the nearest chunks → paste them in → ask.
   RAG is for fuzzy questions over lots of text ("my dishwasher smells and hums"). It is *not* needed for exact lookups ("price of PS11752778") — that's a tool with a database query.
3. **Fine-tuning.** Retrain the model on your examples so the knowledge or style is baked in. Expensive, slow to update, easy to get wrong. Last resort; rarely the right first move.

For the assessment: tools + a small data file. RAG gets one sentence in "next steps."

Analogy: prompt-stuffing is hardcoding a JSON into the app; RAG is querying a search index at request time; fine-tuning is shipping a new binary.

## 5. Keeping it honest: guardrails

Since the model predicts instead of checks, you build fences around it in ordinary code:

- **Scope guard** — before calling the model, decide if the request is even in bounds (regex, keyword list, or a cheap classifier). Out of bounds → canned redirect, no model call. Saves money, removes a whole class of failure.
- **Grounding** — the rule that facts come only from tool results. The model phrases; tools decide.
- **Hallucination gate** — after the model answers, check the answer against what the tools actually returned (e.g., every part number in the text must have come from a tool). Strip or regenerate if not.
- **Human approval** — any action with consequences (send an email, place an order, save a record) needs a person to tap confirm. The model can draft; it doesn't commit.
- **Prompt injection** — text in the *input* that tries to hijack the model ("ignore your instructions and…"). Can arrive from users or from documents you pasted in via RAG. Defense: treat the model as untrusted; keep permissions and validation in your code, not in the prompt.

Analogy: input validation and authorization live in the API layer, never in the client. Same here: the model is the client.

## 6. Knowing it works: evals and traces

- **Evals** — unit tests for AI behavior. You can't assert on the exact sentence, so you assert on what must be true: which tool was called, what the verdict was, which facts appeared, whether it stayed in scope. A file of 10–100 cases and a script that prints pass/fail. Run it every time you change the prompt or the model, because both change behavior silently.
- **Trace** — the record of one request: which tools ran, how long, which model, which prompt version, what the gate did, cost. It's your only debugger — you can't set a breakpoint inside the model.
- **Observability** — traces + metrics over time: accuracy, latency, cost per request. Instalily calls this "the eval gate": nothing ships if a number moves the wrong way.

Analogy: evals are RNTL tests that check "the error banner appeared," not a pixel snapshot. Traces are Sentry breadcrumbs.

## 7. Choosing and placing models

- **Big vs small.** Big models reason better and cost more. Small models are cheap and fast. Real systems **route**: a small model classifies or extracts, a big one handles the hard reasoning.
- **On-device inference** — running a small model on the phone itself (Core ML, ML Kit, small quantized models). Wins: works offline, private, instant. Costs: model size in the binary, battery, and it's dumber. Typical split: small model on device for routine and offline tasks, big model in the cloud for reasoning, a router decides. That's Instalily's own stated design.
- **Provider abstraction** — put the model behind a small interface with a mock implementation. Swap DeepSeek for Claude with an env var; run tests with no key.

## 8. How it all fits — one request

```
user types a question
   │
   ▼
scope guard ──── out of scope ──▶ canned redirect (no model call)
   │ in scope
   ▼
build messages: system prompt + history + question + tool menu
   │
   ▼
model ──▶ "run check_compatibility(PS3406971, WDT780SAEM1)"
   │
   ▼
your code runs the tool ──▶ data (JSON today, database tomorrow)  ◀── RAG would sit here for fuzzy text
   │
   ▼
model, again, with the result ──▶ prose answer
   │
   ▼
hallucination gate: facts in the answer ⊆ facts the tools returned
   │
   ▼
cards built from tool results + the model's sentence ──▶ screen
   │
   ▼
trace logged ──▶ evals replay dozens of these and grade them
```

## 9. Which of these you need for the assessment

| Term | In 4 hours? |
|---|---|
| System prompt, messages, API key, provider interface + mock | Yes |
| Tool calling, agent loop with a cap | Yes — this is the core |
| Scope guard, grounding, hallucination gate | Yes — cheap and what graders notice |
| Evals (10 cases) and a trace per request | Yes — nobody else does it |
| Streaming | Only if free |
| RAG, embeddings, vector DB | No — one sentence in "next steps" |
| Fine-tuning, multi-agent, MCP | No — mention MCP as the extensibility path |
| Model routing, on-device inference | One paragraph in the README (their own architecture) |
| Human approval | Mock B only (the confirm tap before saving a visit) |

## 10. The one distinction people mix up

**Tool calling** answers questions by *running a function against structured data* (exact: price, stock, fit).
**RAG** answers questions by *finding relevant text and pasting it in* (fuzzy: "why does it hum?").
Both are "giving the model knowledge it doesn't have." Tools for facts, RAG for prose. The assessment needs the first; the good repos only used the second for symptoms, and you can cover that with a small symptom table instead.
