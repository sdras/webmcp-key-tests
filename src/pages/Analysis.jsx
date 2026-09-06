import { useCallback, useRef, useState } from "react";
import { NATIVE_PROBE_REFERENCE, runNativeProbes } from "../analysis/nativeProbes.js";
import { HOOK_SCENARIO_REFERENCE, runHookScenarios } from "../analysis/hookProbes.jsx";
import { Check } from "../components/icons.jsx";

const MEASURED = "Chrome 152, native API, 2026-09-06";
const REFERENCE = "Chrome 152";
const SPEC = "https://github.com/webmachinelearning/webmcp";

const ISSUES = [
  ["#234", "registerTool should return the registered tool instead of undefined. A handle is the missing key."],
  ["#167", "Dynamic tool definitions: an updateTool() that changes description or schema while preserving identity."],
  ["#262", "WebMCP loses important context when tools appear or disappear. The cost of every unregister-plus-register pair."],
  ["#300", "Unregistration must not fail an in-flight execution, including a tool that unregisters itself from inside execute()."],
  ["#218", "Closed by PR #248 (2026-08-19): in-flight executions survive unregistration. Chrome 152 predates it."],
  ["#101", "Why a duplicate name is an error, not a replace: a third-party script must not be able to take over a first-party tool."],
];

// A live cell that matches the reference says so once instead of repeating
// the reference text; only a differing result is worth reading twice.
const Same = () => (
  <span className="same">
    <Check /> same
  </span>
);

function Source({ mcp, onInstallShim }) {
  if (!mcp.supported) {
    return (
      <div className="status none">
        <span className="dot" />
        <span>
          No <code>document.modelContext</code>. Enable <code>chrome://flags/#enable-webmcp-testing</code> for real
          numbers, or{" "}
          <button type="button" onClick={onInstallShim}>
            measure the in-page simulator instead
          </button>
        </span>
      </div>
    );
  }
  if (mcp.source === "shim") {
    return (
      <div className="status shim">
        <span className="dot" />
        <span>
          Measuring the in-page simulator. It returns <code>undefined</code> from <code>registerTool</code> and replaces
          duplicate names, so expect the live column to differ from Chrome.
        </span>
      </div>
    );
  }
  return (
    <div className="status native">
      <span className="dot" />
      <span>
        Measuring the native <code>document.modelContext</code> in {navigator.userAgent.match(/Chrome\/(\d+)/)?.[0] ?? "this browser"}.
      </span>
    </div>
  );
}

