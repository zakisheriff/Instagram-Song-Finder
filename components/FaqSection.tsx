import { faqEntries } from "@/lib/content/faq";

export function FaqSection() {
  return (
    <section className="content" id="faq" aria-labelledby="faq-title">
      <h2 className="content__title" id="faq-title">
        Frequently asked questions
      </h2>
      <div className="faq">
        {faqEntries.map((entry) => (
          <article className="faq__item" id={entry.id} key={entry.id}>
            <h3>{entry.question}</h3>
            {entry.answer.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
