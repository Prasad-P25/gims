const marathiQuotes = [
  "कामाची गुणवत्ता हीच आमची ओळख | Quality work is our identity",
  "सेवा हाच आमचा धर्म | Service is our religion",
  "ग्राहक समाधान हेच आमचे ध्येय | Customer satisfaction is our goal",
  "वेळेवर काम, उत्तम दाम | Timely work, fair price",
  "विश्वासार्हता आणि पारदर्शकता | Trust and transparency",
  "आपल्या सेवेत सदैव तत्पर | Always ready to serve you",
  "उत्कृष्टतेचा ध्यास, यशाचा विश्वास | Pursuit of excellence, belief in success",
  "एकत्र काम, एकत्र यश | Working together, succeeding together",
];

export default function MarathiMarquee() {
  const allQuotes = [...marathiQuotes, ...marathiQuotes];

  return (
    <div className="bg-gradient-to-r from-brand-blue via-brand-darkBlue to-brand-blue text-white py-2 overflow-hidden relative">
      <div
        className="flex whitespace-nowrap"
        style={{
          animation: 'scroll 60s linear infinite',
        }}
      >
        {allQuotes.map((quote, index) => (
          <span key={index} className="mx-8 text-sm font-medium flex-shrink-0">
            {quote}
            <span className="mx-4 text-brand-orange">●</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
