import { useState } from "react";
import { TabList, tabPanelProps } from "./components/TabList.jsx";
import { installModelContextShim } from "./lib/modelContextShim.js";
import { useModelContext } from "./lib/useModelContext.js";
import { AnalysisPage } from "./pages/Analysis.jsx";
import { DemoPage } from "./pages/Demo.jsx";

const PAGES = {
  demo: {
    label: "Demo",
    title: "Keys keep React, and agents, in sync",
    blurb: <>Three demos: keys on a simple list, keys on a dynamic list, and WebMCP tools driving that dynamic list.</>,
    nav: [
      ["#simple", "Simple"],
      ["#dynamic", "Dynamic"],
      ["#webmcp", "WebMCP"],
    ],
    Page: DemoPage,
  },
  analysis: {
    label: "Analysis",
    title: "Does WebMCP need keys?",
    blurb: (
      <>
        What the demo shows, measured against the native <code>document.modelContext</code> in Chrome 152 on
        2026-09-06, and what that means for the spec and for <code>use-webmcp-tool</code>.
      </>
    ),
    nav: [
      ["#answer", "Answer"],
      ["#native", "Native API"],
      ["#hook", "Hook"],
      ["#takeaways", "Takeaways"],
    ],
    Page: AnalysisPage,
  },
};

const PAGE_TABS = Object.entries(PAGES).map(([key, { label }]) => ({ key, label }));

// Section numbers read "01", "02"… both in this nav and on the headings.
const pad = (n) => String(n).padStart(2, "0");

// `?page=analysis` opens the analysis tab directly, so either tab is linkable.
function pageFromUrl() {
  const page = new URLSearchParams(location.search).get("page");
  return Object.hasOwn(PAGES, page ?? "") ? page : "demo";
}

function writePageToUrl(page) {
  const params = new URLSearchParams(location.search);
  if (page === "demo") params.delete("page");
  else params.set("page", page);
  const search = params.toString();
  history.replaceState(null, "", `${location.pathname}${search ? `?${search}` : ""}`);
}

export function App() {
  const mcp = useModelContext();
  const [page, setPage] = useState(pageFromUrl);
  const { title, blurb, nav, Page } = PAGES[page];

  const pill = !mcp.supported ? "none" : mcp.source;
  const pillText = !mcp.supported ? "WebMCP: not detected" : mcp.source === "shim" ? "WebMCP: simulator" : "WebMCP: native";

  const switchTo = (next) => {
    if (next === page) return;
    setPage(next);
    writePageToUrl(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-in">
          <span className="wordmark">react-keys × webmcp</span>
          <TabList className="page-tabs" idBase="page" label="Pages" tabs={PAGE_TABS} selected={page} onSelect={switchTo} />
          <span className={`pill ${pill}`} role="status">
            {pillText}
          </span>
        </div>
      </div>

      <header className="hero">
        <h1>{title}</h1>
        <p className="blurb">{blurb}</p>
        <nav className="section-nav" aria-label="Sections">
          {nav.map(([href, label], index) => (
            <a key={href} href={href}>
              <span className="num">{pad(index + 1)}</span>
              {label}
            </a>
          ))}
        </nav>
      </header>

      {/* Keyed on the page so switching tabs unmounts one and mounts the other.
          The demo's tools unregister while the analysis is open, which keeps
          the agent's tool list in lockstep with what is on screen. */}
      <div {...tabPanelProps("page", page)}>
        <Page key={page} mcp={mcp} onInstallShim={installModelContextShim} />
      </div>
    </>
  );
}
