export default function SeatMap({ matatu, preferences, onBook, onClose }) {
  const capacity = matatu.vehicle.capacity || 14;
  const booked = matatu.bookedSeats || [];
  const rows = Math.ceil(capacity / 4);
  let seatNum = 1;

  const isWindow = (i) => i % 4 === 0 || (i + 1) % 4 === 0;
  const isFront = (row) => row < 2;

  return (
    <div className="p-4">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: capacity }, (_, i) => {
          const row = Math.floor(i / 4);
          const num = seatNum++;
          const bookedHere = booked.includes(num);
          const preferred = 
            (preferences.seatPreference === 'window' && isWindow(i)) ||
            (preferences.seatPreference === 'aisle' && !isWindow(i)) ||
            preferences.seatPreference === 'any';

          const rowMatch = 
            (preferences.seatRow === 'front' && isFront(row)) ||
            (preferences.seatRow === 'back' && row >= rows - 1) ||
            preferences.seatRow === 'any';

          return (
            <button
              key={num}
              disabled={bookedHere}
              onClick={() => onBook(num)}
              className={`
                p-3 rounded border text-sm font-bold
                ${bookedHere ? 'bg-gray-400 cursor-not-allowed' : ''}
                ${preferred && rowMatch && !bookedHere ? 'bg-green-100 border-green-600' : 'bg-white border-gray-300'}
              `}
            >
              {num}
            </button>
          );
        })}
      </div>
      <button onClick={onClose} className="mt-4 text-red-600">Close</button>
    </div>
  );
}