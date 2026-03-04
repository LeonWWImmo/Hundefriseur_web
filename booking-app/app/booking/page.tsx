import { Suspense } from "react";
import BookingFlow from "./BookingFlow";

export default function BookingPage() {
  return (
    <Suspense fallback={<main className="section"><div className="container">Lade Buchung...</div></main>}>
      <BookingFlow />
    </Suspense>
  );
}
