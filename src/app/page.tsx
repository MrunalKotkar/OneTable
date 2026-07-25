import { demoDiners } from "@/data/demo-fixtures";

const workstreams = [
  {
    person: "Person 1",
    title: "Memory",
    detail: "Recall, revision history, and persistence",
  },
  {
    person: "Person 2",
    title: "Negotiation",
    detail: "Constraint filtering and reusable rebalance",
  },
  {
    person: "Person 3",
    title: "Experience",
    detail: "Table creation and visible live changes",
  },
  {
    person: "Person 4",
    title: "Transaction",
    detail: "Checkout, fulfillment, QA, and demo",
  },
];

export default function Home() {
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
        <span className="status">Boilerplate ready</span>
      </header>

      <section className="workspace">
        <div className="intro">
          <p className="eyebrow">Group dining agent</p>
          <h1>One table. Current beliefs. One order.</h1>
          <p>
            The shared contracts and feature boundaries are ready. Each teammate
            can now build independently against deterministic fixtures.
          </p>
        </div>

        <section className="panel" aria-labelledby="diners-title">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">Demo table</p>
              <h2 id="diners-title">Diner profiles</h2>
            </div>
            <span>4 profiles seeded</span>
          </div>
          <div className="dinerGrid">
            {demoDiners.map((diner) => (
              <article className="diner" key={diner.id}>
                <span className="avatar">{diner.initials}</span>
                <div>
                  <h3>{diner.name}</h3>
                  <p>
                    {diner.beliefs
                      .filter((belief) => belief.status === "active")
                      .map((belief) => String(belief.value))
                      .join(" · ")}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="workstreams" aria-labelledby="workstreams-title">
          <div className="sectionHeading">
            <p className="eyebrow">Parallel ownership</p>
            <h2 id="workstreams-title">Four independent workstreams</h2>
          </div>
          <div className="streamGrid">
            {workstreams.map((stream) => (
              <article className="stream" key={stream.person}>
                <span>{stream.person}</span>
                <h3>{stream.title}</h3>
                <p>{stream.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

