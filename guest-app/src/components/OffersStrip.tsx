export interface Offer {
  id: string;
  label: string;
  href?: string;
}

interface OffersStripProps {
  offers?: Offer[];
}

const DEFAULT_OFFERS: Offer[] = [
  { id: "weekly-special", label: "Weekly Special" },
  { id: "specialties", label: "Specialties" },
  { id: "limited", label: "Limited" },
];

/**
 * Guest flow step 1 (Home Screen): "Weekly Special | Specialties | Limited"
 * strip below the MENU button.
 */
export default function OffersStrip({ offers = DEFAULT_OFFERS }: OffersStripProps) {
  if (offers.length === 0) {
    return null;
  }

  return (
    <div className="offers-strip" role="list" aria-label="Offers">
      {offers.map((offer) => (
        <span key={offer.id} className="offers-strip__item" role="listitem">
          {offer.label}
        </span>
      ))}
    </div>
  );
}