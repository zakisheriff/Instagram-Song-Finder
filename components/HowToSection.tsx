import { howToSteps } from "@/lib/content/how-to";

export function HowToSection() {
  return (
    <section className="content" id="how-it-works" aria-labelledby="how-it-works-title">
      <h2 className="content__title" id="how-it-works-title">
        How to use an ISRC code on Instagram
      </h2>
      <ol className="steps">
        {howToSteps.map((step) => (
          <li key={step.title}>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
          </li>
        ))}
      </ol>

      <p className="callout">
        <strong>Good to know:</strong> an ISRC identifies a sound recording. It does not mean
        Instagram has licensed or indexed that recording. Searching by ISRC is not an officially
        documented Instagram feature and may behave differently depending on your account type,
        region and app version, so a correct code can still return no result.
      </p>
    </section>
  );
}
