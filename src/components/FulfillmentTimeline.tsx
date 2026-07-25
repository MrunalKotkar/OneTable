import type { FulfillmentStep } from "@/features/fulfillment/contract";

interface FulfillmentTimelineProps {
  steps: FulfillmentStep[];
}

export function FulfillmentTimeline({ steps }: FulfillmentTimelineProps) {
  return (
    <section className="panel" aria-labelledby="fulfillment-title">
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Fulfillment</p>
          <h2 id="fulfillment-title">Order status</h2>
        </div>
      </div>
      <div className="panelBody">
        <ol className="fulfillmentTimeline">
          {steps.map((step) => (
            <li
              key={step.status}
              className={`fulfillmentStep ${step.completed ? "fulfillmentStep--done" : ""}`}
            >
              <span className="fulfillmentDot" aria-hidden="true" />
              <span className="fulfillmentLabel">{step.label}</span>
              <span className="fulfillmentEta">{step.etaMinutes} min</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
