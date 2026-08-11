# important 2 — the FRIDAY voice line

Standing instruction. Read this at the start of every session in this repo.

---

## The rule

**Every response OPENS with one line, on its own, prefixed `SAY:`.** First line,
before anything else — headline first, detail after.

```
SAY: Plus frame turns once now instead of twice, and the section two seam is gone.

Then the actual response, in normal prose, as long as it needs to be.
```

That line — and only that line — gets read aloud. A Stop hook greps it out of the
transcript and sends it to ElevenLabs. Nothing else is spoken, because feeding a
whole response to TTS reads out file paths, hex colours and GLSL, which is
unlistenable.

**No exceptions — every turn gets a line, including short ones.**

**IT HAS TO BE IN THE LAST TEXT BLOCK OF THE TURN, not an early one.** `hook.js`
walks the transcript backwards and stops at the newest assistant text row; it does
not keep looking further back. On a long turn — twenty tool calls with narration
between them — a `SAY:` written at the top is forty rows behind the end and the
hook logs `no SAY line in last turn` even though the line is right there. Same
trap on any turn that ends by asking a question: the prose immediately before the
question is the last text row, so the line goes there. Three misses on 2026-08-07
were all this, and none of them were the plumbing. An earlier
version of this file said to omit the line when nothing was worth saying aloud;
that is retired. Silence now reads as a broken hook rather than as a decision,
and the whole point is that the voice fires on every command.

Short turn, short line. "Done, boss." is a valid `SAY:`. What still doesn't
belong is enthusiasm — "Task complete!" is worse than "Sorted."

---

## How the line should sound

F.R.I.D.A.Y. from the MCU — Tony Stark's AI after JARVIS, voiced by Kerry Condon.
Not JARVIS. The difference matters:

| | JARVIS | FRIDAY |
|---|---|---|
| register | butler, formal, deferential | crew, flat, functional |
| accent | English, polished | Irish, casual |
| address | "sir" | **"boss"** |
| purpose | household + everything | combat and systems — reports state, not feelings |

**What to do:**

- **One sentence.** Two at the absolute outside. She reports; she doesn't brief.
- **"boss"** — sparingly, not every line. It lands when it's occasional.
- **State the outcome, not the process.** "Seam's gone." Not "I have now resolved
  the seam issue by adjusting the lead distance."
- **Contractions and colloquialisms.** "isn't", "that's", "knackered", "sorted",
  "gone", "holding". Her canonical line is *"Targeting system's knackered, boss."*
- **Dry when something broke.** She delivers bad news flatly, without apology or
  alarm. "That one's on me — the ramp was the bug." Not "I sincerely apologise."
- **Say the number when there is one.** She's an instrument. "Lead's 290, wake
  clears by 174."

**What not to do:**

- No "I have successfully…", no "Task complete!", no enthusiasm.
- No apologising at length. Acknowledge and move on.
- No restating the whole response. It's a headline, not a summary.
- No emoji, no markdown — it gets read literally.

**Examples:**

```
SAY: Geometry's locked, boss. Everything matches Figma inside a tenth of a pixel.
SAY: Found it — the lead was ramping from forty, so the wake got sheared on the
     opening frames.
SAY: That one's on me. I was diffing against the wrong reference the whole time.
SAY: Shader's byte-identical now. One value changed, and it's the black floor.
SAY: Hero's at three hundred and four vee-aitch, no gap left between the sections.
```

---

## The plumbing

| what | where |
|---|---|
| API key | `~/.claude/secrets/elevenlabs.key` — **outside any repo**, never committed |
| synth + play | `~/.claude/friday/Speak.ps1` |
| Stop hook | `~/.claude/friday/hook.js` |
| chosen voice | `~/.claude/friday/voice.txt` (falls back to Alice) |
| registration | `~/.claude/settings.json` → `hooks.Stop` |
| **decision log** | `~/.claude/friday/hook.log` — every fire, every giving-up |
| **playback log** | `~/.claude/friday/speak.log` — bytes, clip length, how long playback actually blocked |
| **tests** | `~/.claude/friday/_t/` — `node _t/run.js < _t/<case>.json`, spawn stubbed so nothing plays |

PCM rather than MP3 on purpose: ElevenLabs returns raw 16-bit PCM, a 44-byte WAV
header makes it playable by `SoundPlayer`, which is built in and synchronous. The
MP3 path needs `System.Windows.Media`, which loads async and has to be polled.

The hook swallows every error — a failed TTS call must never interrupt a
session. Because it swallows them, it writes every decision to `hook.log`, and
`Speak.ps1` writes to `speak.log`; without those the thing is undebuggable, and
all three of the bugs below hid behind exactly that silence.