function NativeProbes({ mcp, running, setRunning }) {
  const [rows, setRows] = useState(null);
  const busy = running === "native";

  const run = useCallback(async () => {
    setRunning("native");
    setRows([]);
    try {
      await runNativeProbes(document.modelContext, (row) => setRows((prev) => [...(prev ?? []), row]));
    } finally {
      setRunning(null);
    }
  }, [setRunning]);

  const live = (probe) => rows?.find((row) => row.probe === probe);
  const done = rows !== null && !busy;
  const stopped = rows?.find((row) => row.probe === "Probe run stopped");
  const differing = done ? NATIVE_PROBE_REFERENCE.filter(([probe, reference]) => live(probe)?.result !== reference).length : 0;
  const total = NATIVE_PROBE_REFERENCE.length;

  return (
    <>
      <div className="controls">
        <button className="primary" onClick={run} disabled={!mcp.supported || !mcp.canCall || running !== null}>
          {busy ? "Measuring…" : rows ? "Measure again" : "Measure this browser"}
        </button>
        {/* The verdict replaces the hint once a run settles, so the result is
            stated in one line rather than left to a scan of the table. */}
        <span className="hint" role="status">
          {!done ? (
            <>
              Registers and aborts eleven throwaway tools named <code>probe_*</code>, then cleans up.
            </>
          ) : stopped ? (
            `Stopped early: ${stopped.result}. ${rows.length - 1} of ${total} probes ran.`
          ) : differing === 0 ? (
            `Matches ${REFERENCE} on all ${total} probes.`
          ) : (
            `Differs from ${REFERENCE} on ${differing} of ${total} probes. Those rows are highlighted.`
          )}
        </span>
      </div>
      <div className="table-wrap">
        <table className="results">
          <thead>
            <tr>
              <th>Probe</th>
              <th>{MEASURED}</th>
              <th className="live">This browser</th>
            </tr>
          </thead>
          <tbody>
            {NATIVE_PROBE_REFERENCE.map(([probe, reference]) => {
              const row = live(probe);
              const cls = "mono live" + (!row ? " pending" : row.result !== reference ? " differs" : "");
              return (
                <tr key={probe}>
                  <td>{probe}</td>
                  <td className="mono">{reference}</td>
                  <td className={cls}>
                    {row ? row.result === reference ? <Same /> : row.result : busy ? "…" : rows ? "skipped" : "not measured yet"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function HookScenarios({ mcp, running, setRunning }) {
  const [rows, setRows] = useState(null);
  const busy = running === "hook";
  const sink = useRef(null);

  const run = useCallback(async () => {
    setRunning("hook");
    setRows([]);
    try {
      await runHookScenarios(document.modelContext, sink.current, (row) => setRows((prev) => [...(prev ?? []), row]));
    } finally {
      setRunning(null);
    }
  }, [setRunning]);

  const live = (scenario) => rows?.find((row) => row.scenario === scenario);
  const matches = (row, reference) =>
    Boolean(row) && row.registers === reference.registers && row.events === reference.events && row.outcome === reference.outcome;
  const done = rows !== null && !busy;
  const stopped = rows?.find((row) => row.scenario === "Scenario run stopped");
  const differing = done ? HOOK_SCENARIO_REFERENCE.filter(([scenario, reference]) => !matches(live(scenario), reference)).length : 0;
  const total = HOOK_SCENARIO_REFERENCE.length;

  return (
    <>
      <div className="controls">
        <button className="primary" onClick={run} disabled={!mcp.supported || !mcp.canCall || running !== null}>
          {busy ? "Running…" : rows ? "Run again" : "Run the scenarios"}
        </button>
        <span className="hint" role="status">
          {!done ? (
            <>
              Mounts throwaway components that call <code>useWebMCP</code> into a hidden container, then unmounts them.
            </>
          ) : stopped ? (
            `Stopped early: ${stopped.outcome}. ${rows.length - 1} of ${total} scenarios ran.`
          ) : differing === 0 ? (
            `Matches ${REFERENCE} on all ${total} scenarios.`
          ) : (
            `Differs from ${REFERENCE} on ${differing} of ${total} scenarios. Those rows are highlighted.`
          )}
        </span>
      </div>
      <div ref={sink} className="probe-sink" aria-hidden="true" />
      <div className="table-wrap">
        <table className="results">
          <thead>
            <tr>
              <th>Scenario</th>
              <th className="num">registerTool calls</th>
              <th className="num">toolchange events</th>
              <th>Outcome ({MEASURED})</th>
              <th className="live">This browser</th>
            </tr>
          </thead>
          <tbody>
            {HOOK_SCENARIO_REFERENCE.map(([scenario, reference]) => {
              const row = live(scenario);
              const counts = row ? `${row.registers} / ${row.events}` : "";
              const cls = "mono live" + (!row ? " pending" : matches(row, reference) ? "" : " differs");
              return (
                <tr key={scenario}>
                  <td>{scenario}</td>
                  <td className="num">{reference.registers}</td>
                  <td className="num">{reference.events}</td>
                  <td className="mono">{reference.outcome}</td>
                  <td className={cls}>
                    {row ? matches(row, reference) ? <Same /> : `${counts}: ${row.outcome}` : busy ? "…" : rows ? "skipped" : "not run yet"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function AnalysisPage({ mcp, onInstallShim }) {
  // Both runners count toolchange events and registerTool calls on the same
  // modelContext, so only one runs at a time: run together, each would inflate
  // the other's numbers and flag a difference that is not there.
  const [running, setRunning] = useState(null);

  return (
    <>
      <main>
        <section id="answer" className="demo">
          <h2>
            <span className="num">01</span> The short answer
          </h2>
          <p className="lede">
            The demo asks one question three ways: how does React know which row is which, how does the app know
            which item is which, and how does an agent know which thing it is editing? One id, minted when the item
            is created, answers all three. The analysis question is whether WebMCP itself needs a key concept for
            that to hold, or whether userland can carry it. The answer splits by <em>what</em> is being identified.
          </p>
          <div className="cards">
            <div className="card tone-good">
              <h3>
                <span className="tag">userland</span> Data identity
              </h3>
              <p>
                Ids passed as tool arguments keep React, app state and the agent in agreement. Against the native
                API, a note typed on Headlamp survived an agent adding an item to the top, moving Headlamp to
                position 0, removing Tent and renaming Camp stove. With <code>key={"{index}"}</code> the same edits
                left the note next to the wrong item. No spec change needed.
              </p>
            </div>
            <div className="card tone-warn">
              <h3>
                <span className="tag">spec gap</span> Tool identity
              </h3>
              <p>
                A registration's only identity is its <code>name</code>. <code>registerTool</code> resolves to{" "}
                <code>undefined</code>, so there is no handle, and nothing can be updated in place. Changing a
                description or schema means unregister plus register: two <code>toolchange</code> events and, in
                Chrome 152, a lost result for any call in flight. Userland cannot hide that from the agent.
              </p>
            </div>
            <div className="card tone-bad">
              <h3>
                <span className="tag">two bugs</span> The hook
              </h3>
              <p>
                <code>use-webmcp-tool</code> handles dynamic names, dynamic descriptions and per-item tools
                correctly. It also ignores the promise <code>registerTool</code> returns, so it reports{" "}
                <code>registered</code> on a name collision and leaks one unhandled <code>AbortError</code> per
                tool on every StrictMode mount. The in-page simulator hides both.
              </p>
            </div>
          </div>
        </section>

        <section id="native" className="demo">
          <h2>
            <span className="num">02</span> What the native API does with identity
          </h2>
          <p className="lede">
            Each row is one probe from <code>src/analysis/nativeProbes.js</code>. The middle column is what Chrome
            152 returned. Press the button to measure the browser you are in; the live column is highlighted where
            it differs.
          </p>
          <Source mcp={mcp} onInstallShim={onInstallShim} />
          <NativeProbes mcp={mcp} running={running} setRunning={setRunning} />
          <div className="callout">
            <div className="callout-side">
              <span className="callout-label">What to notice</span>
            </div>
            <ul>
              <li>
                <strong>The name is the key.</strong> A descriptor captured before a re-registration still runs
                whatever currently owns that name. Agents that cache tool lists keep working, and an agent can never
                tell that a tool was replaced.
              </li>
              <li>
                <strong>Collisions are errors, not warnings.</strong> A second registration with the same name is
                rejected with <code>InvalidStateError</code>. That was chosen deliberately (issue #101) so a
                third-party script cannot silently take over a first-party tool.
              </li>
              <li>
                <strong>Unregistering is not free.</strong> In Chrome 152 an abort mid-call loses the result. Spec
                PR #248 (merged 2026-08-19) says in-flight calls must survive, and Chrome 153 reportedly does that;
                issue #300 asks for the self-unregistration case to be spelled out.
              </li>
            </ul>
          </div>
        </section>

        <section id="hook" className="demo">
          <h2>
            <span className="num">03</span> The hook under dynamic keys
          </h2>
          <p className="lede">
            Seven scenarios from <code>src/analysis/hookProbes.jsx</code> mount real components that call{" "}
            <code>useWebMCP</code>, and count what the browser sees: native <code>registerTool</code> calls,{" "}
            <code>toolchange</code> events, and unhandled promise rejections. Reference numbers are Chrome 152.
          </p>
          <HookScenarios mcp={mcp} running={running} setRunning={setRunning} />
          <div className="callout">
            <div className="callout-side">
              <span className="callout-label">What to notice</span>
            </div>
            <ul>
              <li>
                <strong>Churn works, but it is loud.</strong> Every name or description change is one register and
                two events. Per-item tools are cheap only because React keys keep the row components alive across
                reorders. Issue #262 is about the context an agent loses each time a tool blinks.
              </li>
              <li>
                <strong>Collisions are silent in the hook.</strong> Both components say <code>registered</code>, the
                second was rejected, and unmounting the first removes the tool while the second still claims it.
                React warns on duplicate keys; the hook does not.
              </li>
              <li>
                <strong>A tool can cancel itself.</strong> If <code>execute</code> changes state that the description
                embeds, the hook re-registers the tool while the call is in flight, and on Chrome 152 the agent gets
                an error for a change that did happen. The demo avoids this by keeping descriptions static and
                putting the live data in <code>list-items</code>.
              </li>
            </ul>
          </div>
        </section>

        <section id="takeaways" className="demo">
          <h2>
            <span className="num">04</span> What follows
          </h2>
          <div className="cards">
            <div className="card">
              <h3>Fix in the hook now</h3>
              <ul className="prose">
                <li>
                  <strong>Await the registration promise.</strong> Ignore the <code>AbortError</code> an unmount
                  causes, surface <code>InvalidStateError</code> as <code>error</code> so <code>registered</code> is
                  truthful, and warn in development on a duplicate name.
                </li>
                <li>
                  <strong>Defer re-registration while a call is in flight.</strong> Track executions; when name,
                  description or schema change during one, abort and re-register once it settles.
                </li>
                <li>
                  <strong>Make the simulator honest.</strong> Return a promise, reject duplicates, reject an
                  already-aborted signal.
                </li>
              </ul>
            </div>
            <div className="card">
              <h3>Ask of the spec</h3>
              <ul className="prose">
                <li>
                  <strong>A handle from <code>registerTool</code></strong> (issue #234) and{" "}
                  <strong>an update path that keeps identity</strong> (issue #167). Together they are the missing
                  key: a way to change what the agent sees about a tool without a gap in the event stream and
                  without cancelling work.
                </li>
                <li>
                  <strong>Not needed:</strong> any key concept for the data a tool operates on. That belongs to the
                  page.
                </li>
              </ul>
            </div>
            <div className="card">
              <h3>Keep in userland</h3>
              <ul className="prose">
                <li>
                  <strong>Item identity.</strong> Ids as tool arguments are correct. Chrome's guidance prefers
                  natural-language values over opaque ids, so let mutating tools accept either an id or a text match
                  and resolve inside <code>execute</code>.
                </li>
                <li>
                  <strong>Static descriptions.</strong> Put live data in a read-only tool's output, never in another
                  tool's description.
                </li>
              </ul>
            </div>
          </div>
          <div className="prose">
            <p>
              <strong>Spec issues to follow</strong>
            </p>
            <ul className="issues">
              {ISSUES.map(([id, text]) => (
                <li key={id}>
                  <a href={`${SPEC}/issues/${id.slice(1)}`} target="_blank" rel="noopener">
                    {id}
                  </a>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <details className="code">
            <summary>Notes on this demo</summary>
            <ul className="prose" style={{ marginTop: "0.6rem" }}>
              <li>
                On the demo page the hook leaks one unhandled <code>AbortError</code> per tool on each StrictMode
                mount. The by-hand version in <code>ImperativeTools.jsx</code> registers the same five tools and
                awaits the promise <code>registerTool</code> returns, so it does not.
              </li>
              <li>
                Three tab switches between the two styles fired 60 <code>toolchange</code> events. At every one of
                them <code>getTools()</code> still returned all five tools, so an agent sees churn but never a gap.
              </li>
            </ul>
          </details>
        </section>
      </main>

      <footer>
        <a href={SPEC} target="_blank" rel="noopener">
          WebMCP spec
        </a>
        {" · "}
        <a href={`${SPEC}/issues`} target="_blank" rel="noopener">
          spec issues
        </a>
        {" · "}
        <a href="https://github.com/GoogleChromeLabs/use-webmcp-tool" target="_blank" rel="noopener">
          use-webmcp-tool
        </a>
      </footer>
    </>
  );
}
