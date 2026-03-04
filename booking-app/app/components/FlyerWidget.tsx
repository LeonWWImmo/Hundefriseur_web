"use client";

import { useState } from "react";
import Image from "next/image";

const flyerImage = "/Pictures/flyer-gutscheine.jpeg";

export default function FlyerWidget() {
  const [activeFlyer, setActiveFlyer] = useState<string | null>(null);

  return (
    <>
      <div className="flyer-fixed" aria-label="Aktionsflyer">
        <Image
          src={flyerImage}
          alt="Hundecoiffeur Pepita Gutschein 10 Prozent Rabatt"
          className="flyer-img"
          width={160}
          height={220}
          onClick={() => setActiveFlyer(flyerImage)}
        />
      </div>

      <div
        className="flyer-popup"
        role="dialog"
        aria-label="Flyer Vorschau"
        style={{ display: activeFlyer ? "flex" : "none" }}
        onClick={() => setActiveFlyer(null)}
      >
        <span
          className="flyer-close"
          role="button"
          tabIndex={0}
          aria-label="Flyer schliessen"
          onClick={() => setActiveFlyer(null)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              setActiveFlyer(null);
            }
          }}
        >
          &times;
        </span>
        {activeFlyer ? (
          <Image
            className="flyer-popup-content"
            src={activeFlyer}
            alt="Flyer in gross"
            width={900}
            height={1200}
            onClick={(event) => event.stopPropagation()}
          />
        ) : null}
      </div>
    </>
  );
}