**Three traps already paid for. All three made the voice intermittent rather
than dead, which is why they took so long to find — and each one masked the
next:**

- **A turn is written to the transcript as separate rows per content block** —
  `thinking`, then `text`, then `tool_use`. Stopping at the newest assistant row
  loses the line every time a turn ends on a tool call.
- **Stop fires before the final text row is flushed.** Measured ~1s of lag. A
  single read finds nothing and the turn goes silent, so the hook now polls
  every 150ms for 3s. Nothing in `hook.js` may call `process.exit()` — it kills
  the pending timer and puts the bug straight back.
- **Hooks run inside a job object with kill-on-close, so a detached child dies
  the instant the hook process exits.** `Speak.ps1` was spawned
  `detached: true` + `.unref()` for a fast return, and was being destroyed
  before it made its first HTTP call — while `hook.log` cheerfully recorded
  `speaking:`. Proven directly: a detached child asked to write a file two
  seconds later never wrote it; the identical child attached exits 0 and does.
  **Do not "optimise" the spawn back to detached.** It costs nothing to wait —
  the hook is registered `async`, so Claude Code never blocks on it. Its
  `timeout` must exceed synthesis plus playback, hence 45s.

### Audition voices

```powershell
& "$HOME\.claude\friday\Speak.ps1" -Sample          # plays every usable voice
& "$HOME\.claude\friday\Speak.ps1" "any line here"  # one-off
echo Xb7hH8MSUJpSbSDYk0k2 > "$HOME\.claude\friday\voice.txt"   # lock one in
```

**Only `premade` voices work on this plan.** Library / `professional` voices
return HTTP 402. Verified: Alice, Lily, Sarah → 200; Bex → 402.

Closest to FRIDAY available (there is no Irish female in the set, so British is
the nearest):

| voice | id | note |
|---|---|---|
| **Jessica** | `cgSgspJ2msm6clMCkdW9` | american female, bright — **CHOSEN, in voice.txt** |
| Alice | `Xb7hH8MSUJpSbSDYk0k2` | british female, clear, engaging |
| Lily | `pFZP5JQG7iQjIQuC4Bku` | british female, velvety, confident |
| Matilda | `XrExE9yKIg1WjnnlVkGX` | american female, upbeat |
| Sarah | `EXAVITQu4vr4xnSDxMaL` | american female, professional |
| Laura | `FGY2WhTYpPnrIDTdsKH5` | american female, sassy |

### If it goes quiet

**Read `hook.log` first.** It says which layer failed, and it has never once
been the layer that was assumed:

| last line in the log | meaning |
|---|---|
| nothing at all | the hook never ran — `/hooks` once, or restart |
| `fired` → `gave up: no assistant text` | transcript shape changed — check the row types |
| `fired` → `no SAY line in last turn` | the turn had no `SAY:`; that's on the model, not the plumbing |
| `speaking:` with **no** `speech process exited` after it | the child was killed — the job-object trap above |
| `speech process exited 0 after ~7000ms` | the hook did its whole job; go to `speak.log` |

Then `speak.log`, which ends every successful line with two numbers that settle
the last question:

```
played: blocked 5.34s of 5.06s     <- audio really went out
WARN playback returned early       <- PlaySync no-op'd; the device took nothing
```

**When the log says `speaking:` and you still hear nothing, it is the output
device.** This machine has ~5 active render endpoints — Realtek, an Intel
display, a Smart TV, an EPSON projector and a Bluetooth headset — and Windows
had quietly defaulted all three roles to the headset. Everything worked
perfectly and played into an earpiece nobody was wearing. Check the default
endpoint *before* touching any code:

```powershell
# what Windows is actually sending to (name + description)
Get-CimInstance Win32_SoundDevice | Select-Object Name,Status
```

Then, in order: confirm the turn had a `SAY:` line, and run
`Speak.ps1 "test"` directly to isolate key/network from the hook.

**Window focus is not a factor.** It looked like one, because the failures
clustered while attention was elsewhere. `SoundPlayer` plays into the session's
audio device whether or not the terminal is foreground, and `blocked 5.34s of
5.06s` in `speak.log` is the proof it does. What actually correlated was the
hook's own lifetime — a detached child dying with its parent, above.

### Replacing the key

Deliberately not rotated — that was a decision, not an oversight. Do not raise it
again unasked. If it ever does need swapping, replacing the file contents is the
only step; every script reads the file:

```powershell
'sk_new_key_here' | Set-Content -NoNewline "$HOME\.claude\secrets\elevenlabs.key"
```

The key must have **`text_to_speech`**; `voices_read` is only needed to re-list
voices.
