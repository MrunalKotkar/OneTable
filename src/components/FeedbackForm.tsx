import { useState } from "react";
import type { DinerFeedback, DinerProfile } from "@/domain/contracts";

interface FeedbackFormProps {
  you: string | null;
  yourDishName: string | null;
  seatedDinerIds: string[];
  diners: DinerProfile[];
  feedback: DinerFeedback[];
  busy: boolean;
  onSubmit: (liked: boolean, note?: string) => void;
}

export function FeedbackForm({
  you,
  yourDishName,
  seatedDinerIds,
  diners,
  feedback,
  busy,
  onSubmit,
}: FeedbackFormProps) {
  const [liked, setLiked] = useState<boolean | null>(null);
  const [note, setNote] = useState("");

  const yourFeedback = you ? feedback.find((f) => f.dinerId === you) : undefined;
  const dinerName = (id: string) => diners.find((d) => d.id === id)?.name ?? id;

  return (
    <section className="panel" aria-labelledby="feedback-title">
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Feedback</p>
          <h2 id="feedback-title">How was the meal?</h2>
        </div>
        <span>
          {feedback.length} of {seatedDinerIds.length} responded
        </span>
      </div>
      <div className="panelBody">
        {yourFeedback ? (
          <p className="inlineHint">
            Thanks — you said you {yourFeedback.liked ? "liked" : "didn't love"} your meal.
          </p>
        ) : you ? (
          <div className="feedbackForm">
            <p>
              Your dish{yourDishName ? `: ${yourDishName}` : ""}. Did you like it?
            </p>
            <div className="actionRow">
              <button
                type="button"
                className={`secondaryButton ${liked === true ? "isSelected" : ""}`}
                onClick={() => setLiked(true)}
                disabled={busy}
              >
                Liked it
              </button>
              <button
                type="button"
                className={`secondaryButton ${liked === false ? "isSelected" : ""}`}
                onClick={() => setLiked(false)}
                disabled={busy}
              >
                Not for me
              </button>
            </div>
            <input
              className="intentInput"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note"
              aria-label="Optional feedback note"
            />
            <button
              type="button"
              className="primaryButton"
              disabled={liked === null || busy}
              onClick={() => onSubmit(liked as boolean, note || undefined)}
            >
              Submit feedback
            </button>
          </div>
        ) : null}

        <ul className="feedbackProgress">
          {seatedDinerIds.map((id) => (
            <li key={id} className={feedback.some((f) => f.dinerId === id) ? "isDone" : ""}>
              {dinerName(id)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
