"use client";

import { demoGroupHistory, demoRestaurants } from "@/data/demo-fixtures";
import { BeliefRevisionPanel } from "@/components/BeliefRevisionPanel";
import { DinerRoster } from "@/components/DinerRoster";
import { FreshSessionPanel } from "@/components/FreshSessionPanel";
import { RecommendationCard } from "@/components/RecommendationCard";
import { StatusBanner } from "@/components/StatusBanner";
import { useDemoFlow } from "@/components/use-demo-flow";

const BUSY_PHASES = new Set([
  "recalling",
  "negotiating",
  "revising_belief",
  "rebalancing",
]);

export default function Home() {
  const { state, actions } = useDemoFlow();
  const busy = BUSY_PHASES.has(state.phase);
  const presentIds = ["alex", "sam", "jordan", ...(state.priyaSelected ? ["priya"] : [])];
  const jordan = state.diners.find((d) => d.id === "jordan");

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true">
            1T
          </span>
          <div>
            <strong>OneTable</strong>
            <span>MenuSifu Track 1</span>
          </div>
        </div>
        <span className="status">{state.screen.replace("-", " ")}</span>
      </header>

      <section className="workspace">
        {state.screen === "create-table" && (
          <>
            <div className="intro">
              <p className="eyebrow">Group dining agent</p>
              <h1>One table. Current beliefs. One order.</h1>
              <p>
                OneTable recalls each diner&apos;s active constraints before it
                negotiates. Start with Alex, Sam, and Jordan — Priya can join the
                table once it&apos;s running.
              </p>
            </div>

            <section className="panel" aria-labelledby="diners-title">
              <div className="panelHeading">
                <div>
                  <p className="eyebrow">Create table</p>
                  <h2 id="diners-title">Who&apos;s at the table</h2>
                </div>
                <span>{presentIds.length} of 4 seated</span>
              </div>
              <div className="panelBody">
                <DinerRoster
                  diners={state.diners}
                  presentIds={presentIds}
                  onTogglePriya={actions.togglePriya}
                />
              </div>
            </section>

            <section className="panel" aria-labelledby="intent-title">
              <div className="panelHeading">
                <div>
                  <p className="eyebrow">Dining intent</p>
                  <h2 id="intent-title">What is the table looking for?</h2>
                </div>
              </div>
              <div className="panelBody">
                <input
                  className="intentInput"
                  type="text"
                  value={state.intent}
                  onChange={(event) => actions.setIntent(event.target.value)}
                  placeholder="quick lunch, around $20 each"
                  aria-label="Dining intent"
                />
                <button
                  type="button"
                  className="primaryButton"
                  onClick={actions.createTable}
                  disabled={busy}
                >
                  {busy ? "Working…" : "Recall & recommend"}
                </button>
              </div>
            </section>

            <StatusBanner phase={state.phase} />
          </>
        )}

        {state.screen === "table" && (
          <>
            <div className="intro intro--compact">
              <p className="eyebrow">Live table</p>
              <h1>Recommendation</h1>
            </div>

            <StatusBanner phase={state.phase} />

            <section className="panel" aria-labelledby="roster-title">
              <div className="panelHeading">
                <div>
                  <p className="eyebrow">Table</p>
                  <h2 id="roster-title">Diners</h2>
                </div>
                <span>{presentIds.length} of 4 seated</span>
              </div>
              <div className="panelBody">
                <DinerRoster
                  diners={state.diners}
                  presentIds={presentIds}
                  onTogglePriya={state.priyaSelected ? undefined : actions.addPriya}
                />
              </div>
            </section>

            {state.recommendation && (
              <RecommendationCard
                recommendation={state.recommendation}
                previousRecommendation={state.previousRecommendation}
                restaurants={demoRestaurants}
                diners={state.diners}
              />
            )}

            {state.revision && jordan && (
              <BeliefRevisionPanel revision={state.revision} diner={jordan} />
            )}

            <div className="actionRow">
              {!state.priyaSelected && (
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={actions.addPriya}
                  disabled={busy}
                >
                  Add Priya to the table
                </button>
              )}
              {state.priyaSelected && !state.revision && (
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={actions.reviseJordanBelief}
                  disabled={busy}
                >
                  Jordan: correct to shellfish allergy
                </button>
              )}
              <button
                type="button"
                className="primaryButton"
                onClick={actions.approve}
                disabled={busy || state.phase !== "ready"}
              >
                Approve & continue
              </button>
            </div>
          </>
        )}

        {state.screen === "fresh-session" && (
          <>
            <div className="intro intro--compact">
              <p className="eyebrow">New browser session</p>
              <h1>Fresh-session proof</h1>
            </div>

            <StatusBanner phase={state.phase} />

            {state.phase === "ready" && (
              <FreshSessionPanel
                diners={state.diners}
                history={demoGroupHistory}
                revision={state.revision}
              />
            )}

            <div className="actionRow">
              <button type="button" className="secondaryButton" onClick={actions.restart}>
                Restart demo
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
